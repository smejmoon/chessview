// Branch-only accepted-Constellation viewer. Both cameras share this scene and node map.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess } from 'chess.js';
const $ = (id) => document.getElementById(id);
const stage=$('stage'), telescope=$('telescope'), boardPreview=$('preview-board');
$('home').textContent='← Return to ChessView';
$('home').onclick=()=>location.assign(new URL('../?'+new URLSearchParams(location.search).toString(),location.href));

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x08111d,.012);
const group=new THREE.Group();scene.add(group);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));stage.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(47,1,.1,500);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.enablePan=true;controls.minDistance=4;controls.maxDistance=130;
let projection=null, mode='2.5d', clicked=null;
let hits=[], materials=[], objects=new Map(), edges=[];
const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2(8,8);
function send(message){parent.postMessage(message,location.origin)}
function boardCanvas(key){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const g=canvas.getContext('2d'),chess=new Chess(key+' 0 1'),b=chess.board();
  const glyph={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    g.fillStyle=(x+y)%2?'#78989b':'#e2e6dd';g.fillRect(x*32,y*32,32,32);
    const p=b[y][x];if(!p)continue;
    g.textAlign='center';g.textBaseline='middle';g.font='29px serif';
    g.fillStyle=p.color==='w'?'#fff':'#162a36';g.fillText(glyph[p.color][p.type],x*32+16,y*32+17);
  }
  return canvas;
}
function disposeGraph(){
  for(const item of materials){item.geometry?.dispose?.();item.material?.map?.dispose?.();item.material?.dispose?.()}
  materials=[];hits=[];objects.clear();edges=[];
  group.clear();
}
function layout(p){
  const nodes=new Map(p.nodes.map(n=>[n.key,n]));
  const out=new Map(), incoming=new Map();
  for(const e of p.edges){
    if(!out.has(e.source))out.set(e.source,[]);
    out.get(e.source).push(e);
    incoming.set(e.target,(incoming.get(e.target)||0)+1);
  }
  const layers=new Map();
  // The accepted Constellation supplies membership. Coordinates are temporary Lens geometry.
  for(const n of p.nodes){
    const d=n.key===p.center?0:Math.max(1,Math.abs(n.distance||1));
    const upstream=n.relation==='root'||n.relation==='incoming'||n.relation==='sibling';
    const column=upstream?-d:d;
    if(!layers.has(column))layers.set(column,[]);
    layers.get(column).push(n);
  }
  const positions=new Map();
  for(const [column,layer] of layers){
    layer.sort((a,b)=>(a.families?.[0]||'').localeCompare(b.families?.[0]||'')||a.key.localeCompare(b.key));
    layer.forEach((n,i)=>{
      const y=(i-(layer.length-1)/2)*3.7;
      const family=n.families?.[0]||'';
      let seed=0;for(let j=0;j<family.length;j++)seed=(seed*31+family.charCodeAt(j))|0;
      positions.set(n.key,new THREE.Vector3(column*4.2,y,((seed%7)+7)%7*.5-1.5));
    });
  }
  return positions;
}
function rebuild(p){
  if(!p || !p.nodes?.some(n=>n.key===p.center))return;
  projection=p;disposeGraph();clicked=null;
  const positions=layout(p), counts=new Map();
  p.edges.forEach(e=>counts.set(e.target,(counts.get(e.target)||0)+1));
  for(const n of p.nodes){
    const pos=positions.get(n.key);
    const isCenter=n.key===p.center;
    const family=n.families?.[0]||n.relation;
    let hash=0;for(const ch of family)hash=(hash*31+ch.charCodeAt(0))|0;
    const color=new THREE.Color().setHSL(((hash%360)+360)%360/360,.65,.67);
    const geom=new THREE.SphereGeometry(isCenter?.48:.25,16,12);
    const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({color}));
    mesh.position.copy(pos);mesh.userData.key=n.key;group.add(mesh);hits.push(mesh);materials.push(mesh);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({color,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.position.copy(pos);halo.scale.setScalar(isCenter?4:2);group.add(halo);materials.push(halo);
    if(isCenter || n.distance===1 || n.merge){
      const texture=new THREE.CanvasTexture(boardCanvas(n.key));texture.colorSpace=THREE.SRGBColorSpace;
      const tile=new THREE.Mesh(new THREE.PlaneGeometry(isCenter?3.2:1.65,isCenter?3.2:1.65),
        new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
      tile.position.copy(pos);tile.position.z+=.15;tile.userData.key=n.key;
      group.add(tile);hits.push(tile);materials.push(tile);
    }
    objects.set(n.key,pos);
  }
  for(const edge of p.edges){
    const a=positions.get(edge.source),b=positions.get(edge.target);
    if(!a||!b)continue;
    const geometry=new THREE.BufferGeometry().setFromPoints([a,b]);
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#62a0bd',transparent:true,opacity:.52}));
    group.add(line);materials.push(line);edges.push(edge);
  }
  $('count-positions').textContent=String(p.nodes.length);
  $('count-moves').textContent=String(p.edges.length);
  $('count-merges').textContent=String([...counts.values()].filter(x=>x>1).length);
  $('current-name').textContent='Accepted current Nodus';
  $('current-detail').textContent=p.center.split(' ')[0]+' · '+p.viewMode;
  resetCamera();
  window.__starMapState={center:p.center,keys:p.nodes.map(n=>n.key),edges:p.edges.map(e=>({source:e.source,target:e.target,id:e.id})),mode};
}
function resetCamera(){
  const list=[...objects.values()];
  const span=Math.max(15,...list.map(v=>Math.abs(v.x)*1.2+Math.abs(v.y)*.45));
  controls.target.set(0,0,0);
  camera.position.set(mode==='3d'?span*.3:0,mode==='3d'?span*.35:0,Math.max(24,span*1.8));
  camera.lookAt(controls.target);controls.update();
}
function setMode(next){
  mode=next;controls.enableRotate=mode==='3d';
  $('twohalf').classList.toggle('active',mode==='2.5d');
  $('three').classList.toggle('active',mode==='3d');
  $('mode-label').textContent=mode==='3d'?'FULL 3D / ORBIT CAMERA':'2.5D / FIXED CAMERA';
  $('instructions').textContent=mode==='3d'?'Drag to orbit · Scroll to zoom · Hover to inspect · Click to Recenter':'Drag to pan · Scroll to zoom · Hover to inspect · Click to Recenter';
  if(window.__starMapState)window.__starMapState.mode=mode;
  resetCamera();
}
$('twohalf').onclick=()=>setMode('2.5d');
$('three').onclick=()=>setMode('3d');
$('reset').onclick=resetCamera;
function pick(event){
  const r=renderer.domElement.getBoundingClientRect();
  mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
  raycaster.setFromCamera(mouse,camera);
  return raycaster.intersectObjects(hits)[0]?.object.userData.key||null;
}
let start=null;
renderer.domElement.addEventListener('pointerdown',e=>start={x:e.clientX,y:e.clientY});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;
  start=null;const key=pick(e);if(key)send({type:'star-map:recenter',key});
});
renderer.domElement.addEventListener('pointermove',e=>{
  const key=pick(e);
  if(!key || projection?.center===key){telescope.hidden=true;return}
  const c=boardCanvas(key);boardPreview.replaceChildren(c);
  $('preview-label').textContent='Read-only canonical position';
  telescope.hidden=false;
  telescope.style.left=Math.max(8,Math.min(innerWidth-220,e.clientX+20))+'px';
  telescope.style.top=Math.max(82,Math.min(innerHeight-245,e.clientY-200))+'px';
});
renderer.domElement.addEventListener('pointerleave',()=>telescope.hidden=true);
addEventListener('message',e=>{
  if(e.origin!==location.origin || e.source!==parent || e.data?.type!=='chessview:projection')return;
  const incoming=e.data.projection;
  if(incoming)rebuild(incoming);
});
function frame(){
  requestAnimationFrame(frame);
  const w=stage.clientWidth,h=stage.clientHeight;
  if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  controls.update();
  for(const item of materials)if(item.isMesh && item.geometry?.type==='PlaneGeometry')item.quaternion.copy(camera.quaternion);
  renderer.render(scene,camera);
}
setMode('2.5d');frame();send({type:'star-map:ready'});

