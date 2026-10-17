// Non-production, dependency-free gallery of both engines' actual node layouts.
// Edges use straight lines for inspection; this is NOT an edge-routing comparison.
import { readFileSync, writeFileSync } from 'node:fs';
const data=JSON.parse(readFileSync(new URL('./comparison-results.json',import.meta.url),'utf8'));
const names=['forcing','broad','transposition','roots-siblings','recenter-before','recenter-after'];
const escape=(v)=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function edgesFor(key){
 const dot=readFileSync(new URL('./'+key+'.dot',import.meta.url),'utf8');
 return [...dot.matchAll(/^\s*"([^"]+)"\s*->\s*"([^"]+)"/gm)].map(([,source,target])=>({source,target}));
}
function panel(engine,key){
 const output=data.engines[engine]?.[key];
 if(!output)throw Error('Missing layout: '+engine+'/'+key);
 const nodes=output.positions,byId=new Map(nodes.map(n=>[n.id,n]));
 const minX=Math.min(...nodes.map(n=>n.x-n.width/2))-24;
 const minY=Math.min(...nodes.map(n=>n.y-n.height/2))-24;
 const maxX=Math.max(...nodes.map(n=>n.x+n.width/2))+24;
 const maxY=Math.max(...nodes.map(n=>n.y+n.height/2))+24;
 const edgeSvg=edgesFor(key).map(({source,target})=>{
   const a=byId.get(source),b=byId.get(target);
   if(!a||!b)throw Error('Unresolved edge '+source+' -> '+target);
   return '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#8495a9" stroke-width="1.6"/>';
 }).join('');
 const nodeSvg=nodes.map(n=>{
   const star=n.width<30;
   const element=star
     ?'<circle cx="'+n.x+'" cy="'+n.y+'" r="'+Math.max(5,n.width/2)+'" fill="#92a9bc" stroke="#d6e3ed"/>'
     :'<rect x="'+(n.x-n.width/2)+'" y="'+(n.y-n.height/2)+'" width="'+n.width+'" height="'+n.height+'" rx="4" fill="'+(n.id==='N'||n.id==='E'&&key==='recenter-after'?'#275c87':'#28575b')+'" stroke="#b1d3d7" stroke-width="2"/>';
   return '<g><title>'+escape(n.id)+'</title>'+element+(star?'':'<text x="'+n.x+'" y="'+(n.y+3)+'" text-anchor="middle" font-size="11" fill="white">'+escape(n.id)+'</text>')+'</g>';
 }).join('');
 const meta=output.bounds.join(' × ')+' px; overlaps '+output.overlap.length+'; backward edges '+output.backwards+'; '+output.elapsedMs+' ms';
 return '<article><h3>'+escape(engine)+'</h3><p>'+escape(meta)+'</p><svg role="img" aria-label="'+escape(key+' '+engine)+'" viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'">'+edgeSvg+nodeSvg+'</svg></article>';
}
const html='<!doctype html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ChessView star-map layout comparison</title><style>body{background:#101923;color:#ebf0f5;font-family:system-ui,sans-serif;padding:20px;max-width:1600px;margin:auto}section{margin:32px 0}section>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}article{background:#1b2937;border-radius:10px;padding:14px;min-width:0}svg{width:100%;height:340px;background:#101b26;border-radius:7px}p{color:#abbaca;font-size:13px}h1,h2,h3{margin-bottom:8px}</style><h1>ChessView: ELK.js vs Dagre</h1><p>Actual mixed board/star layouts. Each circle is one canonical-position placeholder. Lines are drawn straight and do not assess routed edge geometry. These are synthetic topology fixtures, not real FEN exports.</p>'+names.map(k=>'<section><h2>'+escape(k)+'</h2><div>'+panel('elkjs',k)+panel('dagre',k)+'</div></section>').join('')+'</html>';
writeFileSync(new URL('./gallery.html',import.meta.url),html);
console.log('Wrote gallery.html');
