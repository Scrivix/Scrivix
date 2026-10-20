import {createRelay} from './relay.mjs';
const handlers=new WeakMap();
export default {fetch(request,env){let handler=handlers.get(env.DB);if(!handler){handler=createRelay(env.DB,{origins:(env.MATHO_ORIGINS||'https://scrivix.us,http://localhost:8879,http://127.0.0.1:8879,http://localhost:8765,http://127.0.0.1:8765').split(',')});handlers.set(env.DB,handler);}return handler(request);}};
