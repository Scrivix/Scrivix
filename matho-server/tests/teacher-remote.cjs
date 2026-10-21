// Run from repository root: node matho-server/tests/teacher-remote.cjs [question-set]
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');global.crypto=require('crypto').webcrypto;const peers=new Map();const edition=process.argv[2]||'addition';const config=JSON.parse(fs.readFileSync('matho/sets/'+edition+'.json'));config.bank=JSON.parse(fs.readFileSync('matho/sets/'+config.bankFile));const enabledCount=config.bank.filter(q=>q.enabled).length;
class Link extends EventEmitter{constructor(){super();this.open=true;}send(m){setImmediate(()=>{if(this.other.open)this.other.emit('data',structuredClone(m));});}close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other.open){this.other.open=false;this.other.emit('close');}}}
class Peer extends EventEmitter{constructor(id){super();this.id=id||crypto.randomUUID();this.open=true;peers.set(this.id,this);setImmediate(()=>this.emit('open',this.id));}connect(id){const a=new Link(),b=new Link();a.other=b;b.other=a;setImmediate(()=>{peers.get(id).emit('connection',b);a.emit('open');});return a;}destroy(){this.destroyed=true;peers.delete(this.id);}reconnect(){}}
function context(file,name,options={}){const nodes=new Map(),store=new Map(options.session||[]),local=new Map(options.local||[]);const node=s=>{if(!nodes.has(s))nodes.set(s,{value:s.includes('Filter')?'all':'',textContent:'',innerHTML:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},setAttribute(){},showModal(){},close(){}});return nodes.get(s)};const c={Peer,crypto,Uint8Array,Uint32Array,URL,URLSearchParams,structuredClone,console,Date,JSON,Set,Map,Promise,document:{querySelector:node,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},window:{addEventListener(){}},location:{href:'http://localhost:8765/game/'+file+'?set='+edition,search:'?set='+edition+(options.display?'&view=display':''),reload(){}},navigator:{clipboard:{writeText:async()=>{}}},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(f,n)=>n<500?setImmediate(f):0,clearTimeout(){},clearInterval(){},setInterval(){},confirm:()=>true,BroadcastChannel:class{postMessage(){}close(){}}};vm.createContext(c);c.config=config;vm.runInContext(fs.readFileSync('matho/game/question-set.js','utf8')+';globalThis.MATHO_SET=MathoQuestionSet.create(config,location.href);globalThis.DEFAULT_BANK=MATHO_SET.bank;',c);vm.runInContext(fs.readFileSync('matho/game/live-core.js','utf8')+'\n'+fs.readFileSync('matho/result-panel.js','utf8')+'\n'+fs.readFileSync('matho/auto-draw.js','utf8')+'\n'+fs.readFileSync('matho/call-sound.js','utf8')+'\n'+fs.readFileSync('matho/game/'+(file==='room.html'?'room.js':file==='index.html'?'app.js':'student.js'),'utf8'),c);c.node=node;c.store=store;c.local=local;c.run=s=>vm.runInContext(s,c);return c;}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate)};

(async()=>{
 const t=context('room.html');t.run('start(true)');await flush();t.run(fs.readFileSync('matho/vendor/qrcode.js','utf8'));
 t.run("$('#connectTeacherRemote').onclick()");await flush();
 const secret=t.run('room.remote.key'),relay=t.run('room.remote.relay');
 assert(/^matho-teacher-[-a-f0-9]{36}-v1-[A-Z2-9]{8}$/.test(relay));assert(t.node('#teacherQr').innerHTML.includes('<svg'));
 assert(t.node('#privateTeacherLink').href.includes('#relay='));assert(!JSON.stringify(JSON.parse(t.local.get(t.run('CLASSIC')))).includes(secret));
 const connect=async key=>{const p=new Peer(),messages=[];let c;p.on('open',()=>{c=p.connect(relay);c.on('open',()=>c.send({type:'teacher-hello',key}));c.on('data',m=>messages.push(m));});await flush();return {p,c,messages};};
 const wrong=await connect(crypto.randomUUID());assert(!wrong.messages.some(m=>m.role==='teacher-remote'));assert.equal(t.run('room.students.length'),0);
 const rem=await connect(secret);assert(rem.messages.some(m=>m.role==='teacher-remote'));assert(!JSON.stringify(rem.messages).includes(secret));
 const command=async(action,extra={},id=crypto.randomUUID())=>{const s=t.run('teacherSnapshot()');rem.c.send({type:'teacher-command',action,id,epoch:s.epoch,callCount:s.calls.length,...extra});await flush();return id;};
 const id=await command('next');assert.equal(t.run('room.calls.length'),1);
 // A duplicate command cannot draw twice, even when resent with the newest call count.
 await command('next',{},id);assert.equal(t.run('room.calls.length'),1);
 await command('lock');assert(t.run('room.locked'));await command('lock');assert(!t.run('room.locked'));
 const s=context('join.html');s.node('#codeInput').value=t.run('room.code');s.node('#nameInput').value='Student';s.run("$('#joinForm').onsubmit({preventDefault(){}})");await flush();
 assert.equal(t.run('room.students.length'),1);t.run("room.calls=room.bank.filter(q=>q.enabled);broadcast()");await flush();s.run("marks=[0,1,2,3,4];$('#claimBingo').onclick()");await flush();
 const student=t.run('room.students[0]');await command('check',{student:student.token,claimSeq:student.seq});assert(t.run('room.roundComplete'));assert.equal(s.run('game.feedback'),'valid');
 await command('review');assert(t.run('room.review'));await command('new-round');assert.equal(t.run('room.round'),2);assert(!t.run('room.roundComplete'));assert(!t.run('room.review'));
 await command('auto',{seconds:10});assert(t.run('autoTimer.running'));await command('auto',{seconds:10});assert(!t.run('autoTimer.running'));
 const savedKey=t.run('room.remote.key');assert.equal(savedKey,secret);assert(JSON.parse(t.store.get(t.run('SESSION'))).remote.key===secret);
 t.run("$('#disconnectTeacherRemote').onclick()");await flush();assert(!t.run('room.remote'));assert(rem.messages.some(m=>m.type==='remote-ended'));
 t.run("$('#connectTeacherRemote').onclick()");await flush();assert.notEqual(t.run('room.remote.key'),secret);
 assert.equal(t.run('room.students.length'),1);
 console.log('PASS '+edition+': private QR pairing; unauthorized requests denied without state; student and public-state isolation; remote draw/check/win/review/new round/timer; command replay ignored; key persistence and revocation.');
})().catch(e=>{console.error(e);process.exit(1)});
