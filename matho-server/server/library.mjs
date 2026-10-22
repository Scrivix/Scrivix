/* Durable teacher libraries are separate from temporary classroom relay rooms. */
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s);
const custom=s=>typeof s==='string'&&/^custom-[a-f0-9]{32}$/.test(s);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const letters=['M','A','T','H','O'];
function bankOf(bank){
 if(!Array.isArray(bank)||bank.length>2000)throw fail(400,'A set can have up to 2,000 questions.');
 const ids=new Set();
 return bank.map(q=>{
  if(!q||typeof q.id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(q.id)||ids.has(q.id)||!letters.includes(q.letter)||typeof q.question!=='string'||!q.question.trim()||q.question.length>500||typeof q.answer!=='string'||!q.answer.trim()||q.answer.length>200)throw fail(400,'Each question needs a unique ID, MATHO column, question, and answer.');
  ids.add(q.id);return {id:q.id,letter:q.letter,question:q.question.trim(),answer:q.answer.trim(),enabled:q.enabled!==false,note:typeof q.note==='string'?q.note.slice(0,1000):''};
 });
}
export function configOf(input,id,title){
 const config={id,title,storagePrefix:'matho-'+id,joinPrefix:'CS',bankFile:'private-library.json',exportFilename:id+'-question-bank.json',copy:{studentInstructions:'Solve the question and mark the matching answer in the called column.',callerBrand:title,roomBrand:title,studentBrand:title,callerHeading:title,callerSubtitle:'Solve the question. Find your answer. Call MATHO!',callerControls:'Ready for the next question?',roomHeading:title,roomWelcome:'Bring everyone into the game.',roomIntro:'Each student gets a different board. Choose your winning pattern below.',callerLink:'Question caller',joinIntro:'Enter your teacher’s room code and your name.',studentBoardLabel:'YOUR MATHO BOARD',footer:'Think it through. Find your square.',bankIntro:'Your private teacher library keeps this set online. Changes save automatically while connected. Existing rooms keep their original questions.'},hints:{caller:{default:'Find your answer in column {letter}.'},student:{default:'Solve the question and check column {letter}.'}},presentationSubtitle:'Solve the question. Find your square.'};
 const source=input&&typeof input==='object'?input:{};
 for(const name of ['copy','hints']){
  if(source[name]&&typeof source[name]==='object'){
   if(name==='copy')for(const key of Object.keys(config.copy))if(typeof source.copy[key]==='string')config.copy[key]=source.copy[key].slice(0,2000);
   if(name==='hints')for(const kind of ['caller','student'])for(const key of ['default',...letters])if(typeof source.hints[kind]?.[key]==='string')config.hints[kind][key]=source.hints[kind][key].slice(0,500);
  }
 }
 config.copy.callerBrand=title;config.copy.roomBrand=title;config.copy.studentBrand=title;config.copy.callerHeading=title;config.copy.roomHeading=title;
 config.copy.bankIntro='Your private teacher library keeps this set online. Changes save automatically while connected. Existing rooms keep their original questions.';
 if(source.id==='scientific-notation'||source.displaySet==='scientific-notation')config.displaySet='scientific-notation';
 if(typeof source.presentationSubtitle==='string')config.presentationSubtitle=source.presentationSubtitle.slice(0,1000);
 // Preserve only documented display-size options, never arbitrary client configuration.
 for(const k of ['boardFontSize','boardNumericFontSize','boardNarrowFontSize','boardNarrowNumericFontSize','boardMobileFontSize','boardMobileNumericFontSize'])if(Number.isFinite(source[k])&&source[k]>=10&&source[k]<=40)config[k]=source[k];
 return config;
}
export function createLibrary(db,{origins=['https://scrivix.us'],now=()=>Date.now()}={}){
 const first=(sql,...v)=>db.prepare(sql).bind(...v).first(),run=(sql,...v)=>db.prepare(sql).bind(...v).run();
 const all=async(sql,...v)=>(await db.prepare(sql).bind(...v).all()).results;
 const buckets=new Map();
 function limit(ip){const t=now();let b=buckets.get(ip);if(!b||t>b.until)b={count:0,until:t+3600000};if(++b.count>10)throw fail(429,'Please wait before creating another library.');buckets.set(ip,b);if(buckets.size>10000)for(const [k,v]of buckets)if(v.until<t)buckets.delete(k);}
 async function auth(request,id){
  const key=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!hex(id,32)||!hex(key,64))throw fail(403,'Connect your private teacher library first.');
  const lib=await first('SELECT key_hash FROM teacher_libraries WHERE id=?',id);
  if(!lib||lib.key_hash!==await hash(key))throw fail(403,'That library connection is not valid. Use your saved private link.');
 }
 async function setFor(id,setId){
  const s=await first('SELECT * FROM teacher_sets WHERE id=? AND library_id=?',setId,id);
  if(!s)throw fail(404,'That question set was not found in this library.');return s;
 }
 return async request=>{
  const origin=request.headers.get('Origin'),allowed=origin&&origins.includes(origin),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(allowed)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
  const json=(b,status=200)=>new Response(JSON.stringify(b),{status,headers});
  try{
   if(origin&&!allowed)throw fail(403,'This website cannot use the teacher library.');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   const path=new URL(request.url).pathname;
   if(path==='/v1/library-health'&&request.method==='GET')return json({ok:true,version:1});
   let body={};
   if(request.method==='POST'){
    const reader=request.body?.getReader();let count=0,chunks=[];
    if(reader)while(true){const r=await reader.read();if(r.done)break;count+=r.value.length;if(count>1500000){await reader.cancel();throw fail(413,'This question set is too large.');}chunks.push(r.value);}
    const bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail(400,'Invalid request.');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Invalid request.');
   }
   if(path==='/v1/libraries'&&request.method==='POST'){
    limit(request.headers.get('CF-Connecting-IP')||'local');
    const id=random(16),key=random(32);
    await run('INSERT INTO teacher_libraries(id,key_hash,created) VALUES(?,?,?)',id,await hash(key),now());
    return json({id,key},201);
   }
   const pub=path.match(/^\/v1\/custom-sets\/(custom-[a-f0-9]{32})$/);
   if(pub&&request.method==='GET'){
    const s=await first('SELECT config FROM teacher_sets WHERE id=?',pub[1]);if(!s)throw fail(404,'Question set not found.');
    return json({config:JSON.parse(s.config)});
   }
   const lookup=path.match(/^\/v1\/library-rooms\/([A-Z2-9]{8})$/);
   if(lookup&&request.method==='GET'){
    const row=await first('SELECT set_id FROM teacher_library_rooms WHERE code=? AND expires>?',lookup[1],now());if(!row)throw fail(404,'Room not found. Check the code and ask your teacher to reopen it.');
    return json({setId:row.set_id});
   }
   if(path==='/v1/library-rooms'&&request.method==='POST'){
    await auth(request,body.libraryId);await setFor(body.libraryId,body.setId);
    if(typeof body.code!=='string'||!/^CS[A-Z2-9]{6}$/.test(body.code))throw fail(400,'Invalid room code.');
    await run('INSERT INTO teacher_library_rooms(code,set_id,expires) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET expires=excluded.expires WHERE teacher_library_rooms.set_id=excluded.set_id OR teacher_library_rooms.expires<?',body.code,body.setId,now()+7*86400000,now());
    const row=await first('SELECT set_id FROM teacher_library_rooms WHERE code=?',body.code);if(row?.set_id!==body.setId)throw fail(409,'Please create the room again to get a fresh code.');
    return json({ok:true});
   }
   const m=path.match(/^\/v1\/libraries\/([a-f0-9]{32})\/sets(?:\/(custom-[a-f0-9]{32}))?(?:\/versions(?:\/(\d+))?)?$/);
   if(!m)throw fail(404,'Endpoint not found.');
   const [,id,setId,version]=m;await auth(request,id);
   if(!setId){
    if(request.method==='GET')return json({sets:await all('SELECT id,title,revision,updated FROM teacher_sets WHERE library_id=? ORDER BY updated DESC',id)});
    if(request.method==='POST'){
     const count=await first('SELECT COUNT(*) AS total FROM teacher_sets WHERE library_id=?',id);if(count.total>=200)throw fail(400,'Your library can hold up to 200 sets.');
     const title=typeof body.title==='string'?body.title.trim().slice(0,100):'';if(!title)throw fail(400,'Give your set a name.');
     const bank=bankOf(body.bank),newId='custom-'+random(16),config=configOf(body.config,newId,title),encoded=JSON.stringify(bank),time=now();
     await db.batch([db.prepare('INSERT INTO teacher_sets(id,library_id,title,config,bank,revision,updated) VALUES(?,?,?,?,?,1,?)').bind(newId,id,title,JSON.stringify(config),encoded,time),db.prepare('INSERT INTO teacher_set_versions(set_id,revision,bank,created) VALUES(?,1,?,?)').bind(newId,encoded,time)]);
     return json({id:newId,title,config,bank,revision:1,updated:time},201);
    }
   }else{
    const s=await setFor(id,setId);
    if(path.includes('/versions')){
     if(request.method!=='GET')throw fail(405,'Use GET for saved versions.');
     if(version){const row=await first('SELECT bank,revision,created FROM teacher_set_versions WHERE set_id=? AND revision=?',setId,Number(version));if(!row)throw fail(404,'Saved version not found.');return json({...row,bank:JSON.parse(row.bank)});}
     return json({versions:await all('SELECT revision,created FROM teacher_set_versions WHERE set_id=? ORDER BY revision DESC LIMIT 50',setId)});
    }
    if(request.method==='GET')return json({id:s.id,title:s.title,config:JSON.parse(s.config),bank:JSON.parse(s.bank),revision:s.revision,updated:s.updated});
    if(request.method==='POST'){
     if(!Number.isSafeInteger(body.revision)||body.revision!==s.revision)throw fail(409,'This set changed on another device. Your local draft is safe. Save it as a separate copy or reload the latest version.');
     const encoded=JSON.stringify(bankOf(body.bank)),time=now(),revision=s.revision+1;
     // Both statements are one transaction. A racing update cannot replace a newer bank.
     const outcome=await db.batch([db.prepare('UPDATE teacher_sets SET bank=?,revision=?,updated=? WHERE id=? AND library_id=? AND revision=?').bind(encoded,revision,time,setId,id,s.revision),db.prepare('INSERT OR IGNORE INTO teacher_set_versions(set_id,revision,bank,created) SELECT id,revision,bank,updated FROM teacher_sets WHERE id=? AND revision=?').bind(setId,revision)]);
     if(!outcome[0].meta.changes)throw fail(409,'This set changed on another device. Your draft is saved locally; save a separate copy or reload.');
     return json({ok:true,revision,updated:time});
    }
   }
   throw fail(405,'That action is not available.');
  }catch(e){return json({error:e.status?e.message:'The teacher library is unavailable. Your local questions are safe; please retry.'},e.status||503);}
 };
}
