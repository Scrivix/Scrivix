import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createAccounts,verifyProvider} from '../server/accounts.mjs';
import {createLibrary} from '../server/library.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
for(const p of ['../server/schema.sql','../migrations/0002_teacher_library.sql','../migrations/0003_teacher_accounts.sql'])sqlite.exec(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const prepare=sql=>({v:[],bind(...v){this.v=v;return this;},first(){return sqlite.prepare(sql).get(...this.v)||null;},all(){return {results:sqlite.prepare(sql).all(...this.v)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...this.v).changes)}};}});
const db={prepare,batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let time=Date.now();const google='test.apps.googleusercontent.com',apple='us.scrivix.matho';
const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test';jwk.alg='RS256';const jwks=createLocalJWKSet({keys:[jwk]});
const accounts=createAccounts(db,{googleClientId:google,appleClientId:apple,ownerEmail:'owner@example.test',now:()=>time,verify:(token,provider,client,opts)=>verifyProvider(token,provider,client,{...opts,keySet:jwks})});
const library=createLibrary(db,{accounts,now:()=>time});
class Browser{
 constructor(){this.jar=new Map();this.csrf=null;}
 request(path,body,extra={}){return new Request('https://api.test'+path,{method:body?'POST':'GET',headers:{Origin:'https://scrivix.us',Cookie:[...this.jar].map(([k,v])=>k+'='+v).join('; '),...(this.csrf?{'X-Matho-CSRF':this.csrf}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});}
 async call(path,body,handler=accounts.handle,extra={}){const response=await handler(this.request(path,body,extra));const set=response.headers.get('Set-Cookie');if(set){const [k,v]=set.split(';')[0].split('=');if(v)this.jar.set(k,v);else this.jar.delete(k);}const data=response.status===204?null:await response.json();if(data?.user)this.csrf=data.user.csrf;return {status:response.status,data,headers:response.headers};}
}
async function signed(provider,sub,address,nonce,more={}){return new SignJWT({nonce,email:address,email_verified:true,...more}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(provider==='google'?'https://accounts.google.com':'https://appleid.apple.com').setAudience(provider==='google'?google:apple).setSubject(sub).setIssuedAt(Math.floor(time/1000)).setExpirationTime(Math.floor(time/1000)+3600).sign(privateKey);}
async function challenge(b,purpose='login'){const r=await b.call('/v1/auth/challenge',{purpose});assert.equal(r.status,200);return r.data;}
async function login(b,provider,sub,address){const c=await challenge(b);return b.call('/v1/auth/login',{provider,credential:await signed(provider,sub,address,c.nonce),challengeId:c.id});}
const owner=new Browser(),teacher=new Browser(),other=new Browser();
assert.equal((await owner.call('/v1/auth/config')).data.enabled,true);
const preflight=await accounts.handle(new Request('https://api.test/v1/auth/login',{method:'OPTIONS',headers:{Origin:'https://scrivix.us'}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),'true');
assert.equal((await login(other,'google','uninvited','stranger@example.test')).status,403);
const c=await challenge(owner),credential=await signed('google','owner-sub','owner@example.test',c.nonce);
assert.equal((await other.call('/v1/auth/login',{provider:'google',credential,challengeId:c.id})).status,403,'Nonce challenge is bound to its browser');
const first=await owner.call('/v1/auth/login',{provider:'google',credential,challengeId:c.id});assert.equal(first.status,200);assert.equal(first.data.user.role,'owner');assert(first.headers.get('Set-Cookie').includes('HttpOnly'));assert(first.headers.get('Set-Cookie').includes('Secure'));assert(first.headers.get('Set-Cookie').includes('SameSite=Lax'));
assert.equal((await owner.call('/v1/auth/login',{provider:'google',credential,challengeId:c.id})).status,403,'Nonce cannot be replayed');
assert.equal((await login(other,'google','different-owner-sub','owner@example.test')).status,403,'Owner identity cannot be re-registered by email');
assert.equal((await owner.call('/v1/auth/teachers',{email:'teacher@example.test'},accounts.handle,{'X-Matho-CSRF':'wrong'})).status,403);
assert.equal((await owner.call('/v1/auth/teachers',{email:'teacher@example.test'})).status,200);
const registered=await login(teacher,'google','teacher-sub','teacher@example.test');assert.equal(registered.status,200);assert.equal(registered.data.user.role,'teacher');assert.notEqual(registered.data.user.libraryId,first.data.user.libraryId);
assert.equal((await teacher.call('/v1/auth/teachers')).status,403);
const oldId='a'.repeat(32),oldKey='b'.repeat(64),oldHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(oldKey))).toString('hex');
sqlite.prepare('INSERT INTO teacher_libraries VALUES(?,?,?)').run(oldId,oldHash,time);
const setId='custom-'+'c'.repeat(32);sqlite.prepare('INSERT INTO teacher_sets VALUES(?,?,?,?,?,1,?)').run(setId,oldId,'Original','{}','[{"id":"M1","letter":"M","question":"important","answer":"1"}]',time);
sqlite.prepare('INSERT INTO teacher_set_versions VALUES(?,1,?,?)').run(setId,'[{"id":"M1"}]',time);
assert.equal((await teacher.call('/v1/auth/claim-library',{id:oldId,key:oldKey})).status,403);
assert.equal((await owner.call('/v1/auth/claim-library',{id:oldId,key:oldKey})).status,200);
assert.equal(sqlite.prepare('SELECT library_id FROM teacher_sets WHERE id=?').get(setId).library_id,first.data.user.libraryId);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM teacher_set_versions WHERE set_id=?').get(setId).n,1);
assert.notEqual(sqlite.prepare('SELECT key_hash FROM teacher_libraries WHERE id=?').get(oldId).key_hash,oldHash,'Old editing link is retired');
assert.equal((await owner.call('/v1/auth/claim-library',{id:oldId,key:oldKey})).status,200,'Migration retry is idempotent');
assert.equal((await other.call('/v1/libraries/'+oldId+'/sets',null,library,{Authorization:'Bearer '+oldKey})).status,401,'Private links no longer authorize edits');
assert.equal((await owner.call('/v1/libraries/'+first.data.user.libraryId+'/sets',null,library)).data.sets.length,1);
assert.equal((await teacher.call('/v1/libraries/'+first.data.user.libraryId+'/sets',null,library)).status,403,'Teachers cannot access another library');
assert.equal((await login(other,'apple','new-apple','owner@example.test')).status,403,'Apple email does not silently merge accounts');
const link=await challenge(owner,'link');assert.equal((await owner.call('/v1/auth/login',{provider:'apple',credential:await signed('apple','owner-apple','private@privaterelay.appleid.com',link.nonce),challengeId:link.id})).status,200);
const appleLogin=await login(other,'apple','owner-apple','private@privaterelay.appleid.com');assert.equal(appleLogin.status,200);assert.equal(appleLogin.data.user.libraryId,first.data.user.libraryId,'Linked Apple opens same Google owner library');
const conflict=await challenge(teacher,'link');assert.equal((await teacher.call('/v1/auth/login',{provider:'apple',credential:await signed('apple','owner-apple','private@privaterelay.appleid.com',conflict.nonce),challengeId:conflict.id})).status,409);
const bad=await challenge(owner),wrongAud=await new SignJWT({nonce:bad.nonce,email:'owner@example.test',email_verified:true}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('wrong-client').setSubject('owner-sub').setIssuedAt(Math.floor(time/1000)).setExpirationTime(Math.floor(time/1000)+60).sign(privateKey);
assert.equal((await owner.call('/v1/auth/login',{provider:'google',credential:wrongAud,challengeId:bad.id})).status,403,'Wrong audience is rejected');
const host=code=>teacher.request('/v1/rooms',{room:'matho-addition-v1-'+code,token:'e'.repeat(64)});
assert.equal(await accounts.hostAccess(host('ADAB2345')),null);
const racing=await Promise.all([accounts.hostAccess(host('ADAB2346')),accounts.hostAccess(host('ADAB2347'))]);assert.equal(racing.filter(x=>x===null).length,1,'Atomic room limit');assert.equal(racing.find(x=>x)?.status,429);
assert.equal((await accounts.hostAccess(new Browser().request('/v1/rooms',{room:'matho-addition-v1-ADAB2348',token:'e'.repeat(64)}))).status,401,'Hosting requires sign-in');
assert.equal((await owner.call('/v1/auth/teachers',{email:'teacher@example.test',action:'revoke'})).status,200);assert.equal((await teacher.call('/v1/auth/me')).status,401,'Revoked sessions stop working');
assert.equal((await owner.call('/v1/auth/teachers',{email:'owner@example.test',action:'revoke'})).status,400,'Owner cannot revoke themself');
assert.equal((await owner.call('/v1/auth/logout',{})).status,200);assert.equal((await owner.call('/v1/auth/me')).status,401);assert.equal((await other.call('/v1/auth/me')).status,200,'Logging out one device leaves the other device signed in');
time+=15*86400000;assert.equal((await other.call('/v1/auth/me')).status,401,'Sessions expire');
sqlite.close();console.log('PASS: signed provider tokens, owner bootstrap, browser-bound one-use nonce, audience checking, cookies/CSRF, invite isolation, key retirement/migration, explicit Apple linking, atomic room limits, revocation, logout, expiry.');
