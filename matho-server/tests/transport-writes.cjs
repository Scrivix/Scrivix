const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto').webcrypto;
let now=0;const context={crypto,Uint8Array,console,performance:{now:()=>now},Date:{now:()=>now},setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){}};vm.createContext(context);
let source=fs.readFileSync('matho/https-peer.js','utf8').replace('root.MathoHttpsPeer=MathoHttpsPeer;','root.TestConnection=Connection;root.MathoHttpsPeer=MathoHttpsPeer;');vm.runInContext(source,context);
let writes=[];const owner={session:'host',room:'fixture',request:async(path,body)=>writes.push(body),destroyed:false};
const c=new context.TestConnection(owner,'student');c.open=true;c.stableState=true;
const packet=(extra={})=>({type:'state',epoch:'round1',board:[1,2],marks:[],ack:0,calls:[{id:'M1'}],sentAt:now,clockPing:null,clock:{sentAt:now,deadline:30000,running:true,remainingMs:30000-now},...extra});
async function send(p,conn=c){conn.send(p);await conn.queue;}
(async()=>{
 await send(packet());now+=6000;await send(packet());assert.equal(writes.length,1,'Timestamp and countdown changes alone do not write');
 await send(packet({marks:[2],ack:1}));assert.equal(writes.length,2,'Marks and acknowledgement delivered');
 await send(packet({marks:[2],ack:1,pending:true}));assert.equal(writes.length,3,'Claim state delivered');
 await send(packet({marks:[2],ack:1,pending:true,clockPing:100}));assert.equal(writes.length,4,'Explicit clock sample delivered even with unchanged state');
 await send(packet({epoch:'round2',marks:[]}));assert.equal(writes.length,5,'New round delivered');
 await send({type:'notice',message:'same'});await send({type:'notice',message:'same'});assert.equal(writes.length,7,'Commands and nonstate messages are never suppressed');
 const next=new context.TestConnection(owner,'reconnected');next.open=true;await send(packet(),next);assert.equal(writes.length,8,'Reconnect starts with a full state');
 let fail=true,count=0;const retry=new context.TestConnection({...owner,request:async()=>{count++;if(fail)throw Error('offline');}},'retry');retry.open=true;await send(packet(),retry);fail=false;await send(packet(),retry);assert.equal(count,2,'Failed state can be retried');
 // Twenty students, thirty minutes, a call every thirty seconds, with six-second syncs.
 writes=[];const peers=Array.from({length:20},(_,i)=>{const p=new context.TestConnection(owner,String(i));p.open=true;p.stableState=true;return p;});let before=0;
 for(let step=0;step<300;step++){now=step*6000;const draw=Math.floor(step/5),p=packet({calls:[{id:'M'+draw}],clock:{sentAt:now,deadline:(draw+1)*30000,running:true,remainingMs:(draw+1)*30000-now}});for(const peer of peers){before++;peer.send(p);}await Promise.all(peers.map(p=>p.queue));}
 assert.equal(before,6000);assert.equal(writes.length,1200);
 console.log('PASS simulated 20-student/30-minute message inserts: '+before+' → '+writes.length+' (80% fewer); timestamps, clocks, claims, marks, new rounds, reconnects, and retries checked.');
 const legacy=new context.TestConnection(owner,'older-student');legacy.open=true;writes=[];await send(packet(),legacy);now+=6000;await send(packet(),legacy);assert.equal(writes.length,2,'Older students retain periodic full state updates until refreshed');
 const client=new context.TestConnection({...owner,session:'student'},'host');client.open=true;writes=[];await send({type:'hello',token:'fixture'},client);assert.equal(writes[0].payload.transportVersion,2,'Updated students advertise support');
 const hostLink=new context.TestConnection(owner,'student');hostLink.open=true;
 const hostPoll={destroyed:false,room:'fixture',session:'host',after:0,links:new Map([['student',hostLink]]),heartbeat(){},request:async()=>({messages:[{seq:1,sender:'student',kind:'data',payload:{type:'hello',transportVersion:2}}],connections:['student'],hostOnline:true})};
 await context.MathoHttpsPeer.prototype.poll.call(hostPoll);assert(hostLink.stableState,'Host enables deduplication only after upgraded-client handshake');
 // Teacher remote keeps a real state heartbeat at least every ten seconds.
 writes=[];now=0;const remote=new context.TestConnection(owner,'ipad');remote.open=true;remote.stableState=true;
 const snapshot=()=>({type:'state',role:'teacher-remote',heartbeat:String(now),timer:{running:true,deadline:40000,seconds:40,remainingMs:40000-now,secondsLeft:40-now/1000},students:[]});
 await send(snapshot(),remote);now=2500;await send(snapshot(),remote);assert.equal(writes.length,1);now=10000;await send(snapshot(),remote);assert.equal(writes.length,2);now=11000;await send({...snapshot(),students:[{marks:[1]}]},remote);assert.equal(writes.length,3,'Remote changes bypass heartbeat interval');
 // Locally replaying a state preserves liveness without rewinding the countdown.
 let replay;now=5000;const original=packet({sentAt:1000,clock:{sentAt:1000,deadline:31000,running:true,remainingMs:30000},clockPing:123});
 context.MathoHttpsPeer.prototype.heartbeat.call({destroyed:false,lastContact:5000,session:'student',hostOnline:true,lastState:original,lastStateAt:1000,links:new Map([['host',{open:true,emit:(type,p)=>replay=p}]])});
 assert.equal(replay.sentAt,5000);assert.equal(replay.clock.remainingMs,26000);assert.equal(replay.clockPing,null);assert.equal(original.clock.remainingMs,30000,'Cached state remains immutable');
 console.log('PASS remote heartbeat throttling and prompt roster updates; local student liveness advances clock without database writes.');
})().catch(e=>{console.error(e);process.exit(1)});
