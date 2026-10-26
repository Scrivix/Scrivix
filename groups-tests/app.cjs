const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto').webcrypto;
const html=fs.readFileSync('groups/index.html','utf8'),validIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])),storage=new Map(),copied=[];
class Node{constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.value='';this.hidden=false;this.checked=false;this.textContent='';}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,f){this.listeners[k]=f;}focus(){}select(){}showModal(){this.open=true;}close(){this.open=false;}}
function app(){
 const nodes=new Map(),radios=[new Node('input'),new Node('input')];radios[0].value='groups';radios[0].checked=true;radios[1].value='size';
 const get=id=>{assert(validIds.has(id),'HTML contains #'+id);if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 get('amount').value='4';const classes=new Set(),body={classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},add:k=>classes.add(k),remove:k=>classes.delete(k)}};
 const context={ScrivixGroups:require('../groups/core.js'),crypto,Uint32Array,console,document:{getElementById:get,body,createElement:t=>new Node(t),querySelectorAll:()=>radios,addEventListener(){},querySelector:s=>s.includes(':checked')?radios.find(r=>r.checked):s.includes('value="size"')?radios[1]:new Node()},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{print(){context.printed=true;},scrollTo(){}},navigator:{clipboard:{writeText:async t=>copied.push(t)}},setTimeout(){},confirm:()=>true};
 vm.createContext(context);vm.runInContext(fs.readFileSync('groups/app.js','utf8'),context);return{get,context,classes};
}
(async()=>{
 let a=app();a.get('names').value='Ada\nBen\nCam\nDee\nEli\nFran\nGus\nHana';a.get('namesForm').onsubmit({preventDefault(){}});
 assert.equal(a.get('roster').children.length,8);a.get('generate').onclick();assert.equal(a.get('groups').children.length,4);
 a.get('balance').checked=true;a.get('balance').onchange();a.get('generate').onclick();assert(a.get('formStatus').textContent.includes('every student'));
 a.get('roster').children.forEach((row,i)=>{const select=row.children[1];select.value=['A','B','C','F'][i%4];select.closest=()=>row;a.get('roster').listeners.change({target:select});});
 a.get('generate').onclick();assert.equal(a.get('groups').children.length,4);assert(a.get('resultSummary').textContent.includes('8 students'));assert(!a.get('balanceNote').hidden);
 await a.get('copy').onclick();assert(copied[0].includes('Ada'));assert(!copied[0].includes('grade'));assert(!copied[0].includes('A–F'));
 a.get('present').onclick();assert(a.classes.has('presenting'));a.get('exitPresent').onclick();assert(!a.classes.has('presenting'));
 a.get('remember').checked=true;a.get('remember').onchange();assert(storage.size);
 a=app();assert.equal(a.get('roster').children.length,8);assert(a.get('remember').checked);assert(a.get('balance').checked);
 a.get('remember').checked=false;a.get('remember').onchange();assert.equal(storage.size,0);
 a.get('clearClass').onclick();assert.equal(a.get('roster').children.length,0);
 assert(!/fetch\(|XMLHttpRequest|sendBeacon/.test(fs.readFileSync('groups/app.js','utf8')),'Names and grades have no network submission');
 console.log('PASS add names, random generation, missing-grade validation, tablet change events, balanced generation, names-only copy, presentation mode, opt-in local saving/restoration/removal, clear list, and no data uploads.');
})().catch(e=>{console.error(e);process.exit(1)});
