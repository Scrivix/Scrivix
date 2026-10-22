
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
assert.equal(bank.length,38);assert.equal(new Set(bank.map(q=>q.id)).size,38);assert(!config.bank);R.validateBank(bank);
for(const q of bank){const [a,b]=value(q.question),[c,d]=value(q.answer);assert.equal(a*d,c*b,q.id+' conversion');assert(q.enabled);assert(config.hints.student[q.letter]);}
for(const letter of R.LETTERS){const rows=bank.filter(q=>q.letter===letter);const expected={M:6,A:8,T:6,H:8,O:10}[letter];assert.equal(rows.length,expected);assert.equal(new Set(rows.map(q=>R.canonical(q.answer))).size,expected);const coefficients=new Set(rows.map(q=>(['M','T'].includes(letter)?q.question:q.answer).match(/^([0-9.]+) /)[1]));assert.equal(coefficients.size,1,'Every answer option must share the same coefficient in '+letter);for(const q of rows)assert.equal(q.answer.includes('\\times'),!['M','T'].includes(letter));}
assert(bank.some(q=>q.question.includes('10^{-')));assert(bank.some(q=>q.answer.includes('10^{-')));assert(bank.some(q=>q.question.includes('10^{2}')));
for(const q of bank.filter(q=>['M','T'].includes(q.letter)))assert(q.answer.length<=8);
const boards=[];for(let i=0;i<60;i++)boards.push(R.makeBoard(bank,boards));assert.equal(new Set(boards.map(b=>JSON.stringify(b))).size,60);
for(const [id,p]of Object.entries(R.PATTERNS))for(const line of p.sets)assert(R.isBingo(boards[0],line,bank,id));
const catalogue=JSON.parse(fs.readFileSync('matho/sets/index.json'));assert(catalogue.some(s=>s.slug===config.id&&s.joinPrefix==='SN'));assert.equal(new Set(catalogue.map(s=>s.joinPrefix)).size,catalogue.length);
console.log('PASS: 38 exact conversions with shared coefficients, normalized scientific notation, both directions, large/small values, unique answers per column, compact standard answers, 60 different boards, all winning patterns, and SN joining.');
