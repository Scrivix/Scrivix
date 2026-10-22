const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const calls=[],navigation=[],storage=new Map(),session=new Map();const account={email:'owner@example.test',role:'owner',libraryId:'a'.repeat(32),csrf:'csrf-test',providers:['google']};
 const localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const ctx={URL,URLSearchParams,AbortController,setTimeout,clearTimeout,location:{origin:'https://scrivix.us',href:'https://scrivix.us/matho/library/',assign:u=>navigation.push(u)},localStorage,sessionStorage:{getItem:k=>session.get(k)||null,removeItem:k=>session.delete(k)},fetch:async(url,options)=>{calls.push({url:String(url),options});const data=String(url).endsWith('/config')?{enabled:true,googleClientId:'client'}:String(url).endsWith('/me')?{user:account}:String(url).includes('/sets')?{sets:[]}:{ok:true};return{ok:true,json:async()=>data};},console};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('matho/teacher-auth.js','utf8'),ctx);await ctx.MathoTeacherAuth.ready();
 assert.equal(ctx.MathoTeacherAuth.account().email,account.email);assert(calls.filter(c=>!c.url.endsWith('/config')).every(c=>c.options.credentials==='include'));assert.equal(calls[0].options.credentials,'omit');
 assert.equal(ctx.MathoTeacherAuth.safeNext('https://attacker.example/'),'https://scrivix.us/matho/library/');assert.equal(ctx.MathoTeacherAuth.safeNext('javascript:alert(1)'),'https://scrivix.us/matho/library/');assert.equal(ctx.MathoTeacherAuth.safeNext('/matho/signin/'),'https://scrivix.us/matho/library/');assert(ctx.MathoTeacherAuth.safeNext('/matho/game/?set=addition').includes('/matho/game/'));
 const legacy={id:'b'.repeat(32),key:'c'.repeat(64)};storage.set('matho-teacher-library-v1',JSON.stringify(legacy));
 vm.runInContext(fs.readFileSync('matho/library-client.js','utf8'),ctx);await ctx.MathoLibrary.ready();
 assert(calls.some(c=>c.url.endsWith('/claim-library')&&JSON.parse(c.options.body).id===legacy.id));assert(!storage.has('matho-teacher-library-v1'),'Legacy key is removed only after a successful claim');
 await ctx.MathoLibrary.list();const list=calls.at(-1);assert.equal(list.options.credentials,'include');assert.equal(list.options.headers['X-Matho-CSRF'],account.csrf);assert(!list.options.headers.Authorization,'Library mode never sends old bearer keys');assert(list.url.includes(account.libraryId));
 assert.equal(ctx.MathoLibrary.link(),'https://scrivix.us/matho/','Account mode shares the normal site URL');
 storage.set('matho-custom-draft-game-v1',JSON.stringify({libraryDirty:true}));await assert.rejects(ctx.MathoTeacherAuth.logout(),/pending question edits/);storage.delete('matho-custom-draft-game-v1');await ctx.MathoTeacherAuth.logout();assert.equal(ctx.MathoTeacherAuth.account(),null);assert.equal(navigation.at(-1),'/matho/');
 console.log('PASS: credentialed sessions, safe return paths, automatic owner migration, retired client keys, account-only library requests, and safe logout.');
})().catch(e=>{console.error(e);process.exit(1);});
