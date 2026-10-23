const assert=require('node:assert/strict'),fs=require('node:fs');
global.crypto=require('node:crypto').webcrypto;
const R=require('../../matho/game/live-core.js');
const bank=JSON.parse(fs.readFileSync('matho/sets/decimal-subtraction-bank.json'));
const config=JSON.parse(fs.readFileSync('matho/sets/decimal-subtraction.json'));
const catalogue=JSON.parse(fs.readFileSync('matho/sets/index.json'));
assert.equal(config.bankFile,'decimal-subtraction-bank.json');assert.equal(bank.length,50);
assert.equal(catalogue.filter(s=>s.slug===config.id).length,1);
assert.equal(new Set(catalogue.map(s=>s.joinPrefix)).size,catalogue.length);
const cents=s=>{assert.match(s,/^\d\.\d{2}$/);return Number(s.replace('.',''));};
for(const q of bank){
 const parts=q.question.split(' - ');assert.equal(parts.length,2);
 const [a,b]=parts.map(cents);assert(a>=b);assert.equal(cents(q.answer),a-b);
 const hundredths=a%10<b%10,tenths=Math.floor(a/10)%10,borrowOnes=tenths-Number(hundredths)<Math.floor(b/10)%10;
 const category=!hundredths&&!borrowOnes?'M':hundredths&&!borrowOnes?'A':!hundredths&&borrowOnes?'T':tenths===0?'O':'H';
 assert.equal(q.letter,category,q.id);
}
for(const l of 'MATHO'){const qs=bank.filter(q=>q.letter===l);assert.equal(qs.length,10);assert.equal(new Set(qs.map(q=>q.answer)).size,10);}
R.validateBank(bank);
const boards=[];for(let i=0;i<60;i++)boards.push(R.makeBoard(bank,boards));
assert.equal(new Set(boards.map(b=>b.map(s=>s.answer).join('|'))).size,60);
for(const b of boards){assert.equal(b.length,25);assert(b[12].free);assert(R.isBingo(b,Array.from({length:25},(_,i)=>i).filter(i=>i!==12),bank,'full'));}
console.log('PASS 50 exact decimal answers, nonnegative results, borrowing progression, distinct answers, catalogue and 60 unique playable boards.');
