
const assert=require('assert'),fs=require('fs');global.crypto=require('crypto').webcrypto;
const R=require(process.cwd()+'/matho/game/live-core.js');
const config=JSON.parse(fs.readFileSync('matho/sets/scientific-notation.json'));
const bank=JSON.parse(fs.readFileSync('matho/sets/'+config.bankFile));
function value(text){
 text=text.replaceAll('{,}','');
 const match=text.match(/^([0-9.]+) \\times 10\^\{(-?\d+)\}$/);
 let coefficient=match?match[1]:text,exponent=match?Number(match[2]):0;
 if(match)assert(Number(coefficient)>=1&&Number(coefficient)<10);
 assert(/^\d+(?:\.\d+)?$/.test(coefficient));
 const fraction=(coefficient.split('.')[1]||'').length;
 const shift=exponent-fraction,n=BigInt(coefficient.replace('.',''));
 return shift>=0?[n*10n**BigInt(shift),1n]:[n,10n**BigInt(-shift)];
}
assert.equal(bank.length,50);assert.equal(new Set(bank.map(q=>q.id)).size,50);assert(!config.bank);R.validateBank(bank);
for(const q of bank){const [a,b]=value(q.question),[c,d]=value(q.answer);assert.equal(a*d,c*b,q.id+' conversion');assert(q.enabled);assert(config.hints.student[q.letter]);}
for(const letter of R.LETTERS){const rows=bank.filter(q=>q.letter===letter);assert.equal(rows.length,10);assert.equal(new Set(rows.map(q=>R.canonical(q.answer))).size,10);for(const q of rows)assert.equal(q.answer.includes('\\times'),!['M','T'].includes(letter));}
assert(bank.some(q=>q.question.includes('10^{-')));assert(bank.some(q=>q.answer.includes('10^{-')));assert(bank.some(q=>q.question.includes('10^{2}')));
for(const q of bank.filter(q=>['M','T'].includes(q.letter)))assert(q.answer.length<=7);
const boards=[];for(let i=0;i<60;i++)boards.push(R.makeBoard(bank,boards));assert.equal(new Set(boards.map(b=>JSON.stringify(b))).size,60);
for(const [id,p]of Object.entries(R.PATTERNS))for(const line of p.sets)assert(R.isBingo(boards[0],line,bank,id));
const catalogue=JSON.parse(fs.readFileSync('matho/sets/index.json'));assert(catalogue.some(s=>s.slug===config.id&&s.joinPrefix==='SN'));assert.equal(new Set(catalogue.map(s=>s.joinPrefix)).size,catalogue.length);
console.log('PASS: 50 exact conversions, normalized scientific notation, both directions, large/small values, 10 unique answers per column, compact standard answers, 60 different boards, all winning patterns, and SN joining.');
