import {createRelay} from './relay.mjs';
import {createLibrary} from './library.mjs';
import {createAccounts} from './accounts.mjs';
const handlers=new WeakMap();
export default {async fetch(request,env){
 let pair=handlers.get(env.DB);
 if(!pair){
  const origins=(env.MATHO_ORIGINS||'https://scrivix.us,http://localhost:8879,http://127.0.0.1:8879,http://localhost:8765,http://127.0.0.1:8765').split(',');
  const accounts=createAccounts(env.DB,{origins,googleClientId:env.MATHO_GOOGLE_CLIENT_ID||'',appleClientId:env.MATHO_APPLE_CLIENT_ID||'',ownerEmail:env.MATHO_OWNER_EMAIL||''});
  pair={origins,accounts,relay:createRelay(env.DB,{origins}),library:createLibrary(env.DB,{origins,accounts})};handlers.set(env.DB,pair);
 }
 const path=new URL(request.url).pathname;
 if(path.startsWith('/v1/auth/'))return pair.accounts.handle(request);
 if(path==='/v1/rooms'&&request.method==='POST'){const denied=await pair.accounts.hostAccess(request);if(denied)return denied;}
 const result=await (/^\/v1\/(libraries(?:\/|$)|custom-sets(?:\/|$)|library-rooms(?:\/|$)|library-health$)/.test(path)?pair.library(request):pair.relay(request));
 if(pair.accounts.enabled&&pair.origins.includes(request.headers.get('Origin'))){
  const headers=new Headers(result.headers);headers.set('Access-Control-Allow-Credentials','true');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Matho-CSRF');return new Response(result.body,{status:result.status,headers});
 }
 return result;
}};
