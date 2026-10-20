import assert from 'node:assert/strict';
const endpoint=process.argv[2];if(!endpoint?.startsWith('https://'))throw Error('Supply the verified HTTPS relay URL.');
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>alphabet[n%alphabet.length]).join('');
const room='matho-addition-v1-'+code,secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const host=secret(),one={id:crypto.randomUUID(),token:secret()},two={id:crypto.randomUUID(),token:secret()};
async function api(path,body,token){const r=await fetch(new URL(path,endpoint),{method:body?'POST':'GET',headers:{Origin:'https://scrivix.us',...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});const data=await r.json();return{status:r.status,data,headers:r.headers};}
const poll=(id,token,after=0,wait=0)=>api('/v1/poll?'+new URLSearchParams({room,id,after:String(after),wait:String(wait)}),null,token);
const send=(id,token,to,payload,requestId=crypto.randomUUID())=>api('/v1/send',{room,id,to,payload,requestId,kind:'data'},token);
assert.equal((await api('/health')).status,200);
const created=await api('/v1/rooms',{room,token:host});assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(created.headers.get('Access-Control-Allow-Origin'),'https://scrivix.us');
for(const student of [one,two])assert.equal((await api('/v1/connect',{room,...student})).status,200);
const teacher=await poll('host',host);assert.equal(teacher.status,200,JSON.stringify(teacher.data));assert.equal(teacher.data.messages.length,2);
assert.equal((await poll(one.id,two.token)).status,403);
const requestId=crypto.randomUUID();await send('host',host,one.id,{type:'state',board:['synthetic-test-board']},requestId);await send('host',host,one.id,{type:'state',board:['synthetic-test-board']},requestId);
const first=await poll(one.id,one.token);assert.equal(first.data.messages.length,1);assert.equal((await poll(two.id,two.token)).data.messages.length,0);
const pending=poll(one.id,one.token,first.data.after,5000);await new Promise(resolve=>setTimeout(resolve,300));await send('host',host,one.id,{type:'state',calls:[{question:'1+1',letter:'M'}]});
const arrived=await pending;assert.equal(arrived.status,200);assert.equal(arrived.data.messages[0].payload.calls[0].question,'1+1');
await send(one.id,one.token,'host',{type:'claim',marks:[0,1,2,3,4]});assert.equal((await poll('host',host,teacher.data.after)).data.messages[0].payload.type,'claim');
assert.equal((await send(one.id,one.token,two.id,{type:'state'})).status,403);
if(process.argv.includes('--idle')){const start=Date.now();const idle=await poll(one.id,one.token,arrived.data.after,18000);assert.equal(idle.status,200,JSON.stringify(idle.data));assert.equal(idle.data.messages.length,0);assert(Date.now()-start>=17000);console.log('PASS: full idle HTTPS wait completes successfully.');}
console.log('PASS: deployed Worker/D1 room creation, two student joins, private inboxes, CORS, deduplication, waiting-request delivery and teacher claim routing.');
console.log('Synthetic test room expires automatically:',code);
