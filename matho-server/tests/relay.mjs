import assert from 'node:assert/strict';
import {openStore,sqliteAdapter,serverFor} from '../server/node.mjs';
import {createRelay} from '../server/relay.mjs';
const db=openStore();let now=1000000;
const handle=createRelay(sqliteAdapter(db),{origins:['https://scrivix.us'],now:()=>now});
const room='matho-addition-v1-'+(process.argv[2]||'ABCD2345'),host='a'.repeat(64),a=crypto.randomUUID(),b=crypto.randomUUID(),ta='b'.repeat(64),tb='c'.repeat(64);
async function call(path,body,token,origin='https://scrivix.us'){
 const r=await handle(new Request('https://relay.test'+path,{method:body?'POST':'GET',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}));return{status:r.status,data:await r.json(),headers:r.headers};
}
const poll=(id,token,after=0)=>call('/v1/poll?room='+room+'&id='+id+'&after='+after,null,token);
const send=(id,token,to,payload,requestId=crypto.randomUUID())=>call('/v1/send',{room,id,to,payload,requestId,kind:'data'},token);
assert.equal((await call('/health',null,null,'https://other.example')).status,403);
assert.equal((await call('/v1/rooms',{room,token:host})).status,200);
assert.equal((await call('/v1/rooms',{room,token:ta})).status,403,'No room takeover');
for(const [id,token]of [[a,ta],[b,tb]])assert.equal((await call('/v1/connect',{room,id,token})).status,200);
const connections=await poll('host',host);assert.equal(connections.data.messages.length,2);
assert.equal((await poll(a,tb)).status,403,'No reading another student inbox');
const requestId=crypto.randomUUID();await send('host',host,a,{type:'state',name:'One',board:['private']},requestId);await send('host',host,a,{type:'state',name:'One',board:['private']},requestId);
const first=await poll(a,ta);assert.equal(first.data.messages.length,1,'Retry is deduplicated');assert.equal(first.data.messages[0].payload.name,'One');
assert.equal((await poll(b,tb)).data.messages.length,0,'Other student cannot see first student state');
assert.equal((await send(a,ta,b,{type:'state'})).status,403,'Student cannot send to another student');
await send(a,ta,'host',{type:'claim',marks:[0,1,2,3,4]});const teacher=await poll('host',host,connections.data.after);assert.equal(teacher.data.messages[0].payload.type,'claim');
assert.equal((await poll(a,ta,first.data.after)).data.messages.length,0,'Acknowledged messages not replayed');
assert.equal((await send('host',host,a,{text:'x'.repeat(70000)})).status,413,'Bounded request body');
assert.equal((await poll('host',ta)).status,403,'Teacher authority is secret');
const writesBefore=db.prepare('SELECT total_changes() AS n').get().n;
for(let i=0;i<60;i++){now+=1000;await poll(a,ta,first.data.after);await poll('host',host,teacher.data.after);}
assert(db.prepare('SELECT total_changes() AS n').get().n-writesBefore<=8,'Idle polls write heartbeats at most once per 15 seconds');
const waiting=createRelay(sqliteAdapter(db),{origins:['https://scrivix.us'],now:()=>now,maxWait:300,sleep:ms=>new Promise(r=>setTimeout(r,Math.min(ms,10)))});
const pending=waiting(new Request('https://relay.test/v1/poll?room='+room+'&id='+b+'&wait=300',{headers:{Authorization:'Bearer '+tb}}));
await new Promise(r=>setTimeout(r,20));await send('host',host,b,{type:'notice',text:'New call'});
assert.equal((await (await pending).json()).messages[0].payload.text,'New call','Waiting HTTP request delivers a new message');
const restarted=createRelay(sqliteAdapter(db),{origins:['https://scrivix.us'],now:()=>now});
assert.equal((await restarted(new Request('https://relay.test/v1/poll?room='+room+'&id='+a,{headers:{Authorization:'Bearer '+ta}}))).status,200,'Room credentials survive handler restart');
const fullRoom='matho-v1-FULL2345';await call('/v1/rooms',{room:fullRoom,token:host});
for(let i=0;i<60;i++)assert.equal((await call('/v1/connect',{room:fullRoom,id:crypto.randomUUID(),token:ta})).status,200);
assert.equal((await call('/v1/connect',{room:fullRoom,id:crypto.randomUUID(),token:ta})).status,409,'Room capacity is enforced');
now+=4*60*60*1000+1;assert.equal((await poll(a,ta)).status,404,'Inactive rooms expire');
assert.equal((await call('/v1/rooms',{room,token:host})).status,200,'Host can recover room after expiry');
// A real HTTP request exercises the Node adapter, not only direct function calls.
const server=serverFor(handle);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const health=await fetch('http://127.0.0.1:'+server.address().port+'/health');assert.equal((await health.json()).transport,'https-polling');await new Promise(resolve=>server.close(resolve));
db.close();console.log('PASS: HTTP relay, private inboxes, teacher authority, claim routing, duplicate suppression, CORS, body limits, expiry and room recovery.');
