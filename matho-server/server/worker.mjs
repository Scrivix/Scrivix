import {createRelay} from './relay.mjs';
import {createLibrary} from './library.mjs';
const handlers=new WeakMap();
export default {fetch(request,env){
 let pair=handlers.get(env.DB);
 if(!pair){const options={origins:(env.MATHO_ORIGINS||'https://scrivix.us,http://localhost:8879,http://127.0.0.1:8879,http://localhost:8765,http://127.0.0.1:8765').split(',')};pair={relay:createRelay(env.DB,options),library:createLibrary(env.DB,options)};handlers.set(env.DB,pair);}
 const path=new URL(request.url).pathname;
 return /^\/v1\/(libraries(?:\/|$)|custom-sets(?:\/|$)|library-rooms(?:\/|$)|library-health$)/.test(path)?pair.library(request):pair.relay(request);
}};
