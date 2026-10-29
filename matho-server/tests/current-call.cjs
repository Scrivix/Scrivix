const fs=require('fs'),vm=require('vm'),assert=require('assert');
let current=[],queue=[],observers=[];
const ctx={window:{addEventListener(){}},document:{readyState:'complete',querySelectorAll:()=>current},getComputedStyle:el=>({fontSize:String(el.base)}),requestAnimationFrame:f=>queue.push(f),MutationObserver:class{constructor(f){observers.push(f)}observe(){}},ResizeObserver:class{observe(){}}};
ctx.window.ResizeObserver=ctx.ResizeObserver;vm.createContext(ctx);vm.runInContext(fs.readFileSync('matho/current-call.js','utf8'),ctx);
const api=ctx.window.MathoCurrentCall;
assert(api.content('\\text{5 less than a number}').includes('current-call-words'));assert(!api.content('\\text{5 less than a number}').includes('\\('));assert(api.content('x^{2}+4').includes('\\(x^{2}+4\\)'));assert(api.content('\\text{a < b}').includes('&lt;'));
function call(width,words,letters,base){const text={style:{},classList:{contains:()=>words},get clientWidth(){return width;},get scrollWidth(){return words?Math.min(width,letters*(parseFloat(this.style.fontSize)||base)*.55):letters*(parseFloat(this.style.fontSize)||base)*.55;},get scrollHeight(){const size=parseFloat(this.style.fontSize)||base;return words?Math.ceil(letters*size*.55/width)*size*1.2:size*1.2;}};return{base,clientWidth:width+64,querySelector:()=>text,text};}
const phrase=call(220,true,65,43),formula=call(130,false,35,46),short=call(350,true,10,43);current=[phrase,formula,short];
function flush(){while(queue.length)queue.shift()();}flush();
assert(parseFloat(phrase.text.style.fontSize)<43);assert(phrase.text.scrollHeight<=43*3.6+1);assert(formula.text.scrollWidth<=130+1);assert.equal(short.text.style.fontSize,'');
// Growing the layout must restore the preferred size rather than retain old shrinking.
current=[short];short.text.style.fontSize='12px';api.fitAll();flush();assert.equal(short.text.style.fontSize,'');
for(const file of ['index.html','room.html','join.html'])assert(fs.readFileSync('matho/game/'+file,'utf8').includes('../current-call.js?v=1'));
console.log('PASS phrase wrapping and shrink, formula width fit, short-call size, resize restoration, safe text escaping, and all three page integrations.');
