// Isolated visual experiment. No Current View, source acquisition, or production renderer.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess } from 'chess.js';

const stage = document.querySelector('#stage');
const telescope = document.querySelector('#telescope');
const previewBoard = document.querySelector('#preview-board');
const previewLabel = document.querySelector('#preview-label');
const modeLabel = document.querySelector('#mode-label');
const instructions = document.querySelector('#instructions');
const currentName = document.querySelector('#current-name');
const currentDetail = document.querySelector('#current-detail');
const variants = [
  { name: 'Queen pawn into Réti', moves: ['d4','Nf6','Nf3','d5','c4','e6','Nc3','Be7'], color: '#73d4e3' },
  { name: 'Réti transposition', moves: ['Nf3','d5','d4','Nf6','c4','e6','Nc3','Be7'], color: '#bca2fc' },
  { name: 'Queen gambit', moves: ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7','e3','O-O'], color: '#73d4e3' },
  { name: 'Italian', moves: ['e4','e5','Nf3','Nc6','Bc4','Nf6','d3','Bc5','c3','d6'], color: '#ffb971' },
  { name: 'Sicilian', moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Be3','e5'], color: '#ffb971' },
  { name: 'English', moves: ['c4','e5','Nc3','Nf6','Nf3','Nc6','g3','d5'], color: '#7becba' },
  { name: 'Réti flank', moves: ['Nf3','Nf6','g3','g6','Bg2','Bg7','O-O','O-O','d3','d6'], color: '#bca2fc' },
  { name: 'English reversed Sicilian', moves: ['c4','e5','g3','Nf6','Bg2','d5','cxd5','Nxd5'], color: '#7becba' },
];
const familyBase = {
  d4: [5.1,-3.6], Nf3: [0.8,4.5], e4: [-5.7,1.0], c4: [-9.4,-4.0], g3: [9,6]
};
const keyOf = (fen) => fen.split(' ').slice(0,4).join(' ');
function makeGraph() {
  const byKey = new Map();
  const edges = new Map();
  const initial = new Chess();
  const rootKey = keyOf(initial.fen());
  byKey.set(rootKey,{key:rootKey,fen:initial.fen(),depth:0,first:'start',route:'Starting position',last:'Start',incoming:[],color:'#a9efff'});
  let mergeKey = null;
  variants.forEach((variant,variantIndex)=>{
    const chess = new Chess();
    let prev=rootKey;
    variant.moves.forEach((san,index)=>{
      const move=chess.move(san);
      if(!move) throw new Error('Invalid fixture move: '+san+' in '+variant.name);
      const key=keyOf(chess.fen());
      let node=byKey.get(key);
      if(!node){
        node={key,fen:chess.fen(),depth:index+1,first:variant.moves[0],route:variant.moves.slice(0,index+1).join(' '),last:move.san,incoming:[],color:variant.color,variation:variantIndex};
        byKey.set(key,node);
      }
      const edgeKey=prev+' / '+move.uci+' / '+key;
      if(!edges.has(edgeKey)){
        const edge={id:edgeKey,source:prev,target:key,san:move.san,color:variant.color};
        edges.set(edgeKey,edge);
        node.incoming.push(edge);
      }
      prev=key;
      if(variantIndex===0 && index===3)mergeKey=key;
    });
  });
  const nodes=[...byKey.values()];
  const coords=new Map();
  nodes.forEach((node)=>{
    if(node.key===rootKey){ node.position=new THREE.Vector3(-12,0,0); return; }
    const base=familyBase[node.first]||[0,0];
    const v=node.variation??0;
    node.position = new THREE.Vector3(
      -12+node.depth*3.55,
      base[0]+Math.sin(node.depth*0.86+v*0.8)*0.9+(v%3-1)*0.75,
      base[1]+Math.sin(node.depth*1.13+v)*2.0+(v%3-1)*0.58
    );
    coords.set(node.key,node.position);
  });
  // One node is shared by two genuinely transposing move orders.
  // This fixed illustrative layout blends the two visual families at that one node.
  if(mergeKey && byKey.has(mergeKey))byKey.get(mergeKey).position.set(2.2,3.2,1.1);
  return {nodes,edges:[...edges.values()],byKey,rootKey,mergeKey};
}
const data=makeGraph();
document.querySelector('#count-positions').textContent=String(data.nodes.length);
document.querySelector('#count-moves').textContent=String(data.edges.length);
document.querySelector('#count-merges').textContent=String(data.nodes.filter(n=>n.incoming.length>1).length);
let selected=data.rootKey;
const firstBoards=new Set([data.rootKey,data.mergeKey]);
for(const first of ['d4','e4','Nf3']){
  const candidate=data.nodes.find(n=>n.depth===1 && n.last===first);
  if(candidate)firstBoards.add(candidate.key);
}

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2('#08111d',0.005);
const graphGroup=new THREE.Group();
scene.add(graphGroup);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setClearColor('#050f1b',0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(47,1,0.1,500);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.075;
controls.minDistance=10;
controls.maxDistance=140;
controls.enablePan=true;
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2(5,5);
let hovered=null;
let mode='2.5d';
let pressed=null;
let cameraTween=null;
let moving=false;
const pickables=[];
const renderItems=new Map();
const edgeItems=[];
const textureCache=new Map();

function haloTexture(){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=128;
  const c=canvas.getContext('2d');
  const g=c.createRadialGradient(64,64,2,64,64,63);
  g.addColorStop(0,'rgba(255,255,255,.9)');
  g.addColorStop(.12,'rgba(155,229,253,.64)');
  g.addColorStop(.36,'rgba(62,163,214,.21)');
  g.addColorStop(1,'rgba(5,25,40,0)');
  c.fillStyle=g;c.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}
const glowMap=haloTexture();
const pieceGlyphs={
  w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
  b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
};
function boardCanvas(node){
  if(textureCache.has(node.key))return textureCache.get(node.key);
  const canvas=document.createElement('canvas');
  const side=512, cell=side/8;
  canvas.width=canvas.height=side;
  const context=canvas.getContext('2d');
  const cells=new Chess(node.fen).board();
  for(let rank=0;rank<8;rank++){
    for(let file=0;file<8;file++){
      context.fillStyle=(rank+file)%2?'#77979b':'#e1e4d8';
      context.fillRect(file*cell,rank*cell,cell,cell);
      const piece=cells[rank][file];
      if(!piece)continue;
      context.textAlign='center';context.textBaseline='middle';
      context.font='54px "DejaVu Sans","Segoe UI Symbol",serif';
      const glyph=pieceGlyphs[piece.color][piece.type];
      context.lineWidth=2.0;
      context.strokeStyle=piece.color==='w'?'#637079':'#dae0d9';
      context.fillStyle=piece.color==='w'?'#fdfcf4':'#182d39';
      context.strokeText(glyph,file*cell+cell/2,rank*cell+cell/2+3);
      context.fillText(glyph,file*cell+cell/2,rank*cell+cell/2+3);
    }
  }
  textureCache.set(node.key,canvas);
  return canvas;
}
function boardTexture(node){
  const texture=new THREE.CanvasTexture(boardCanvas(node));
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  return texture;
}
for(const node of data.nodes){
  const group=new THREE.Group();
  group.position.copy(node.position);
  graphGroup.add(group);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({
    map:glowMap,transparent:true,opacity:.58,depthWrite:false,
    color:new THREE.Color(node.color),blending:THREE.AdditiveBlending
  }));
  halo.scale.set(2.3,2.3,1);
  group.add(halo);
  const sphere=new THREE.Mesh(
    new THREE.SphereGeometry(.25,12,10),
    new THREE.MeshBasicMaterial({color:node.color})
  );
  group.add(sphere);
  const hit=new THREE.Mesh(
    new THREE.SphereGeometry(.63,9,7),
    new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
  );
  hit.userData.nodeKey=node.key;
  group.add(hit);
  pickables.push(hit);
  const board=new THREE.Mesh(
    new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({map:boardTexture(node),side:THREE.DoubleSide,transparent:false})
  );
  board.userData.nodeKey=node.key;
  group.add(board);
  pickables.push(board);
  renderItems.set(node.key,{node,group,halo,sphere,hit,board});
}
for(const edge of data.edges){
  const start=data.byKey.get(edge.source).position;
  const end=data.byKey.get(edge.target).position;
  const mid=start.clone().lerp(end,.5);
  mid.z+=Math.sin((start.x+end.x)*.31)*.48;
  const curve=new THREE.QuadraticBezierCurve3(start,mid,end);
  const tube=new THREE.Mesh(
    new THREE.TubeGeometry(curve,18,.031,5,false),
    new THREE.MeshBasicMaterial({color:edge.color,transparent:true,opacity:.36,depthWrite:false})
  );
  graphGroup.add(tube);
  edgeItems.push({edge,mesh:tube});
}

function syncBoards(){
  for(const {node,board,sphere,halo,hit} of renderItems.values()){
    const isNodus=node.key===selected;
    const isLandmark=firstBoards.has(node.key);
    board.visible=isNodus||isLandmark;
    board.scale.setScalar(isNodus?3.65:2.18);
    sphere.visible=!board.visible;
    halo.material.opacity=isNodus?.85:.55;
    halo.scale.setScalar(isNodus?6.8:isLandmark?4.1:2.35);
    hit.scale.setScalar(isNodus?1.4:1);
  }
}
function setIdentity(){
  const n=data.byKey.get(selected);
  currentName.textContent=selected===data.rootKey?'Starting position':(selected===data.mergeKey?'Transposition':n.last+' · '+n.depth+' plies');
  currentDetail.textContent=selected===data.rootKey?'Select any star to recenter':(n.incoming.length>1?n.incoming.length+' incoming moves · one canonical position':'Example route: '+n.route);
}
syncBoards();setIdentity();

function resetCamera(){
  cameraTween=null;
  if(mode==='2.5d'){
    camera.position.set(5,3,48);
    controls.target.set(5,0,0);
  }else{
    camera.position.set(15,14,42);
    controls.target.set(5,0,0);
  }
  camera.lookAt(controls.target);
  controls.update();
}
function setMode(next){
  mode=next;
  document.querySelector('#twohalf').classList.toggle('active',mode==='2.5d');
  document.querySelector('#three').classList.toggle('active',mode==='3d');
  controls.enableRotate=mode==='3d';
  graphGroup.rotation.set(0,0,0);
  modeLabel.textContent=mode==='3d'?'FULL 3D / ORBIT CAMERA':'2.5D / FIXED CAMERA + DEPTH PARALLAX';
  instructions.textContent=mode==='3d'
    ?'Drag to orbit · Right drag to pan · Scroll to zoom · Hover to inspect · Click a star to recenter'
    :'Drag to pan · Scroll to zoom · Hover to inspect · Click a star to recenter';
  resetCamera();
}
function focusNode(key){
  if(!data.byKey.has(key))return;
  selected=key;
  syncBoards();
  setIdentity();
  hovered=null;
  telescope.hidden=true;
  const to=renderItems.get(key).group.getWorldPosition(new THREE.Vector3());
  const fromTarget=controls.target.clone();
  const fromCamera=camera.position.clone();
  const offset=fromCamera.clone().sub(fromTarget);
  cameraTween={start:performance.now(),duration:650,fromTarget,fromCamera,toTarget:to,toCamera:to.clone().add(offset)};
}
function hitTest(){
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(pickables,false);
  return hits.length?hits[0].object.userData.nodeKey:null;
}
function preview(key){
  if(!key || firstBoards.has(key) || selected===key){
    telescope.hidden=true;return;
  }
  const node=data.byKey.get(key);
  previewBoard.replaceChildren();
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  canvas.getContext('2d').drawImage(boardCanvas(node),0,0);
  previewBoard.appendChild(canvas);
  previewLabel.textContent=node.incoming.length>1?'Convergence: '+node.incoming.length+' routes reach this position':node.route;
  telescope.hidden=false;
}
function moveTelescope(key){
  if(!key || telescope.hidden)return;
  const element=renderItems.get(key).group;
  const world=element.getWorldPosition(new THREE.Vector3()).project(camera);
  const x=(world.x+1)*window.innerWidth/2;
  const y=(1-world.y)*window.innerHeight/2;
  const width=telescope.getBoundingClientRect().width;
  const height=telescope.getBoundingClientRect().height;
  const left=x+20+width>window.innerWidth?x-width-20:x+20;
  const top=y-height-18<80?y+20:y-height-18;
  telescope.style.left=Math.max(8,Math.min(window.innerWidth-width-8,left))+'px';
  telescope.style.top=Math.max(78,Math.min(window.innerHeight-height-8,top))+'px';
}
function setHover(key){
  if(hovered===key)return;
  hovered=key;
  preview(key);
  stage.style.cursor=key?'pointer':'crosshair';
  edgeItems.forEach(({edge,mesh})=>{
    mesh.material.opacity=key?(edge.source===key||edge.target===key?.95:.19):.36;
  });
  for(const {node,halo,sphere} of renderItems.values()){
    const active=key===node.key;
    sphere.scale.setScalar(active?1.65:1);
    if(node.key!==selected)halo.material.opacity=active?.95:.58;
  }
}
let pX=0,pY=0;
renderer.domElement.addEventListener('pointerdown',event=>{pressed={x:event.clientX,y:event.clientY};moving=true});
renderer.domElement.addEventListener('pointermove',event=>{
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  pX=pointer.x;pY=pointer.y;
  if(pressed && Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)>5){setHover(null);return;}
  setHover(hitTest());
});
renderer.domElement.addEventListener('pointerup',event=>{
  const isClick=pressed && Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<6;
  pressed=null;moving=false;
  if(isClick){const key=hitTest();if(key)focusNode(key);}
});
renderer.domElement.addEventListener('pointerleave',()=>{pointer.set(5,5);pX=0;pY=0;setHover(null);pressed=null;moving=false});
document.querySelector('#twohalf').addEventListener('click',()=>setMode('2.5d'));
document.querySelector('#three').addEventListener('click',()=>setMode('3d'));
document.querySelector('#reset').addEventListener('click',resetCamera);
document.querySelector('#home').addEventListener('click',()=>focusNode(data.rootKey));
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
}
window.addEventListener('resize',resize);
resize();setMode('2.5d');
function frame(time){
  requestAnimationFrame(frame);
  if(cameraTween){
    const t=Math.min(1,(time-cameraTween.start)/cameraTween.duration);
    const ease=t*t*(3-2*t);
    camera.position.lerpVectors(cameraTween.fromCamera,cameraTween.toCamera,ease);
    controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,ease);
    if(t>=1)cameraTween=null;
  }
  if(mode==='2.5d' && !moving){
    graphGroup.rotation.y+=((pX*.028)-graphGroup.rotation.y)*.035;
    graphGroup.rotation.x+=((-pY*.018)-graphGroup.rotation.x)*.035;
  }else{
    graphGroup.rotation.y+=(0-graphGroup.rotation.y)*.045;
    graphGroup.rotation.x+=(0-graphGroup.rotation.x)*.045;
  }
  controls.update();
  for(const {board} of renderItems.values())if(board.visible)board.quaternion.copy(camera.quaternion);
  moveTelescope(hovered);
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
