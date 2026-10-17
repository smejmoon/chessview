// Non-production experiment; run from experiments/star-map after:
// npm install --no-save elkjs @dagrejs/dagre
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
const require=createRequire(import.meta.url);
let Elk,dagre;
try { Elk=require('elkjs/lib/elk.bundled.js'); dagre=require('@dagrejs/dagre'); }
catch { console.error('Missing elkjs / @dagrejs/dagre; no comparison ran.'); process.exit(2); }
const names=['forcing','broad','transposition','roots-siblings','recenter-before','recenter-after'];
function fixture(name){
 const text=readFileSync(new URL('./'+name+'.dot',import.meta.url),'utf8');
 const nodes=[...text.matchAll(/^\s*"([^"]+)"\s+\[shape=\w+, fixedsize=true, width=([\d.]+), height=([\d.]+)/gm)].map(([,id,w,h])=>({id,width:+w*72,height:+h*72}));
 const edges=[...text.matchAll(/^\s*"([^"]+)"\s*->\s*"([^"]+)"/gm)].map(([,source,target],i)=>({id:'e'+i,source,target}));
 if(!nodes.length||!edges.length)throw new Error('Empty fixture '+name);
 return {nodes,edges};
}
async function elkLayout(f){
 const layout=await new Elk().layout({id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT'},children:f.nodes.map(n=>({...n})),edges:f.edges.map(e=>({id:e.id,sources:[e.source],targets:[e.target]}))});
 return layout.children.map(n=>({...n,x:n.x+n.width/2,y:n.y+n.height/2}));
}
function dagreLayout(f){
 const g=new dagre.graphlib.Graph({multigraph:true});
 g.setGraph({rankdir:'LR',nodesep:20,ranksep:30});g.setDefaultEdgeLabel(()=>({}));
 f.nodes.forEach(n=>g.setNode(n.id,{width:n.width,height:n.height}));
 f.edges.forEach(e=>g.setEdge(e.source,e.target,{},e.id));
 dagre.layout(g);return f.nodes.map(n=>({...n,...g.node(n.id)}));
}
function evaluate(f,nodes){
 const map=new Map(nodes.map(n=>[n.id,n]));
 if(map.size!==f.nodes.length || nodes.some(n=>![n.x,n.y,n.width,n.height].every(Number.isFinite)) || f.edges.some(e=>!map.has(e.source)||!map.has(e.target)))throw new Error('Invalid geometry or missing graph entity');
 const minX=Math.min(...nodes.map(n=>n.x-n.width/2)), maxX=Math.max(...nodes.map(n=>n.x+n.width/2));
 const minY=Math.min(...nodes.map(n=>n.y-n.height/2)), maxY=Math.max(...nodes.map(n=>n.y+n.height/2));
 const overlap=nodes.flatMap((n,i)=>nodes.slice(i+1).filter(m=>Math.abs(n.x-m.x)<(n.width+m.width)/2-.01&&Math.abs(n.y-m.y)<(n.height+m.height)/2-.01).map(m=>[n.id,m.id]));
 const backwards=f.edges.filter(e=>map.get(e.target).x<map.get(e.source).x-.01).length;
 return {bounds:[Math.round(maxX-minX),Math.round(maxY-minY)],overlap,backwards};
}
function displacement(oldNodes,newNodes){
 const a=new Map(oldNodes.map(n=>[n.id,n])),b=new Map(newNodes.map(n=>[n.id,n]));
 const dx=a.get('E').x-b.get('E').x,dy=a.get('E').y-b.get('E').y;
 return [...a.keys()].filter(k=>b.has(k)).map(k=>({id:k,shift:Math.round(Math.hypot(a.get(k).x-b.get(k).x-dx,a.get(k).y-b.get(k).y-dy))}));
}
const results={units:'px (DOT inches x72)',engines:{}};
for(const [name,run] of [['elkjs',elkLayout],['dagre',dagreLayout]]){
 const outcomes={};let before,after;
 for(const key of names){const f=fixture(key),start=performance.now(),nodes=await run(f);
  outcomes[key]={nodes:f.nodes.length,edges:f.edges.length,elapsedMs:+(performance.now()-start).toFixed(2),...evaluate(f,nodes),positions:nodes};
  if(key==='recenter-before')before=nodes;if(key==='recenter-after')after=nodes;
 }
 outcomes.recenterDrift=displacement(before,after);results.engines[name]=outcomes;
}
writeFileSync(new URL('./comparison-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
for(const [name,cases] of Object.entries(results.engines)){
 console.log(name);
 for(const key of names){const r=cases[key];console.log(key,r.bounds,'overlaps',r.overlap.length,'backwards',r.backwards,'ms',r.elapsedMs);}
 console.log('recenter displacement',cases.recenterDrift);
}
