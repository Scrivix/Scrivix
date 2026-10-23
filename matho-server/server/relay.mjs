/* HTTPS-only transport. The existing teacher game remains the authority. */
const MAX_BODY=65536, TTL=4*60*60*1000, RETENTION=30*60*1000;
const validRoom=s=>typeof s==='string'&&/^matho(?:-[a-z0-9-]+)?-v1-[A-Z2-9]{5}(?:[A-Z2-9]{3})?$/.test(s);
const validId=s=>s==='host'||(typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s));
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function hash(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');}

export function createRelay(db,{origins=['https://scrivix.us'],now=()=>Date.now(),maxWait=18000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const buckets=new Map();let lastCleanup=0;
 const first=(sql,...values)=>db.prepare(sql).bind(...values).first();
 const run=(sql,...values)=>db.prepare(sql).bind(...values).run();
 const all=async(sql,...values)=>(await db.prepare(sql).bind(...values).all()).results;
 async function authorize(room,id,token){
  if(!validRoom(room)||!validId(id)||!validToken(token))throw fail(403,'Invalid room credentials.');
  const current=await first('SELECT * FROM rooms WHERE id=? AND expires>?',room,now());
  if(!current)throw fail(404,'Room not found or expired. Ask your teacher to reopen it.');
  const expected=id==='host'?current.token_hash:(await first('SELECT token_hash FROM sessions WHERE room=? AND id=?',room,id))?.token_hash;
  if(!expected||expected!==await hash(token))throw fail(403,'Invalid room credentials.');
  return current;
 }
 function limit(key,max,period){
  const time=now();let b=buckets.get(key);if(!b||b.until<time)b={count:0,until:time+period};
  b.count++;buckets.set(key,b);if(b.count>max)throw fail(429,'Too many requests. Wait a moment and try again.');
  if(buckets.size>10000)for(const [k,v]of buckets)if(v.until<time)buckets.delete(k);
 }
 return async function handle(request){
  const origin=request.headers.get('Origin');
  const allowed=origin&&origins.includes(origin);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(allowed){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
   if(origin&&!allowed)throw fail(403,'This website is not allowed to use the room service.');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   const url=new URL(request.url),path=url.pathname;
   if(path==='/health'&&request.method==='GET')return json({ok:true,transport:'https-polling',version:1});
   if(now()-lastCleanup>60000){lastCleanup=now();await run('DELETE FROM rooms WHERE expires<?',now());await run('DELETE FROM messages WHERE created<?',now()-RETENTION);}
   let body={};
   if(request.method==='POST'){
    if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw fail(413,'Message too large.');
    // Read a bounded stream, rather than trusting Content-Length.
    const reader=request.body?.getReader();let bytes=0,chunks=[];
    if(reader)while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BODY){await reader.cancel();throw fail(413,'Message too large.');}chunks.push(value);}
    const combined=new Uint8Array(bytes);let offset=0;for(const c of chunks){combined.set(c,offset);offset+=c.byteLength;}
    try{body=JSON.parse(new TextDecoder().decode(combined));}catch{throw fail(400,'Invalid JSON.');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Invalid request.');
   }
   if(path==='/v1/rooms'&&request.method==='POST'){
    if(!validRoom(body.room)||!validToken(body.token))throw fail(400,'Invalid room.');
    const ip=request.headers.get('CF-Connecting-IP')||'local';limit('create:'+ip,30,3600000);
    const digest=await hash(body.token);
    await run('INSERT OR IGNORE INTO rooms(id,token_hash,generation,expires,host_seen) VALUES(?,?,?,?,?)',body.room,digest,crypto.randomUUID(),now()+TTL,now());
    await authorize(body.room,'host',body.token);
    await run('UPDATE rooms SET expires=?,host_seen=? WHERE id=?',now()+TTL,now(),body.room);
    const current=await first('SELECT generation FROM rooms WHERE id=?',body.room);
    return json({ok:true,generation:current.generation});
   }
   if(path==='/v1/connect'&&request.method==='POST'){
    if(!validRoom(body.room)||!validId(body.id)||body.id==='host'||!validToken(body.token))throw fail(400,'Invalid connection.');
    const current=await first('SELECT id FROM rooms WHERE id=? AND expires>?',body.room,now());
    if(!current)throw fail(404,'Room not found. Ask your teacher to keep their room open.');
    const ip=request.headers.get('CF-Connecting-IP')||'local';limit('join:'+ip,300,60000);
    const digest=await hash(body.token);
    // Capacity is enforced atomically by the INSERT, even with simultaneous joins.
    await run('INSERT OR IGNORE INTO sessions(room,id,token_hash,seen) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM sessions WHERE room=? AND seen>?)<60',body.room,body.id,digest,now(),body.room,now()-30000);
    const session=await first('SELECT * FROM sessions WHERE room=? AND id=?',body.room,body.id);
    if(!session)throw fail(409,'This room already has 60 connected students.');
    if(session.token_hash!==digest)throw fail(403,'Invalid connection credentials.');
    if(session.seen<=now()-30000){
     const active=await first('SELECT COUNT(*) AS total FROM sessions WHERE room=? AND seen>?',body.room,now()-30000);
     if(active.total>=60)throw fail(409,'This room already has 60 connected students.');
    }
    const joinedAt=now();
    await run('UPDATE sessions SET seen=? WHERE room=? AND id=? AND (seen>? OR (SELECT COUNT(*) FROM sessions WHERE room=? AND seen>?)<60)',joinedAt,body.room,body.id,joinedAt-30000,body.room,joinedAt-30000);
    if((await first('SELECT seen FROM sessions WHERE room=? AND id=?',body.room,body.id)).seen!==joinedAt)throw fail(409,'This room already has 60 connected students.');
    await run('INSERT INTO messages(room,sender,recipient,request_id,kind,payload,created) VALUES(?,?,?,?,?,?,?)',body.room,body.id,'host',crypto.randomUUID(),'connect','null',now());
    return json({ok:true});
   }
   const room=request.method==='GET'?url.searchParams.get('room'):body.room;
   const id=request.method==='GET'?url.searchParams.get('id'):body.id;
   const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
   const authorizedRoom=await authorize(room,id,token);limit('session:'+room+':'+id,id==='host'?240:60,1000);
   if(path==='/v1/poll'&&request.method==='GET'){
    const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)throw fail(400,'Invalid message position.');
    const wait=Number(url.searchParams.get('wait')||0);if(!Number.isSafeInteger(wait)||wait<0)throw fail(400,'Invalid wait interval.');
    const deadline=Date.now()+Math.min(wait,maxWait);let rows;
    do{
     rows=await all('SELECT seq,sender,kind,payload FROM messages WHERE room=? AND recipient=? AND seq>? ORDER BY seq LIMIT 100',room,id,after);
     if(rows.length||Date.now()>=deadline)break;
     await sleep(Math.min(1000,deadline-Date.now()));
    }while(!request.signal.aborted);
    const time=now();let connections=[];
    if(id==='host'){
     await run('UPDATE rooms SET expires=?,host_seen=? WHERE id=? AND host_seen<?',time+TTL,time,room,time-15000);
     connections=(await all('SELECT id FROM sessions WHERE room=? AND seen>?',room,time-30000)).map(s=>s.id);
    }else await run('UPDATE sessions SET seen=? WHERE room=? AND id=? AND seen<?',time,room,id,time-15000);
    const hostSeen=id==='host'?time:(await first('SELECT host_seen FROM rooms WHERE id=?',room))?.host_seen||0;
    return json({messages:rows.map(m=>({...m,payload:JSON.parse(m.payload)})),after:rows.at(-1)?.seq||after,connections,hostOnline:hostSeen>time-30000});
   }
   if(path==='/v1/send'&&request.method==='POST'){
    if(!validId(body.to)||!validId(body.requestId)||body.requestId==='host'||!['data','close'].includes(body.kind))throw fail(400,'Invalid message.');
    if((id!=='host'&&body.to!=='host')||(id==='host'&&body.to==='host'))throw fail(403,'Messages can only pass between a student and their teacher.');
    if(body.to!=='host'&&!await first('SELECT id FROM sessions WHERE room=? AND id=?',room,body.to))throw fail(404,'Student connection not found.');
    if(body.kind==='data'&&(!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload)))throw fail(400,'Invalid game message.');
    await run('INSERT OR IGNORE INTO messages(room,sender,recipient,request_id,kind,payload,created) VALUES(?,?,?,?,?,?,?)',room,id,body.to,body.requestId,body.kind,JSON.stringify(body.payload??null),now());
    return json({ok:true});
   }
   throw fail(404,'Endpoint not found.');
  }catch(error){return json({error:error.status?error.message:'The room service could not complete this request. Please retry.'},error.status||500);}
 };
}
