const assert=require('assert');global.crypto=require('crypto').webcrypto;const R=require('../../matho/game/live-core.js'),P=require('../../matho/game/party-core.js');
for(let n=2;n<=60;n++){
 const tokens=Array.from({length:n},(_,i)=>'student-'+i),groups=P.group(tokens),flat=groups.flat();assert.equal(flat.length,n);assert.equal(new Set(flat).size,n);assert(groups.every(g=>g.length===2||g.length===3));assert.equal(groups.filter(g=>g.length===3).length,n%2);
 const next=P.group(tokens,P.pairs(groups));if(n===4||n===6)assert.equal(P.pairs(next).filter(p=>P.pairs(groups).includes(p)).length,0);
}
const board=Array.from({length:25},(_,i)=>({letter:R.LETTERS[i%5],answer:String(i),free:i===12})),calls=board.slice();
for(const [id,p]of Object.entries(R.PATTERNS)){const marks=p.sample.filter(i=>i!==12);assert(R.hasMarkedPattern(marks,id),id);assert(R.isBingo(board,marks,calls,id),id);assert(!R.isBingo(board,marks.slice(1),calls,id),id+' incomplete');}
const hidden={pattern:'plus',mysteryEnabled:true,secretPattern:'corners',mysteryRevealed:false};assert.deepEqual(P.active(hidden),['plus']);hidden.mysteryRevealed=true;assert.deepEqual(P.active(hidden),['plus','corners']);assert(R.hasMarkedPattern([0,4,20,24],P.active(hidden)));assert(R.isBingo(board,[0,4,20,24],calls,P.active(hidden)));assert(R.pattern(P.active(hidden)).label.includes(' OR '));assert(R.patternDiagram(P.active(hidden)).includes('Four corners'));
for(const primary of Object.keys(R.PATTERNS))for(const candidate of Object.keys(R.PATTERNS)){
 const canMatter=primary!==candidate&&R.PATTERNS[candidate].sets.some(set=>!R.hasMarkedPattern(set,primary));
 assert.equal(P.compatible(primary,candidate),canMatter,primary+' / '+candidate);
}
for(const candidate of ['x','plus','letterl','lettert','frame','full','rows','columns','diagonals'])assert(!P.compatible('normal',candidate),candidate);
for(const candidate of ['corners','stamp','diamond'])assert(P.compatible('normal',candidate),candidate);
assert(P.compatible('diagonals','normal'),'Some normal-bingo paths still add a new way to win');assert(!P.compatible('corners','x'));assert(P.compatible('full','x'));assert(!P.compatible('normal','invalid'));
console.log('PASS all 13 patterns and incomplete lines, OR validation, mystery secrecy, 2–60 player pair/trio assignments, and repeat avoidance when feasible.');
