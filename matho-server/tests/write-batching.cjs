const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto').webcrypto;
let now=1000,next=1;const timers=new Map(),listeners=new Map();
const ctx={crypto,Uint8Array,Date:{now:()=>now},performance:{now:()=>now},setInterval(){},clearInterval(){},setTimeout(f,ms){const id=next++;timers.set(id,{f,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener:(type,f)=>listeners.set(type,f),removeEventListener:(type,f)=>{if(listeners.get(type)===f)listeners.delete(type);}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('matho/https-peer.js','utf8').replace('root.MathoHttpsPeer=MathoHttpsPeer;','root.TestConnection=Connection;root.MathoHttpsPeer=MathoHttpsPeer;'),ctx);
function advance(ms){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.f();}}
let writes=[];const owner={session:'student',room:'fixture',request:async(path,body)=>writes.push(body),destroy(){this.destroyed=true;}};
function connection(){const c=new ctx.TestConnection(owner,'host');c.open=true;return c;}
const marks=(seq,list,epoch='round1')=>({type:'marks',epoch,seq,marks:list});
(async()=>{
 let c=connection();for(let i=1;i<=5;i++)c.send(marks(i,Array.from({length:i},(_,n)=>n)));assert.equal(writes.length,0);advance(120);await c.queue;assert.equal(writes.length,1);assert.equal(writes[0].payload.seq,5);assert.equal(writes[0].payload.marks.length,5);
 writes=[];c=connection();c.send(marks(6,[1,2]));c.send({type:'claim',epoch:'round1',seq:7,marks:[1,2]});await c.queue;assert.deepEqual(writes.map(w=>w.payload.type),['marks','claim']);assert.equal(writes[0].payload.seq,6);advance(200);await c.queue;assert.equal(writes.length,2,'No delayed duplicate after claim');
 writes=[];c=connection();c.send(marks(8,[3]));c.close();await c.queue;assert.equal(writes[0].payload.type,'marks');assert.equal(writes[1].kind,'close','Leaving sends final marks before closing');
 writes=[];c=connection();c.send(marks(9,[2],'round1'));c.send(marks(1,[4],'round2'));advance(120);await c.queue;assert.deepEqual(writes.map(w=>w.payload.epoch),['round1','round2'],'Different rounds never merged');
 // Normal, separated selections still send individually.
 writes=[];c=connection();for(let i=1;i<=3;i++){c.send(marks(i,[i]));advance(120);await c.queue;}assert.equal(writes.length,3);
 const peer=new ctx.MathoHttpsPeer();await Promise.resolve();peer.request=async(path,body)=>writes.push(body);c=new ctx.TestConnection(peer,'host');c.open=true;peer.links.set('host',c);writes=[];c.send(marks(4,[4]));listeners.get('pagehide')();await c.queue;assert.equal(writes.length,1,'Refreshing flushes buffered marks');peer.destroy();
 // New remotes can use transport liveness; older remotes keep the ten-second fallback.
 const host={session:'host',room:'fixture',request:async(path,body)=>writes.push(body)};c=new ctx.TestConnection(host,'ipad');c.open=true;c.stableState=true;c.localHeartbeat=true;writes=[];
 const state=()=>({type:'state',role:'teacher-remote',heartbeat:String(now),timer:{running:true,deadline:999999,remainingMs:999999-now,secondsLeft:99},students:[]});
 c.send(state());await c.queue;for(let i=0;i<60;i++){now+=10000;c.send(state());await c.queue;}assert.equal(writes.length,1,'Ten minutes of unchanged remote state uses only initial snapshot');c.send({...state(),students:[{marks:[1]}]});await c.queue;assert.equal(writes.length,2,'Changed roster still sends immediately');
 let alive=0;ctx.MathoHttpsPeer.prototype.heartbeat.call({destroyed:false,lastContact:now,session:'student',hostOnline:true,lastState:state(),lastStateAt:now,links:new Map([['host',{open:true,emit:type=>{if(type==='heartbeat')alive++;}}]])});assert.equal(alive,1);
 console.log('PASS five quick marks → one write; separated marks retained; claim, close, pagehide, and round boundaries flush safely; idle iPad snapshots suppressed with real transport liveness.');
})().catch(e=>{console.error(e);process.exit(1)});
