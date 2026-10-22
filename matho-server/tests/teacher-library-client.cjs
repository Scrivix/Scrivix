const fs=require('fs'),vm=require('vm'),assert=require('assert');
const boot=fs.readFileSync('matho/game/boot.js','utf8'),editor=fs.readFileSync('matho/library-editor.js','utf8');
const id='custom-'+'a'.repeat(32),bank=[{id:'M1',letter:'M',question:'one',answer:'1',enabled:true}],next=bank.concat({id:'M2',letter:'M',question:'two',answer:'2',enabled:true});
const cfg={id,title:'Private',copy:{},storagePrefix:'matho-'+id};
async function runBoot({page='caller',custom=true,saved,cloud=next,error,cached,credentials=true}={}){
 const map=new Map(),nodes={},requests=[],loads=[],backups=[];const key='matho-'+id+'-game-v1';
 if(saved)map.set(key,JSON.stringify(saved));if(cached)map.set(key+'-library-meta',JSON.stringify({config:cfg,libraryId:'lib'}));
 const location={href:'https://scrivix.us/matho/game/?set='+(custom?id:'addition'),search:'?set='+(custom?id:'addition')};
 const body={dataset:{page},classList:{add(){}},removeAttribute(){},append(script){loads.push(script.src.href||script.src);queueMicrotask(()=>script.onload?.());}};
 const document={currentScript:{src:'https://scrivix.us/matho/game/boot.js'},body,querySelector:s=>nodes[s]||(nodes[s]={append(){}}),querySelectorAll:()=>[],createElement:()=>({})};
 let validated=0,privateReads=0,publicReads=0;
 const context={URL,URLSearchParams,location,document,localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},MathoQuestionSet:{create:config=>({config,bank:config.bank})},MathoRules:{validateBank(){validated++;}},MathoLibrary:{credentials:()=>credentials?{id:'lib'}:null,async read(){privateReads++;if(error)throw error;return{config:{...cfg},bank:cloud,revision:3};},async publicConfig(){publicReads++;return {...cfg};},backup(...args){backups.push(args);}},fetch:async url=>{requests.push(String(url));return {ok:true,json:async()=>String(url).includes('bank')?bank:{id:'addition',title:'Addition',copy:{},bankFile:'addition-bank.json'}};},console};
 vm.createContext(context);await vm.runInContext(boot,context);
 return {context,map,nodes,requests,loads,validated,privateReads,publicReads,backups};
}
(async()=>{
 let r=await runBoot({page:'student',custom:true,credentials:false});assert.equal(r.privateReads,0);assert.equal(r.publicReads,1);assert.equal(r.context.DEFAULT_BANK,undefined);assert(!r.loads.some(x=>String(x).includes('library-editor')));
 r=await runBoot({page:'student',custom:false,credentials:false});assert.equal(r.requests.length,1);assert(!r.requests.some(x=>x.includes('bank.json')));
 r=await runBoot({custom:false});assert.equal(r.requests.length,2);assert.equal(r.validated,1);assert(r.loads.some(x=>String(x).includes('app.js?v=simple-library-1')));
 r=await runBoot({saved:{bank,called:[],libraryRevision:2,libraryDirty:true}});assert.equal(r.context.DEFAULT_BANK.length,1);assert.equal(r.context.MATHO_SET.config.libraryRevision,2,'Pending local draft retains its original revision');
 r=await runBoot({saved:{bank,called:[],libraryRevision:2,libraryDirty:false}});assert.equal(r.context.DEFAULT_BANK.length,2);assert.equal(r.backups.length,1);
 r=await runBoot({saved:{bank,called:[],libraryRevision:2},cached:true,error:Error('offline')});assert.equal(r.context.DEFAULT_BANK.length,1);assert(r.context.MATHO_SET.config.libraryOffline);
 r=await runBoot({saved:{bank,called:[],libraryRevision:2},cached:true,error:Object.assign(Error('denied'),{status:403})});assert.equal(r.context.document.body.dataset.loading,'error','Rejected credentials cannot use a cached teacher bank');
 r=await runBoot({cloud:[]});assert.equal(r.context.DEFAULT_BANK.length,0,'Unfinished set opens in editor');
 const listeners={},nodes={},map=new Map(),timers=[],updates=[],copies=[];
 let state={bank:structuredClone(bank),called:[],libraryRevision:1,libraryDirty:false};
 const query=s=>nodes[s]||(nodes[s]={insertBefore(){},textContent:'',disabled:false});
 const context={MathoLibrary:{update:async(id,revision,bank)=>{updates.push({revision,bank});return {revision:2};},credentials:()=>({}),backup(){},createSet:async(title,bank)=>{copies.push(structuredClone(bank));return{id:'copy'};},gameUrl:()=>new URL('https://scrivix.us/matho/game/?set=copy')},MATHO_SET:{config:{id,title:'Private',libraryRevision:1},bank},state,KEY:'bank',structuredClone,$:query,document:{createElement:()=>({})},window:{addEventListener:(name,fn)=>listeners[name]=fn},localStorage:{setItem:(k,v)=>map.set(k,v)},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},prompt:()=> 'My copy',location:{assign(){}},URL};
 vm.createContext(context);vm.runInContext(editor,context);
 state.bank.push(next[1]);listeners['matho-bank-saved']();assert(state.libraryDirty);await timers.at(-1)();assert.equal(updates[0].bank.length,2);assert.equal(state.libraryRevision,2);assert.equal(state.libraryDirty,false);
 context.MathoLibrary.update=async()=>{throw Object.assign(Error('changed on another device'),{status:409});};
 state.bank.push({id:'M3',letter:'M',question:'three',answer:'3',enabled:true});listeners['matho-bank-saved']();await timers.at(-1)();assert(state.libraryDirty);assert.equal(state.bank.length,3,'Conflict keeps the local draft');assert(query('#librarySaveStatus').textContent.includes('separate copy'));
 await query('#saveLibraryCopy').onclick();assert.equal(copies[0].length,3);assert.equal(state.bank.length,3);
 assert(!fs.readFileSync('matho/game/index.html','utf8').includes('restoreDefaultBank'));
 assert(!fs.readFileSync('matho/game/app.js','utf8').includes('restoreDefaultBank'));
 console.log('PASS: student loader privacy, online loading, offline drafts, stale-edit protection, empty draft editing, autosave, conflict retention, safe copy, and removal of destructive defaults button.');
})().catch(e=>{console.error(e);process.exit(1);});
