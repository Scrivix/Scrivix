// Run from repository root: node matho-server/tests/simultaneous-winners.cjs [addition|exponents|multiplication|signed-multiplication]
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');global.crypto=require('crypto').webcrypto;const peers=new Map();const edition=process.argv[2]||'addition';const config=JSON.parse(fs.readFileSync('matho/sets/'+edition+'.json'));config.bank=JSON.parse(fs.readFileSync('matho/sets/'+config.bankFile));config.id='custom-'+'a'.repeat(32);config.storagePrefix='matho-'+config.id;config.joinPrefix='CS';const registrations=[];const enabledCount=config.bank.filter(q=>q.enabled).length;
class Link extends EventEmitter{constructor(){super();this.open=true;}send(m){setImmediate(()=>{if(this.other.open)this.other.emit('data',structuredClone(m));});}close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other.open){this.other.open=false;this.other.emit('close');}}}
class Peer extends EventEmitter{constructor(id){super();this.id=id||crypto.randomUUID();this.open=true;peers.set(this.id,this);setImmediate(()=>this.emit('open',this.id));}connect(id){const a=new Link(),b=new Link();a.other=b;b.other=a;setImmediate(()=>{peers.get(id).emit('connection',b);a.emit('open');});return a;}destroy(){this.destroyed=true;peers.delete(this.id);}reconnect(){}}
function context(file,name,options={}){const nodes=new Map(),store=new Map(options.session||[]),local=new Map(options.local||[]);const node=s=>{if(!nodes.has(s))nodes.set(s,{value:s.includes('Filter')?'all':'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},prepend(){},setAttribute(){},showModal(){},close(){}});return nodes.get(s)};const c={MathoLibrary:{registerRoom:async(id,code)=>{registrations.push({id,code});if(options.collision&&registrations.length===1)throw Object.assign(Error('Code already reserved'),{status:409});}},Peer,crypto,Event,Uint8Array,Uint32Array,URL,URLSearchParams,structuredClone,console,Date,JSON,Set,Map,Promise,document:{querySelector:node,createElement:()=>({}),querySelectorAll:()=>[],body:{classList:{toggle(){}}}},window:{addEventListener(){},dispatchEvent(){}},location:{href:'http://localhost:8765/game/'+file+'?set='+edition,search:'?set='+edition+(options.display?'&view=display':''),reload(){}},navigator:{clipboard:{writeText:async()=>{}}},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(f,n)=>n<500?setImmediate(f):0,clearTimeout(){},setInterval(){},confirm:()=>true,BroadcastChannel:class{postMessage(){}close(){}}};vm.createContext(c);vm.runInContext(fs.readFileSync('matho/visible-clock.js','utf8'),c);c.config=config;vm.runInContext(fs.readFileSync('matho/game/question-set.js','utf8')+';globalThis.MATHO_SET=MathoQuestionSet.create(config,location.href);globalThis.DEFAULT_BANK=MATHO_SET.bank;',c);vm.runInContext(fs.readFileSync('matho/game/live-core.js','utf8')+'\n'+fs.readFileSync('matho/result-panel.js','utf8')+'\n'+fs.readFileSync('matho/auto-draw.js','utf8')+'\n'+fs.readFileSync('matho/call-sound.js','utf8')+'\n'+fs.readFileSync('matho/game/'+(file==='room.html'?'room.js':file==='index.html'?'app.js':'student.js'),'utf8'),c);c.node=node;c.store=store;c.local=local;c.run=s=>vm.runInContext(s,c);return c;}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate)};


(async()=>{
 let t=context('room.html');t.run('start(true)');await flush();const code=t.run('room.code');
 const s=context('join.html');s.node('#codeInput').value=code;s.node('#nameInput').value='Student';s.run("$('#joinForm').onsubmit({preventDefault(){}})");await flush();
 function callRow(){t.run("room.calls=room.students[0].board.slice(0,5).map(square=>room.bank.find(q=>q.enabled&&q.letter===square.letter&&q.answer===square.answer));broadcast()");}
 callRow();await flush();
 async function claim(marks){s.testMarks=marks;s.run("marks=testMarks;send({type:'claim',epoch:game.epoch,pattern:game.pattern,marks,seq:++seq})");await flush();}
 await claim(Array.from({length:25},(_,i)=>i));
 assert.equal(t.run('room.students[0].failedClaims'),1,'Blanket marking fails even with a genuinely called line');
 assert.equal(t.run('room.students[0].claim'),null);assert(!t.run('room.roundComplete'));
 await claim(Array.from({length:25},(_,i)=>i));assert.equal(t.run('room.students[0].failedClaims'),1,'Repeated identical claim is not counted twice');
 await claim([0,1,2,3,4,5]);assert.equal(t.run('room.students[0].failedClaims'),2);
 await claim([0,1,2,3,4,6]);assert.equal(t.run('room.students[0].failedClaims'),3);
 assert(s.run('game.claimLocked'));assert(!s.run('canClaim()'));assert(s.node('#clearMarks').disabled);
 const lockedMarks=t.run('JSON.stringify(room.students[0].marks)');
 s.run("send({type:'marks',epoch:game.epoch,marks:[0,1,2,3,4],seq:++seq});send({type:'claim',epoch:game.epoch,pattern:game.pattern,marks:[0,1,2,3,4],seq:++seq})");await flush();
 assert.equal(t.run('JSON.stringify(room.students[0].marks)'),lockedMarks,'Host rejects forged edits and claims while locked');
 const saved=[...t.store];t.run('peer.destroy()');t=context('room.html',null,{session:saved});await flush();
 s.run('joining=false;connect()');await flush();assert(s.run('game.claimLocked'));assert.equal(t.run('room.students[0].failedClaims'),3,'Reload/rejoin does not reset attempts');
 t.run('resetRound()');await flush();assert.equal(t.run('room.students[0].failedClaims'),0);assert(!s.run('game.claimLocked'));
 callRow();await flush();await claim([0,1,2,3,4]);assert(t.run('room.students[0].claim'),'A genuinely correct claim is submitted normally');
 t.run("$('#roster').onclick({target:{closest(sel){return sel==='[data-check]'?{dataset:{check:room.students[0].token}}:null}}})");await flush();
 assert.equal(t.run('room.students[0].feedback'),'valid');assert.equal(t.run('room.students[0].failedClaims'),0);
 const remoteSource=fs.readFileSync('matho/game/remote.js','utf8'),sortLine=remoteSource.split('\n').find(l=>l.includes('function sortRemoteRoster('));
 const sortContext={};vm.createContext(sortContext);vm.runInContext(sortLine,sortContext);
 const roster=[{name:'Zoe',marks:[1,2],claim:null},{name:'Amy',marks:[],claim:null},{name:'Ben',marks:[],claim:{}}];
 assert.equal(sortContext.sortRemoteRoster(roster,'name').map(s=>s.name).join(','),'Ben,Amy,Zoe');
 assert.equal(sortContext.sortRemoteRoster(roster,'marks').map(s=>s.name).join(','),'Ben,Zoe,Amy');
 console.log('PASS blanket-mark rejection, three-attempt lock, duplicate suppression, forged-action rejection, reload/rejoin persistence, automatic New Round reset, genuine wins, and iPad roster sorting with callers first.');
})().catch(e=>{console.error(e);process.exit(1)});
