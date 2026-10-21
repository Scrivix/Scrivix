
const fs=require('fs'),vm=require('vm'),assert=require('assert'),{EventEmitter}=require('events');
const nodes=new Map(),commands=[],timers=[],peers=[];let clock=Date.now(),watchdog,beat=0;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'30',hidden:false,textContent:'',innerHTML:'',disabled:false,setAttribute(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
class Link extends EventEmitter{constructor(){super();this.open=true;}send(m){commands.push(m);}close(){this.open=false;this.emit('close');}}
class Peer extends EventEmitter{constructor(){super();peers.push(this);queueMicrotask(()=>this.emit('open'));}connect(){this.link=new Link();queueMicrotask(()=>this.link.emit('open'));return this.link;}destroy(){this.destroyed=true;this.link?.close();}}
const R=require(process.cwd()+'/matho/game/live-core.js'),crypto=require('crypto').webcrypto,key=crypto.randomUUID(),relay='matho-teacher-'+crypto.randomUUID()+'-v1-MUABC234';
const context={Peer,MathoRules:R,crypto,URLSearchParams,console,Date:{now:()=>clock},JSON,Set,Map,Promise,
document:{getElementById:node,querySelectorAll:()=>[],activeElement:null},window:{addEventListener(){}},location:{hash:'#'+new URLSearchParams({relay,key})},
confirm:()=>true,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:fn=>{watchdog=fn;}};vm.createContext(context);
(async()=>{
 vm.runInContext(fs.readFileSync('matho/game/remote.js','utf8'),context);await new Promise(setImmediate);
 assert.equal(commands[0].type,'teacher-hello');assert.equal(commands[0].key,key);
 const conn=peers.at(-1).link;
 const state={type:'state',role:'teacher-remote',code:'MUABC234',epoch:crypto.randomUUID(),round:1,pattern:'normal',calls:[],students:[],remaining:89,locked:false,roundComplete:false,review:false,timer:{running:false,seconds:30,secondsLeft:30}};
 state.heartbeat='host:'+ (++beat);conn.emit('data',state);assert.equal(node('remoteMain').hidden,false);assert.equal(node('remoteNext').disabled,false);
 node('remoteNext').onclick();assert.equal(commands.at(-1).action,'next');assert(!commands.at(-1).key);
 state.students=[{token:crypto.randomUUID(),name:'Ada',board:Array.from({length:25},(_,i)=>({letter:'M',answer:String(i),free:i===12})),marks:[0,1,2,3,4],seq:5,claim:{marks:[0,1,2,3,4]},feedback:'',connected:true}];state.heartbeat='host:'+ (++beat);conn.emit('data',state);
 node('remoteRoster').onclick({target:{closest:s=>s==='[data-check]'?{dataset:{check:state.students[0].token}}:null}});
 assert.equal(commands.at(-1).action,'check');assert.equal(commands.at(-1).claimSeq,5);
 node('remoteRoster').onclick({target:{closest:s=>s==='[data-inspect]'?{dataset:{inspect:state.students[0].token}}:null}});assert(node('remoteInspect').open);assert(node('remoteInspectBoard').innerHTML.includes('aria-pressed="true"'));
 state.roundComplete=true;state.heartbeat='host:'+ (++beat);conn.emit('data',state);assert(node('remoteNext').disabled);assert(node('remoteReview').disabled);
 state.students[0].claim=null;state.heartbeat='host:'+ (++beat);conn.emit('data',state);assert(!node('remoteReview').disabled);
 clock+=21000;conn.emit('data',state);watchdog();assert(node('remoteNext').disabled);timers.at(-1)();await new Promise(setImmediate);assert.equal(commands.at(-1).type,'teacher-hello');
 peers.at(-1).link.emit('data',{type:'remote-ended'});assert(node('remoteMain').hidden);assert(node('remoteStatus').textContent.includes('disconnected'));
 console.log('PASS: iPad controller authentication, state display, board inspection, winner checks, round locks, reconnect, and revocation UI.');
})().catch(e=>{console.error(e);process.exit(1)});
