// Browser exercise of the real-view renderer contract with accepted-shaped
// legal chess projections. This is not Lichess authentication integration.
const { chromium } = require('playwright');
const { Chess } = require('chess.js');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const captures=join(__dirname,'screenshots');
mkdirSync(captures,{recursive:true});
const canonical=(fen)=>fen.split(' ').slice(0,4).join(' ');
function broadProjection(){
  const start=new Chess(),center=canonical(start.fen());
  const nodes=new Map([[center,{key:center,relation:'center',distance:0,families:[]}]]);
  const edges=new Map();
  const routes=[
    ['d4','Nf6','Nf3','d5','c4','e6','Nc3','Be7'],
    ['Nf3','d5','d4','Nf6','c4','e6','Nc3','Be7'],
    ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7'],
    ['e4','e5','Nf3','Nc6','Bc4','Nf6','d3'],
    ['e4','c5','Nf3','d6','d4','cxd4','Nxd4'],
    ['c4','e5','Nc3','Nf6','Nf3','Nc6'],
    ['Nf3','Nf6','g3','g6','Bg2','Bg7','O-O']
  ];
  routes.forEach((moves)=>{
    const chess=new Chess();let prev=center;
    moves.forEach((san,index)=>{
      const move=chess.move(san);
      assert(move,'Legal test move');
      const key=canonical(chess.fen()),family=moves[0];
      if(!nodes.has(key))nodes.set(key,{
        key,relation:index===0?'outgoing':'descendant',distance:index+1,
        families:[family],merge:false
      });
      else if(!nodes.get(key).families.includes(family))nodes.get(key).families.push(family);
      const id=prev+' / '+move.from+move.to+' / '+key;
      if(!edges.has(id))edges.set(id,{id,source:prev,target:key,san:move.san,families:[family]});
      prev=key;
    });
  });
  const counts=new Map();
  for(const edge of edges.values())counts.set(edge.target,(counts.get(edge.target)||0)+1);
  for(const node of nodes.values())node.merge=(counts.get(node.key)||0)>1;
  assert([...nodes.values()].some(n=>n.merge),'Fixture has canonical convergence');
  return {center,viewMode:'lines',nodes:[...nodes.values()],edges:[...edges.values()]};
}
function rootsProjection(){
  const start=new Chess(),root=canonical(start.fen());
  const key=(moves)=>{const c=new Chess();moves.forEach(m=>c.move(m));return canonical(c.fen())};
  const center=key(['e4']),d4=key(['d4']),nf3=key(['Nf3']);
  const e5=key(['e4','e5']),c5=key(['e4','c5']);
  const nodes=[
    {key:center,relation:'center',distance:0,families:[]},
    {key:root,relation:'root',distance:1,families:['root']},
    {key:d4,relation:'sibling',distance:1,families:['root']},
    {key:nf3,relation:'sibling',distance:1,families:['root']},
    {key:e5,relation:'outgoing',distance:1,families:['e5']},
    {key:c5,relation:'outgoing',distance:1,families:['c5']}
  ];
  const edges=[
    {id:'root-e4',source:root,target:center,families:['root'],san:'e4'},
    {id:'root-d4',source:root,target:d4,families:['root'],san:'d4'},
    {id:'root-nf3',source:root,target:nf3,families:['root'],san:'Nf3'},
    {id:'e4-e5',source:center,target:e5,families:['e5'],san:'e5'},
    {id:'e4-c5',source:center,target:c5,families:['c5'],san:'c5'}
  ];
  return {center,viewMode:'roots',nodes,edges};
}
async function publish(page,projection){
  await page.evaluate(data=>window.postMessage({type:'chessview:projection',projection:data},location.origin),projection);
  await page.waitForFunction(center=>window.__starMapState?.center===center,projection.center);
  await page.waitForTimeout(500);
  return page.evaluate(()=>({
    keys:window.__starMapState.keys,
    edges:window.__starMapState.edges,
    center:window.__starMapState.center,
    boards:window.__starMapState.visibleBoards,
    projected:window.__starMapState.keys.map(key=>({key,...window.__starMapState.getScreen(key)})),
    canvas:!!document.querySelector('#stage canvas'),
    webgl:!!document.querySelector('#stage canvas')?.getContext('webgl2')
  }));
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
    '--use-angle=swiftshader','--disable-dev-shm-usage'
  ]});
  const errors=[];
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  try{
    await page.goto('http://127.0.0.1:8765/?live=1',{waitUntil:'load'});
    const projection=broadProjection();
    const state=await publish(page,projection);
    assert(state.webgl && state.canvas,'Live Three.js canvas is initialized');
    assert.deepEqual(new Set(state.keys),new Set(projection.nodes.map(n=>n.key)));
    assert.equal(state.edges.length,projection.edges.length,'Every accepted relationship is represented');
    assert.equal(new Set(state.keys).size,state.keys.length,'Canonical nodes are unique');
    for(const {key,x,y} of state.projected){
      assert(x>=0&&x<=1440&&y>=0&&y<=900,'Initial view contains '+key);
    }
    assert(state.boards.includes(projection.center),'Nodus has a board');
    await page.screenshot({path:join(captures,'live-lines-2-point-5d.png'),fullPage:true});

    // Test actual hit testing and the outgoing Recenter message, not just a toggle.
    await page.evaluate(()=>{window.__recenterMessages=[];window.addEventListener('message',e=>{
      if(e.data?.type==='star-map:recenter')window.__recenterMessages.push(e.data.key);
    })});
    const target=projection.nodes.find(n=>n.distance===1);
    const at=state.projected.find(n=>n.key===target.key);
    await page.mouse.move(at.x,at.y);
    await page.mouse.click(at.x,at.y);
    await page.waitForFunction(key=>window.__recenterMessages?.includes(key),target.key);

    await page.locator('#three').click();
    await page.waitForTimeout(450);
    const three=await page.evaluate(()=>({
      mode:window.__starMapState.mode,keys:window.__starMapState.keys,
      edges:window.__starMapState.edges
    }));
    assert.equal(three.mode,'3d');
    assert.deepEqual(three.keys,state.keys,'Both modes retain accepted node identities');
    assert.deepEqual(three.edges,state.edges,'Both modes retain accepted relationships');
    await page.screenshot({path:join(captures,'live-lines-3d.png'),fullPage:true});
    await page.locator('#twohalf').click();
    assert.equal(await page.evaluate(()=>window.__starMapState.mode),'2.5d');

    const roots=rootsProjection();
    const upstream=await publish(page,roots);
    assert.equal(upstream.keys.length,roots.nodes.length);
    assert.equal(upstream.edges.length,roots.edges.length);
    assert(upstream.projected.find(n=>n.key===roots.nodes[1].key).x
      < upstream.projected.find(n=>n.key===roots.center).x,'Roots appear to the left');
    assert(upstream.projected.find(n=>n.key===roots.nodes[4].key).x
      > upstream.projected.find(n=>n.key===roots.center).x,'Lines appear to the right');
    await page.screenshot({path:join(captures,'live-roots-2-point-5d.png'),fullPage:true});
    assert.deepEqual(errors,[],'No live renderer browser errors');
    console.log('PASS: live scenes show accepted nodes/edges, fit the viewport, preserve topology in both cameras, show Roots upstream, and emit Recenter on click.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
