import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptedStarMapProjection } from '../src/star-map-preview.ts';

test('star-map preview projects accepted canonical topology without new selection', () => {
  const center='8/8/8/8/8/8/8/K6k w - -';
  const a='8/8/8/8/8/8/8/K5k1 b - -';
  const b='8/8/8/8/8/8/8/K4k2 b - -';
  const merge='8/8/8/8/8/8/8/K3k3 w - -';
  const graph={nodes:[
    {key:a,relation:'outgoing',distance:1,families:['line-a']},
    {key:b,relation:'outgoing',distance:1,families:['line-b']},
    {key:merge,relation:'descendant',distance:2,families:['line-a','line-b'],merge:true},
  ],relationships:[
    {id:'ca',source:center,target:a,edge:{san:'Ka2'},families:['line-a']},
    {id:'cb',source:center,target:b,edge:{san:'Kb2'},families:['line-b']},
    {id:'am',source:a,target:merge,edge:{san:'Ka3'},families:['line-a']},
    {id:'bm',source:b,target:merge,edge:{san:'Kb3'},families:['line-b']},
  ]};
  const view={center,mode:'lines',structure:{status:'ready',value:{composition:graph}}};
  const result=acceptedStarMapProjection(view as any);
  assert.ok(result);
  assert.equal(result.nodes.length,4);
  assert.equal(new Set(result.nodes.map(n=>n.key)).size,4);
  assert.equal(result.edges.length,4);
  assert.equal(result.edges.filter(e=>e.target===merge).length,2);
  assert.equal(result.nodes.find(n=>n.key===merge)?.merge,true);
  assert.equal(acceptedStarMapProjection({...view,structure:{status:'loading',value:null}} as any),null);
});
