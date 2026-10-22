import {createRemoteJWKSet,jwtVerify} from 'jose';
const SESSION='__Host-matho-session',BROWSER='__Host-matho-login',DAYS=14*86400000;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);
const email=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s.trim().toLowerCase():null;
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const cookies=req=>Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(s=>s.trim().split('=' )).filter(x=>x.length===2));
const cookie=(name,value,age)=>name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
const keys={google:createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:5000}),apple:createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'),{timeoutDuration:5000})};
export async function verifyProvider(token,provider,clientId,{keySet=keys[provider],now=Date.now()}={}){
 const {payload}=await jwtVerify(token,keySet,{algorithms:['RS256'],issuer:provider==='google'?['https://accounts.google.com','accounts.google.com']:'https://appleid.apple.com',audience:clientId,requiredClaims:['sub','iss','aud','iat','exp','nonce'],maxTokenAge:'10m',clockTolerance:5,currentDate:new Date(now)});
 if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||typeof payload.nonce!=='string')throw Error('Invalid identity.');
 return payload;
}
async function bodyOf(req,maximum=16384){
 const reader=req.body?.getReader();let size=0,chunks=[];
 if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maximum){await reader.cancel();throw fail(413,'Request too large.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail(400,'Invalid request.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Invalid request.');return body;
}
export function createAccounts(db,{googleClientId='',appleClientId='',ownerEmail='',origins=['https://scrivix.us'],now=()=>Date.now(),verify=verifyProvider,teacherLimit=5}={}){
 const enabled=!!googleClientId&&!!email(ownerEmail),owner=email(ownerEmail),first=(sql,...v)=>db.prepare(sql).bind(...v).first(),run=(sql,...v)=>db.prepare(sql).bind(...v).run(),all=async(sql,...v)=>(await db.prepare(sql).bind(...v).all()).results;
 const buckets=new Map();let cleanupAt=0;
 function limit(req,kind,max,period){const k=kind+':'+(req.headers.get('CF-Connecting-IP')||'local'),t=now();let b=buckets.get(k);if(!b||b.until<t)b={count:0,until:t+period};buckets.set(k,b);if(++b.count>max)throw fail(429,'Too many attempts. Please wait and try again.');if(buckets.size>10000)for(const[k,v]of buckets)if(v.until<t)buckets.delete(k);}
 function origin(req){if(!origins.includes(req.headers.get('Origin')))throw fail(403,'Open MATHO from the official website.');}
 function response(req,data,status=200,extra={}){const o=req.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff',...extra};if(origins.includes(o))Object.assign(headers,{'Access-Control-Allow-Origin':o,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Matho-CSRF','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});return new Response(status===204?null:JSON.stringify(data),{status,headers});}
 const errorResponse=(req,e)=>response(req,{error:e.status?e.message:'Sign-in is temporarily unavailable. Please try again.'},e.status||503);
 async function user(req,mutating=false){
  const token=cookies(req)[SESSION];if(!hex(token,64))throw fail(401,'Sign in to your teacher account.');
  const s=await first('SELECT u.*,s.csrf,s.token_hash FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1',await hash(token),now());
  if(!s)throw fail(401,'Please sign in again.');if(mutating){origin(req);if(req.headers.get('X-Matho-CSRF')!==s.csrf)throw fail(403,'Refresh the page before trying again.');}return s;
 }
 async function authorizeLibrary(req,id){if(!enabled)return false;const u=await user(req,req.method!=='GET');if(!await first('SELECT library_id FROM auth_library_owners WHERE library_id=? AND user_id=?',id,u.id))throw fail(403,'This question library belongs to another teacher.');return u;}
 async function createUser(provider,claims){
  const address=email(claims.email),verified=claims.email_verified===true||claims.email_verified==='true';
  if(provider!=='google'||!verified||!address)throw fail(403,'Sign in with your invited Google account first. You can link Apple afterward.');
  let role='teacher';
  if(address===owner){if(await first("SELECT id FROM auth_users WHERE role='owner'"))throw fail(403,'Use the Google account already linked to the owner.');role='owner';}
  else if(!await first('SELECT email FROM auth_invites WHERE email=? AND revoked=0',address))throw fail(403,'MATHO teacher access is invite-only. Ask the owner to invite this Google email address.');
  const id=random(16),library=random(16),time=now();
  try{await db.batch([
   db.prepare('INSERT INTO teacher_libraries(id,key_hash,created) VALUES(?,?,?)').bind(library,await hash(random(32)),time),
   db.prepare('INSERT INTO auth_users(id,email,role,active,library_id,created) VALUES(?,?,?,1,?,?)').bind(id,address,role,library,time),
   db.prepare('INSERT INTO auth_identities(provider,subject,user_id) VALUES(?,?,?)').bind(provider,claims.sub,id),
   db.prepare('INSERT INTO auth_library_owners(library_id,user_id) VALUES(?,?)').bind(library,id)
  ]);}catch(e){const existing=await first('SELECT u.* FROM auth_users u JOIN auth_identities i ON i.user_id=u.id WHERE i.provider=? AND i.subject=?',provider,claims.sub);if(existing)return existing;throw fail(403,'This account cannot be registered. Use your existing sign-in or ask the owner for access.');}
  return first('SELECT * FROM auth_users WHERE id=?',id);
 }
 const publicUser=u=>({email:u.email,role:u.role,libraryId:u.library_id,csrf:u.csrf,providers:undefined});
 async function handle(req){
  try{
   const path=new URL(req.url).pathname;
   if(req.method==='OPTIONS')return response(req,null,204);
   if(req.headers.get('Origin')&&!origins.includes(req.headers.get('Origin')))throw fail(403,'This website cannot use MATHO sign-in.');
   if(path==='/v1/auth/config'&&req.method==='GET')return response(req,{enabled,googleClientId:enabled?googleClientId:null,appleClientId:enabled&&appleClientId?appleClientId:null});
   if(!enabled)throw fail(503,'Teacher sign-in is being configured. Your existing library remains available.');
   if(now()>cleanupAt){cleanupAt=now()+3600000;await run('DELETE FROM auth_challenges WHERE expires<?',now());await run('DELETE FROM auth_sessions WHERE expires<?',now());}
   if(path==='/v1/auth/me'&&req.method==='GET'){const u=await user(req),providers=await all('SELECT provider FROM auth_identities WHERE user_id=?',u.id);return response(req,{user:{...publicUser(u),providers:providers.map(p=>p.provider)}});}
   if(path==='/v1/auth/challenge'&&req.method==='POST'){
    origin(req);limit(req,'challenge',100,3600000);const b=await bodyOf(req),purpose=b.purpose==='link'?'link':'login',u=purpose==='link'?await user(req,true):null;
    const browser=hex(cookies(req)[BROWSER],64)?cookies(req)[BROWSER]:random(32),nonce=random(32),id=random(16);
    await run('INSERT INTO auth_challenges(id,nonce_hash,browser_hash,purpose,user_id,expires) VALUES(?,?,?,?,?,?)',id,await hash(nonce),await hash(browser),purpose,u?.id||null,now()+600000);
    return response(req,{id,nonce,purpose},200,{'Set-Cookie':cookie(BROWSER,browser,1200)});
   }
   if(path==='/v1/auth/login'&&req.method==='POST'){
    origin(req);limit(req,'login',30,60000);const b=await bodyOf(req),provider=b.provider,client=provider==='google'?googleClientId:provider==='apple'?appleClientId:null;
    if(!client||typeof b.credential!=='string'||b.credential.length>12000||!hex(b.challengeId,32))throw fail(400,'Use one of the available sign-in buttons.');
    const browser=cookies(req)[BROWSER];if(!hex(browser,64))throw fail(403,'Start sign-in again in this browser.');
    const challenge=await first('SELECT * FROM auth_challenges WHERE id=? AND expires>? AND browser_hash=?',b.challengeId,now(),await hash(browser));if(!challenge)throw fail(403,'Sign-in expired. Please try again.');
    let claims;try{claims=await verify(b.credential,provider,client,{now:now()});}catch{throw fail(403,'The identity provider could not verify this sign-in.');}
    if(await hash(claims.nonce)!==challenge.nonce_hash)throw fail(403,'Sign-in did not match this browser. Please try again.');
    const taken=await run('DELETE FROM auth_challenges WHERE id=? AND expires>?',challenge.id,now());if(!taken.meta.changes)throw fail(403,'This sign-in has already been used.');
    let current=await first('SELECT u.* FROM auth_users u JOIN auth_identities i ON i.user_id=u.id WHERE i.provider=? AND i.subject=?',provider,claims.sub);
    if(challenge.purpose==='link'){
     const u=await user(req,true);if(u.id!==challenge.user_id)throw fail(403,'Sign in again before linking another provider.');if(current&&current.id!==u.id)throw fail(409,'That sign-in is already linked to another teacher.');
     if(!current)await run('INSERT INTO auth_identities(provider,subject,user_id) VALUES(?,?,?)',provider,claims.sub,u.id);
     return response(req,{ok:true,linked:provider});
    }
    if(!current)current=await createUser(provider,claims);if(!current.active)throw fail(403,'Teacher access has been removed. Contact the owner.');
    const token=random(32),csrf=random(32);await run('INSERT INTO auth_sessions(token_hash,user_id,csrf,expires,created) VALUES(?,?,?,?,?)',await hash(token),current.id,csrf,now()+DAYS,now());
    return response(req,{user:publicUser({...current,csrf})},200,{'Set-Cookie':cookie(SESSION,token,DAYS/1000)});
   }
   if(path==='/v1/auth/logout'&&req.method==='POST'){const u=await user(req,true);await run('DELETE FROM auth_sessions WHERE token_hash=?',u.token_hash);return response(req,{ok:true},200,{'Set-Cookie':cookie(SESSION,'',0)});}
   if(path==='/v1/auth/claim-library'&&req.method==='POST'){
    const u=await user(req,true);if(u.role!=='owner')throw fail(403,'Only the owner can move an existing private-link library.');
    const b=await bodyOf(req);if(!hex(b.id,32)||!hex(b.key,64))throw fail(400,'Invalid library connection.');
    const assigned=await first('SELECT user_id FROM auth_library_owners WHERE library_id=?',b.id);if(assigned?.user_id===u.id)return response(req,{ok:true});if(assigned)throw fail(403,'This library belongs to another teacher.');
    const lib=await first('SELECT key_hash FROM teacher_libraries WHERE id=?',b.id);if(!lib||lib.key_hash!==await hash(b.key))throw fail(403,'The old library link could not be verified. Your existing account sets are safe.');
    await db.batch([
     db.prepare('INSERT INTO auth_library_owners(library_id,user_id) VALUES(?,?)').bind(b.id,u.id),
     db.prepare('UPDATE teacher_sets SET library_id=? WHERE library_id=?').bind(u.library_id,b.id),
     db.prepare('UPDATE teacher_libraries SET key_hash=? WHERE id=?').bind(await hash(random(32)),b.id)
    ]);return response(req,{ok:true});
   }
   if(path==='/v1/auth/teachers'){
    const u=await user(req,req.method==='POST');if(u.role!=='owner')throw fail(403,'Only the owner can manage teacher invitations.');
    if(req.method==='GET')return response(req,{teachers:await all('SELECT email,role,active FROM auth_users ORDER BY created'),invitations:await all('SELECT email,revoked FROM auth_invites ORDER BY created'),limit:teacherLimit});
    if(req.method==='POST'){
     const b=await bodyOf(req),address=email(b.email);if(!address||address===owner)throw fail(400,'Enter another teacher’s Google email address.');
     if(b.action==='revoke'){
      await db.batch([db.prepare('UPDATE auth_invites SET revoked=1 WHERE email=?').bind(address),db.prepare("UPDATE auth_users SET active=0 WHERE email=? AND role='teacher'").bind(address),db.prepare("DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_users WHERE email=? AND role='teacher')").bind(address),db.prepare("DELETE FROM rooms WHERE id IN (SELECT a.room FROM auth_host_rooms a JOIN auth_users u ON u.id=a.user_id WHERE u.email=? AND u.role='teacher')").bind(address)]);
     }else{
      const count=await first('SELECT COUNT(*) AS total FROM auth_invites WHERE revoked=0');if(count.total>=teacherLimit&&!await first('SELECT email FROM auth_invites WHERE email=? AND revoked=0',address))throw fail(409,'The invitation limit has been reached.');
      const saved=await db.batch([db.prepare('INSERT INTO auth_invites(email,created_by,created,revoked) SELECT ?,?,?,0 WHERE (SELECT COUNT(*) FROM auth_invites WHERE revoked=0)<? OR EXISTS(SELECT 1 FROM auth_invites WHERE email=? AND revoked=0) ON CONFLICT(email) DO UPDATE SET revoked=0').bind(address,u.id,now(),teacherLimit,address),db.prepare("UPDATE auth_users SET active=1 WHERE email=? AND role='teacher' AND EXISTS(SELECT 1 FROM auth_invites WHERE email=? AND revoked=0)").bind(address,address)]);
      if(!saved[0].meta.changes)throw fail(409,'The invitation limit has been reached.');
     }return response(req,{ok:true});
    }
   }
   throw fail(404,'Sign-in action not found.');
  }catch(e){return errorResponse(req,e);}
 }
 async function hostAccess(req){
  if(!enabled)return null;
  try{
   const u=await user(req,true),b=await bodyOf(req.clone(),2048),room=b.room;
   if(typeof room!=='string'||!/^matho(?:-[a-z0-9-]+)?-v1-[A-Z2-9]{8}$/.test(room)||!hex(b.token,64))throw fail(400,'Invalid room.');
   const existing=await first('SELECT token_hash,host_seen FROM rooms WHERE id=? AND expires>?',room,now());if(existing&&existing.token_hash!==await hash(b.token))throw fail(403,'This room is already owned by another host.');
   const owned=await first('SELECT user_id,reserved_until FROM auth_host_rooms WHERE room=?',room);if(owned){if(owned.user_id!==u.id)throw fail(403,'This room belongs to another teacher.');if(existing?.host_seen>now()-60000||owned.reserved_until>now())return null;}
   const code=room.slice(-8),remote=room.startsWith('matho-teacher-');
   if(remote&&!await first("SELECT a.room FROM auth_host_rooms a JOIN rooms r ON r.id=a.room WHERE a.user_id=? AND a.code=? AND a.kind='game' AND r.expires>?",u.id,code,now()))throw fail(403,'Open your classroom game before pairing a remote.');
   const day=new Date(now()).toISOString().slice(0,10),reservation=random(16),kind=remote?'remote':'game';
   const result=await db.batch([
    db.prepare("INSERT INTO auth_host_rooms(room,user_id,code,kind,reserved_until,reservation) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM auth_host_rooms a LEFT JOIN rooms r ON r.id=a.room WHERE a.user_id=? AND a.kind=? AND (a.reserved_until>? OR r.host_seen>?))<? AND (SELECT COUNT(*) FROM auth_host_rooms a LEFT JOIN rooms r ON r.id=a.room WHERE a.kind='game' AND (a.reserved_until>? OR r.host_seen>?))<10 AND COALESCE((SELECT total FROM auth_daily_rooms WHERE user_id=? AND day=?),0)<50 ON CONFLICT(room) DO UPDATE SET reserved_until=excluded.reserved_until,reservation=excluded.reservation WHERE auth_host_rooms.user_id=excluded.user_id").bind(room,u.id,code,kind,now()+30000,reservation,u.id,kind,now(),now()-60000,remote?3:2,now(),now()-60000,u.id,day),
    db.prepare('INSERT INTO auth_daily_rooms(user_id,day,total) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM auth_host_rooms WHERE room=? AND reservation=?) ON CONFLICT(user_id,day) DO UPDATE SET total=total+1').bind(u.id,day,room,reservation)
   ]);
   if(!result[0].meta.changes)throw fail(429,'The game hosting limit has been reached. Close an unused teacher window and wait a minute before starting another game.');return null;
  }catch(e){return errorResponse(req,e);}
 }
 return {enabled,handle,authorizeLibrary,hostAccess,user,errorResponse};
}
