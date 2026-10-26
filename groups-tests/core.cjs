const assert=require('node:assert/strict'),G=require('../groups/core.js');
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const grades=['A','B','C','D','F'];
const people=n=>Array.from({length:n},(_,i)=>({id:i,name:'Student '+i,grade:grades[i%5]}));
function valid(result,input,mode,amount){
 assert.equal(result.flat().length,input.length);assert.equal(new Set(result.flat().map(p=>p.id)).size,input.length);
 assert.deepEqual(result.flat().map(p=>p.id).sort((a,b)=>a-b),input.map(p=>p.id).sort((a,b)=>a-b));
 const sizes=result.map(g=>g.length);assert(Math.max(...sizes)-Math.min(...sizes)<=1);assert(sizes.every(n=>n>0));
 if(mode==='groups')assert.equal(result.length,amount);else assert(sizes.every(n=>n<=amount));
}
for(let n=1;n<=65;n++)for(const balanced of [false,true])for(const mode of ['groups','size']){
 const amount=mode==='groups'?Math.min(n,7):4,input=people(n),snapshot=JSON.stringify(input);
 valid(G.generate(input,{mode,amount,balanced,rng:rng(n)}),input,mode,amount);assert.equal(JSON.stringify(input),snapshot,'Input remains unchanged');
}
const mixed=Array.from({length:6},()=>grades).flat().map((grade,i)=>({id:i,name:'Name '+i,grade}));
const groups=G.generate(mixed,{mode:'groups',amount:6,balanced:true,rng:rng(42)});
for(const g of groups)assert.deepEqual(g.map(p=>p.grade).sort(),grades.slice().sort(),'Each group gets all five learning bands when feasible');
assert.throws(()=>G.generate(people(3),{amount:4}),/no more groups/);
assert.throws(()=>G.generate([]),/at least one/);
assert.throws(()=>G.generate([{name:'Name',grade:''}],{amount:1,balanced:true}),/every student/);
assert.equal(G.generate([{id:0,name:'Name',grade:''}],{amount:1})[0][0].name,'Name','Random mode does not require a grade');
assert.throws(()=>G.generate([{name:'',grade:'A'}],{amount:1}),/every student a name/);
assert.deepEqual(G.parseNames(' 1. Ada\r\n\n- Ben\n • Cam \nDoe, Jane'),['Ada','Ben','Cam','Doe, Jane']);
const duplicateNames=[{id:0,name:'Sam',grade:'A'},{id:1,name:'Sam',grade:'F'}];assert.equal(G.generate(duplicateNames,{amount:1}).flat().length,2,'Identical names are not silently deleted');
const text=G.text([[{name:'Ada',grade:'A'},{name:'Ben',grade:'F'}]]);assert.equal(text,'Group 1\nAda\nBen');assert(!text.includes('grade'));
const first=G.generate(people(30),{amount:5,rng:rng(1)}),second=G.generate(people(30),{amount:5,rng:rng(2)});assert.notDeepEqual(first,second);
const many=people(200),start=Date.now();valid(G.generate(many,{amount:8,balanced:true,rng:rng(3)}),many,'groups',8);
console.log('PASS 260 class/mode/balance combinations, unique assignments, even capacities, six mixed-grade groups, validation, duplicate names, names-only copying, shuffle variation, and 200-student class ('+(Date.now()-start)+'ms).');
