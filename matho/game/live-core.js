/* Shared game rules. The teacher owns board assignments and claim validation. */
(function(root){
const LETTERS=['M','A','T','H','O'];
const canonical=s=>String(s).replace(/\\(?:left|right)/g,'').replace(/[\s{}]/g,'');
function shuffled(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=Math.floor(n[0]/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function choices(bank,letter){const seen=new Set();return bank.filter(q=>q.enabled&&q.letter===letter).filter(q=>{const key=canonical(q.answer);if(seen.has(key))return false;seen.add(key);return true;});}
function validateBank(bank){for(const letter of LETTERS){if(choices(bank,letter).length<(letter==='T'?4:5))throw Error('Column '+letter+' needs at least '+(letter==='T'?4:5)+' different enabled answers.');}}
function makeBoard(bank,existing=[]){validateBank(bank);for(let attempt=0;attempt<100;attempt++){const columns=LETTERS.map(l=>shuffled(choices(bank,l)).slice(0,l==='T'?4:5));const board=[];for(let row=0;row<5;row++)for(let col=0;col<5;col++){if(row===2&&col===2)board.push({letter:'T',answer:'FREE',free:true});else{const q=columns[col].shift();board.push({letter:LETTERS[col],answer:q.answer});}}const signature=board.map(s=>s.answer).join('|');if(!existing.some(b=>b.map(s=>s.answer).join('|')===signature))return board;}throw Error('Could not create a different board. Try again.');}
const lines=[];for(let r=0;r<5;r++)lines.push(Array.from({length:5},(_,c)=>r*5+c));for(let c=0;c<5;c++)lines.push(Array.from({length:5},(_,r)=>r*5+c));lines.push([0,6,12,18,24],[4,8,12,16,20]);
const PATTERNS={
rows:{label:'Any row',description:'Complete one horizontal row.',sets:lines.slice(0,5),sample:lines[0]},
columns:{label:'Any column',description:'Complete one vertical column.',sets:lines.slice(5,10),sample:lines[5]},
diagonals:{label:'Either diagonal',description:'Complete either corner-to-corner diagonal.',sets:lines.slice(10),sample:lines[10]},
plus:{label:'Plus sign',description:'Complete the middle row and middle column.',sets:[[2,7,10,11,12,13,14,17,22]],sample:[2,7,10,11,12,13,14,17,22]},
diamond:{label:'Diamond',description:'Complete the eight-square diamond around the center.',sets:[[2,6,8,10,14,16,18,22]],sample:[2,6,8,10,14,16,18,22]},
lettert:{label:'Letter T',description:'Complete the top row and middle column.',sets:[[0,1,2,3,4,7,12,17,22]],sample:[0,1,2,3,4,7,12,17,22]},
letterl:{label:'Letter L',description:'Complete the left column and bottom row.',sets:[[0,5,10,15,20,21,22,23,24]],sample:[0,5,10,15,20,21,22,23,24]},
frame:{label:'Outside frame',description:'Complete every square along the outside edge.',sets:[Array.from({length:25},(_,i)=>i).filter(i=>i<5||i>19||i%5===0||i%5===4)],sample:Array.from({length:25},(_,i)=>i).filter(i=>i<5||i>19||i%5===0||i%5===4)},
normal:{label:'Normal bingo',description:'Any complete row, column, or diagonal. The center is free.',sets:lines,sample:[0,1,2,3,4]},
corners:{label:'Four corners',description:'Mark all four outer corner squares.',sets:[[0,4,20,24]],sample:[0,4,20,24]},
stamp:{label:'Postage stamp',description:'A complete 2 × 2 block in any one of the four corners.',sets:[[0,1,5,6],[3,4,8,9],[15,16,20,21],[18,19,23,24]],sample:[3,4,8,9]},
x:{label:'X pattern',description:'Complete both diagonals to make an X. The center is free.',sets:[[0,4,6,8,12,16,18,20,24]],sample:[0,4,6,8,12,16,18,20,24]},
full:{label:'Full board',description:'Mark every square on your board. The center is free.',sets:[Array.from({length:25},(_,i)=>i)],sample:Array.from({length:25},(_,i)=>i)}
};
function pattern(id){if(Array.isArray(id)){if(id.length===1&&PATTERNS[id[0]])return PATTERNS[id[0]];const ps=id.filter(k=>PATTERNS[k]).map(k=>PATTERNS[k]);return {label:ps.map(p=>p.label).join(' OR '),description:'Complete either winning pattern.',sets:ps.flatMap(p=>p.sets),sample:ps[0]?.sample||[]};}return PATTERNS[id]||PATTERNS.normal;}
function patternDiagram(id){if(Array.isArray(id)&&id.length===1)return patternDiagram(id[0]);if(Array.isArray(id))return '<div class="pattern-options">'+id.filter(k=>PATTERNS[k]).map(k=>'<div>'+patternDiagram(k)+'<strong>'+PATTERNS[k].label+'</strong></div>').join('')+'</div>';const p=pattern(id);return '<div class="pattern-diagram" aria-hidden="true">'+Array.from({length:25},(_,i)=>'<span class="'+(p.sample.includes(i)?'target':'')+'"></span>').join('')+'</div>';}
function cleanMarks(marks){return Array.isArray(marks)?[...new Set(marks.filter(n=>Number.isInteger(n)&&n>=0&&n<25&&n!==12))].sort((a,b)=>a-b):[];}
function hasMarkedPattern(marks,patternId='normal'){if(Array.isArray(patternId))return patternId.some(id=>hasMarkedPattern(marks,id));if(!PATTERNS[patternId])return false;const selected=new Set(cleanMarks(marks));selected.add(12);return PATTERNS[patternId].sets.some(line=>line.every(i=>selected.has(i)));}
function isBingo(board,marks,calls,patternId='normal'){if(Array.isArray(patternId))return patternId.some(id=>isBingo(board,marks,calls,id));if(!Array.isArray(board)||board.length!==25||!PATTERNS[patternId])return false;const selected=new Set(cleanMarks(marks));selected.add(12);const called=new Set(calls.map(c=>c.letter+':'+canonical(c.answer)));return PATTERNS[patternId].sets.some(line=>line.every(i=>selected.has(i)&&(board[i].free||called.has(board[i].letter+':'+canonical(board[i].answer)))));}
function reviewBoard(board,marks,calls){const selected=new Set(cleanMarks(marks)),called=new Set(calls.map(c=>c.letter+':'+canonical(c.answer))),incorrect=[],missed=[];board.forEach((s,i)=>{if(s.free)return;const matches=called.has(s.letter+':'+canonical(s.answer));if(selected.has(i)&&!matches)incorrect.push(i);if(!selected.has(i)&&matches)missed.push(i);});return {incorrect,missed};}
function incorrectMarkCount(board,marks,calls){const called=new Set(calls.map(c=>c.letter+':'+canonical(c.answer)));return cleanMarks(marks).filter(i=>board[i]&&!board[i].free&&!called.has(board[i].letter+':'+canonical(board[i].answer))).length;}
const api={LETTERS,canonical,shuffled,choices,validateBank,makeBoard,lines,PATTERNS,pattern,patternDiagram,cleanMarks,hasMarkedPattern,isBingo,reviewBoard,incorrectMarkCount};root.MathoRules=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
