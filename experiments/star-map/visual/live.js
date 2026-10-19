// Branch-only accepted-Constellation viewer. Both cameras share this scene and node map.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess } from 'chess.js';
const $ = (id) => document.getElementById(id);
const stage=$('stage'), telescope=$('telescope'), boardPreview=$('preview-board');
$('home').textContent='← Return to ChessView';
$('home').onclick=()=>{
  const url=new URL(parent.location.href);
  url.searchParams.delete('star-map');
  parent.location.assign(url.href);
};

const scene=new THREE.Scene();
scene.background=new THREE.Color('#071321');
const group=new THREE.Group();
scene.add(group);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(47,1,.1,1600);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.enablePan=true;
controls.minDistance=6;
controls.maxDistance=700;
let projection=null, mode='2.5d', hovered=null;
let hits=[], resources=[], objects=new Map(), edgeItems=[], bounds=null;
const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2(8,8);
const textureCache=new Map();
function send(message){parent.postMessage(message,location.origin)}
function haloTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');
  const gradient=g.createRadialGradient(64,64,1,64,64,63);
  gradient.addColorStop(0,'rgba(255,255,255,.95)');
  gradient.addColorStop(.12,'rgba(255,255,255,.72)');
  gradient.addColorStop(.36,'rgba(255,255,255,.19)');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gradient;
  g.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(c);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
const glowTexture=haloTexture();
// Fixed, low-contrast depth markers: presentation ambience, not graph positions.
let seed=314159;
function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
const dustPositions=[];
for(let i=0;i<260;i++)dustPositions.push((random()-.5)*270,(random()-.5)*175,-35-random()*160);
const dust=new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3)),
  new THREE.PointsMaterial({color:'#62869e',size:.24,transparent:true,opacity:.34,sizeAttenuation:true,depthWrite:false})
);
scene.add(dust);
function boardCanvas(key){
  if(textureCache.has(key))return textureCache.get(key);
  const canvas=document.createElement('canvas');
  const unit=48;
  canvas.width=canvas.height=unit*8;
  const g=canvas.getContext('2d'),chess=new Chess(key+' 0 1'),board=chess.board();
  const glyph={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    g.fillStyle=(x+y)%2?'#76969f':'#e1e7df';
    g.fillRect(x*unit,y*unit,unit,unit);
    const piece=board[y][x];
    if(!piece)continue;
    g.textAlign='center';
    g.textBaseline='middle';
    g.font='42px "DejaVu Sans","Segoe UI Symbol",serif';
    g.lineWidth=1.4;
    g.strokeStyle=piece.color==='w'?'#45616b':'#d6e3df';
    g.fillStyle=piece.color==='w'?'#fffdf5':'#182c38';
    g.strokeText(glyph[piece.color][piece.type],x*unit+unit/2,y*unit+unit/2+2);
    g.fillText(glyph[piece.color][piece.type],x*unit+unit/2,y*unit+unit/2+2);
  }
  textureCache.set(key,canvas);
  return canvas;
}
function disposeGraph(){
  for(const item of resources){
    item.geometry?.dispose?.();
    const materials=Array.isArray(item.material)?item.material:[item.material];
    for(const material of materials){
      if(material?.map && material.map!==glowTexture)material.map.dispose();
      material?.dispose?.();
    }
  }
  resources=[];hits=[];objects.clear();edgeItems=[];
  group.clear();
  telescope.hidden=true;
  hovered=null;
}
function isUpstream(node){
  return ['root','incoming','sibling'].includes(node.relation);
}
// Layout is only geometry over the accepted Constellation. It neither adds
// positions nor selects edges. Families form separated trails, not grid rows.
function layout(p){
  const nodes=new Map(p.nodes.map(n=>[n.key,n]));
  const sides=new Map([[-1,new Map()],[1,new Map()]]);
  for(const node of p.nodes){
    if(node.key===p.center)continue;
    const sign=isUpstream(node)?-1:1;
    const family=node.families?.[0]||'other';
    const families=sides.get(sign);
    if(!families.has(family))families.set(family,[]);
    families.get(family).push(node);
  }
  const positions=new Map([[p.center,new THREE.Vector3(0,0,0)]]);
  for(const [sign,families] of sides){
    const entries=[...families].map(([id,items])=>{
      const levels=new Map();
      for(const node of items){
        const depth=Math.max(1,Math.abs(node.distance||1));
        if(!levels.has(depth))levels.set(depth,[]);
        levels.get(depth).push(node);
      }
      const maxWidth=Math.max(1,...[...levels.values()].map(level=>level.length));
      return {id,levels,band:Math.max(4.4,maxWidth*3.5+1.5)};
    });
    // Prefer the accepted ordering for immediate families rather than key/hash order.
    const total=entries.reduce((sum,f)=>sum+f.band,0);
    let cursor=-total/2;
    entries.forEach((family,familyIndex)=>{
      const baseline=cursor+family.band/2;
      cursor+=family.band;
      const slope=(familyIndex-(entries.length-1)/2)*.35;
      for(const [depth,level] of family.levels){
        level.sort((a,b)=>a.key.localeCompare(b.key));
        level.forEach((node,i)=>{
          const spread=(i-(level.length-1)/2)*3.65;
          // Slightly stagger successive layers and bend distinct families outward.
          const x=sign*(4.9*depth+.18*(familyIndex%3)+.32*Math.sin(depth*.94+familyIndex));
          const y=baseline+spread+slope*(depth-1)+.35*Math.sin(depth*1.14+familyIndex);
          const z=1.45*Math.sin(familyIndex*1.3+depth*.8)+.38*spread;
          positions.set(node.key,new THREE.Vector3(x,y,z));
        });
      }
    });
  }
  // A convergence keeps exactly one destination and bends both genuine paths to it.
  for(const node of p.nodes.filter(n=>n.merge)){
    const incoming=p.edges.filter(e=>e.target===node.key)
      .map(e=>positions.get(e.source)).filter(Boolean);
    if(incoming.length<2)continue;
    const at=positions.get(node.key);
    const mean=incoming.reduce((sum,v)=>sum+v.y,0)/incoming.length;
    at.y=at.y*.2+mean*.8;
    at.z=incoming.reduce((sum,v)=>sum+v.z,0)/incoming.length;
  }
  const xs=[...positions.values()].map(v=>v.x);
  const ys=[...positions.values()].map(v=>v.y);
  const minX=Math.min(...xs)-2.6,maxX=Math.max(...xs)+2.6;
  const minY=Math.min(...ys)-2.6,maxY=Math.max(...ys)+2.6;
  return {positions,bounds:{minX,maxX,minY,maxY}};
}
function familyColor(id){
  let hash=0;
  for(const ch of id||'main')hash=(hash*31+ch.charCodeAt(0))|0;
  return new THREE.Color().setHSL((((hash%360)+360)%360)/360,.60,.66);
}
function rebuild(p){
  if(!p || !p.nodes?.some(n=>n.key===p.center))return;
  projection=p;
  disposeGraph();
  const placed=layout(p);
  bounds=placed.bounds;
  const positions=placed.positions,counts=new Map();
  p.edges.forEach(e=>counts.set(e.target,(counts.get(e.target)||0)+1));
  const immediate=p.nodes.filter(n=>n.key!==p.center && Math.abs(n.distance)===1);
  const landmarkKeys=new Set(immediate.slice(0,5).map(n=>n.key));
  for(const node of p.nodes.filter(n=>n.merge).slice(0,2))landmarkKeys.add(node.key);
  for(const node of p.nodes){
    const pos=positions.get(node.key);
    if(!pos)continue;
    const center=node.key===p.center;
    const landmark=landmarkKeys.has(node.key);
    const board=center||landmark;
    const color=center?new THREE.Color('#9eeeff'):familyColor(node.families?.[0]||node.relation);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({
      map:glowTexture,color,transparent:true,opacity:center?.80:.65,
      depthWrite:false,blending:THREE.AdditiveBlending
    }));
    halo.position.copy(pos);
    halo.scale.setScalar(center?7:landmark?4.3:2.1);
    group.add(halo);
    resources.push(halo);
    if(board){
      const size=center?4.3:2.52;
      const backing=new THREE.Mesh(new THREE.PlaneGeometry(size+.12,size+.12),
        new THREE.MeshBasicMaterial({color:center?'#a5eff6':'#386276',side:THREE.DoubleSide}));
      backing.position.copy(pos);backing.position.z-=.02;
      group.add(backing);resources.push(backing);
      const map=new THREE.CanvasTexture(boardCanvas(node.key));
      map.colorSpace=THREE.SRGBColorSpace;
      map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      const tile=new THREE.Mesh(new THREE.PlaneGeometry(size,size),
        new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
      tile.position.copy(pos);tile.position.z+=.02;
      tile.userData.key=node.key;
      group.add(tile);hits.push(tile);resources.push(tile);
    }else{
      const sphere=new THREE.Mesh(new THREE.SphereGeometry(node.merge?.38:.24,16,12),
        new THREE.MeshBasicMaterial({color}));
      sphere.position.copy(pos);sphere.userData.key=node.key;
      group.add(sphere);hits.push(sphere);resources.push(sphere);
      const area=new THREE.Mesh(new THREE.SphereGeometry(.8,10,8),
        new THREE.MeshBasicMaterial({visible:false}));
      area.position.copy(pos);area.userData.key=node.key;
      group.add(area);hits.push(area);resources.push(area);
    }
    objects.set(node.key,pos);
  }
  for(const edge of p.edges){
    const a=positions.get(edge.source),b=positions.get(edge.target);
    if(!a||!b)continue;
    const mid=a.clone().lerp(b,.5);
    mid.y+=(a.y-b.y)*.11;
    mid.z-=.45;
    const geometry=new THREE.BufferGeometry().setFromPoints(
      new THREE.QuadraticBezierCurve3(a,mid,b).getPoints(20));
    const color=familyColor(edge.families?.[0]||p.nodes.find(n=>n.key===edge.target)?.families?.[0]||'line');
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({
      color,transparent:true,opacity:.25,depthWrite:false
    }));
    line.renderOrder=-1;
    group.add(line);resources.push(line);edgeItems.push({edge,line});
  }
  $('count-positions').textContent=String(p.nodes.length);
  $('count-moves').textContent=String(p.edges.length);
  $('count-merges').textContent=String([...counts.values()].filter(x=>x>1).length);
  $('current-name').textContent='Accepted current Nodus';
  $('current-detail').textContent=p.center.split(' ')[0]+' · '+p.viewMode;
  resetCamera();
  window.__starMapState={
    center:p.center,keys:p.nodes.map(n=>n.key),
    edges:p.edges.map(e=>({source:e.source,target:e.target,id:e.id})),mode,
    getScreen(key){
      const pos=objects.get(key);
      if(!pos)return null;
      const projected=pos.clone().project(camera);
      return {x:(projected.x+1)*stage.clientWidth/2,y:(1-projected.y)*stage.clientHeight/2};
    },
    bounds,
    visibleBoards:[p.center,...landmarkKeys]
  };
}
function resetCamera(){
  if(!bounds)return;
  const width=stage.clientWidth||innerWidth,height=stage.clientHeight||innerHeight;
  const left=Math.min(380,width*.27),right=35,top=95,bottom=85;
  const availableWidth=Math.max(200,width-left-right);
  const availableHeight=Math.max(220,height-top-bottom);
  const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const spanX=bounds.maxX-bounds.minX;
  const spanY=bounds.maxY-bounds.minY;
  const distance=Math.max(19,
    (spanX+2)*height/(2*tangent*availableWidth),
    (spanY+2)*height/(2*tangent*availableHeight));
  const depth=mode==='3d'?distance*1.32:distance;
  const unit=2*depth*tangent/height;
  const targetX=(bounds.minX+bounds.maxX)/2-(left-right)/2*unit;
  const targetY=(bounds.minY+bounds.maxY)/2+(top-bottom)/2*unit;
  controls.target.set(targetX,targetY,0);
  if(mode==='3d')camera.position.set(targetX+depth*.24,targetY+depth*.22,depth);
  else camera.position.set(targetX,targetY,depth);
  camera.lookAt(controls.target);
  controls.update();
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
function setHover(key){
  if(hovered===key)return;
  hovered=key;
  for(const {edge,line} of edgeItems){
    line.material.opacity=key
      ? (edge.source===key||edge.target===key?.91:.11)
      : .25;
  }
  stage.style.cursor=key?'pointer':'crosshair';
  if(!key || projection?.center===key){telescope.hidden=true;return}
  const preview=boardCanvas(key);
  boardPreview.replaceChildren(preview);
  $('preview-label').textContent='Read-only canonical position';
  telescope.hidden=false;
}
let start=null;
renderer.domElement.addEventListener('pointerdown',e=>start={x:e.clientX,y:e.clientY});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!start)return;
  const click=Math.hypot(e.clientX-start.x,e.clientY-start.y)<=6;
  start=null;
  if(click){const key=pick(e);if(key)send({type:'star-map:recenter',key})}
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6){setHover(null);return}
  setHover(pick(e));
  if(!telescope.hidden){
    const rect=telescope.getBoundingClientRect();
    telescope.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,e.clientX+22))+'px';
    telescope.style.top=Math.max(80,Math.min(innerHeight-rect.height-8,e.clientY-rect.height-18))+'px';
  }
});
renderer.domElement.addEventListener('pointerleave',()=>{start=null;setHover(null)});

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
  for(const item of resources)if(item.isMesh && item.geometry?.type==='PlaneGeometry')item.quaternion.copy(camera.quaternion);
  renderer.render(scene,camera);
}
setMode('2.5d');frame();send({type:'star-map:ready'});

