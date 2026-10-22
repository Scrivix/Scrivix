// Run from repository root: node matho-server/tests/add-question.cjs [question-set]
// Run from repository root: node matho-server/tests/simultaneous-winners.cjs [addition|exponents|multiplication|signed-multiplication]
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');global.crypto=require('crypto').webcrypto;const peers=new Map();const edition=process.argv[2]||'addition';const config=JSON.parse(fs.readFileSync('matho/sets/'+edition+'.json'));config.bank=JSON.parse(fs.readFileSync('matho/sets/'+config.bankFile));const enabledCount=config.bank.filter(q=>q.enabled).length;
class Link extends EventEmitter{constructor(){super();this.open=true;}send(m){setImmediate(()=>{if(this.other.open)this.other.emit('data',structuredClone(m));});}close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other.open){this.other.open=false;this.other.emit('close');}}}
class Peer extends EventEmitter{constructor(id){super();this.id=id||crypto.randomUUID();this.open=true;peers.set(this.id,this);setImmediate(()=>this.emit('open',this.id));}connect(id){const a=new Link(),b=new Link();a.other=b;b.other=a;setImmediate(()=>{peers.get(id).emit('connection',b);a.emit('open');});return a;}destroy(){this.destroyed=true;peers.delete(this.id);}reconnect(){}}
function context(file,name,options={}){const nodes=new Map(),store=new Map(options.session||[]),local=new Map(options.local||[]);const node=s=>{if(!nodes.has(s))nodes.set(s,{value:s.includes('Filter')?'all':'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},setAttribute(){},showModal(){},close(){}});return nodes.get(s)};const c={Peer,crypto,Uint8Array,Uint32Array,URL,URLSearchParams,structuredClone,console,Date,JSON,Set,Map,Promise,document:{querySelector:node,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},window:{addEventListener(){}},location:{href:'http://localhost:8765/game/'+file+'?set='+edition,search:'?set='+edition+(options.display?'&view=display':''),reload(){}},navigator:{clipboard:{writeText:async()=>{}}},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(f,n)=>n<500?setImmediate(f):0,clearTimeout(){},setInterval(){},confirm:()=>true,BroadcastChannel:class{postMessage(){}close(){}}};vm.createContext(c);c.config=config;vm.runInContext(fs.readFileSync('matho/game/question-set.js','utf8')+';globalThis.MATHO_SET=MathoQuestionSet.create(config,location.href);globalThis.DEFAULT_BANK=MATHO_SET.bank;',c);vm.runInContext(fs.readFileSync('matho/game/live-core.js','utf8')+'\n'+fs.readFileSync('matho/result-panel.js','utf8')+'\n'+fs.readFileSync('matho/auto-draw.js','utf8')+'\n'+fs.readFileSync('matho/call-sound.js','utf8')+'\n'+fs.readFileSync('matho/game/'+(file==='room.html'?'room.js':file==='index.html'?'app.js':'student.js'),'utf8'),c);c.node=node;c.store=store;c.local=local;c.run=s=>vm.runInContext(s,c);return c;}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate)};


(async()=>{
 const c=context('index.html'),before=c.run('state.bank.length');
 c.node('#newQuestionText').focus=()=>{};
 const submit=()=>c.run("$('#addQuestionForm').onsubmit({preventDefault(){}})");
 c.node('#newQuestionColumn').value='M';c.node('#newQuestionText').value='';c.node('#newAnswerText').value='';submit();assert.equal(c.run('state.bank.length'),before);
 c.run("state.called=[structuredClone(state.bank[0])]");
 const history=JSON.stringify(c.run('state.called')),originalIds=c.run('state.bank.map(q=>q.id)');
 c.node('#newQuestionText').value='11 + 12';c.node('#newAnswerText').value='23';submit();
 assert.equal(c.run('state.bank.length'),before+1);assert.equal(JSON.stringify(c.run('state.called')),history);
 const added=c.run("state.bank.find(q=>q.question==='11 + 12')");const grouped=c.run('state.bank');assert(grouped.slice(grouped.findIndex(q=>q.id===added.id)+1).every(q=>q.letter!=='M'));
 assert.equal(added.letter,'M');assert.equal(added.answer,'23');assert(added.enabled);assert(!originalIds.includes(added.id));
 assert.equal(c.node('#newQuestionText').value,'');assert.equal(c.node('#newAnswerText').value,'');assert.equal(c.node('#newQuestionColumn').value,'M');
 assert.equal(new Set(c.run('state.bank.map(q=>q.id)')).size,before+1);
 c.node('#newQuestionText').value='11+12';c.node('#newAnswerText').value='23';submit();assert.equal(c.run('state.bank.length'),before+1);
 c.node('#newQuestionColumn').value='Z';c.node('#newQuestionText').value='new';submit();assert.equal(c.run('state.bank.length'),before+1);
 c.node('#newQuestionColumn').value='T';c.node('#newQuestionText').value='x^2';c.node('#newAnswerText').value='x^2';submit();assert.equal(c.run('state.bank.length'),before+2);
 const saved=JSON.parse(c.local.get(c.run('KEY')));assert.equal(saved.bank.length,before+2);
 const reloaded=context('index.html',null,{local:[...c.local]});assert.equal(reloaded.run('state.bank.length'),before+2);
 // Authoring changes during a live room remain saved while that room's bank stays fixed.
 const t=context('room.html',null,{local:[...c.local]});t.run('start(true)');await flush();
 const activeCount=t.run('room.bank.length'),newBank=structuredClone(saved.bank);newBank.push({id:'O999',letter:'O',question:'9+9',answer:'18',enabled:true,note:''});
 t.local.set(t.run('CLASSIC'),JSON.stringify({...saved,bank:newBank}));t.run("$('#liveNext').onclick()");
 assert.equal(t.run('room.bank.length'),activeCount);
 assert.equal(JSON.parse(t.local.get(t.run('CLASSIC'))).bank.length,activeCount+1);
 assert(t.node('#editQuestionBank').href.endsWith('#bankSection'));
 console.log('PASS '+edition+': add question/column/answer; required fields and duplicate protection; unique IDs and grouping; existing calls preserved; browser save/reload; active room bank frozen; new edits survive host updates.');
})().catch(e=>{console.error(e);process.exit(1)});
