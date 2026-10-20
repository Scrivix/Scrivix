const assert=require('assert'),Peer=require('../client/https-peer.js');
const peer=Object.assign(Object.create(Peer.prototype),{endpoint:'https://relay.test',secret:'a'.repeat(64)}),requests=[];
global.fetch=async(url,options)=>{requests.push(options);return{ok:true,json:async()=>({ok:true})};};
(async()=>{
 await peer.request('/v1/send',{kind:'data',payload:{type:'state',board:'x'.repeat(10000)}});
 assert.equal(requests.at(-1).keepalive,false,'Normal board updates must not consume the shared browser keepalive quota');
 await peer.request('/v1/send',{kind:'data',payload:{type:'ended'}});assert.equal(requests.at(-1).keepalive,true);
 await peer.request('/v1/send',{kind:'close',payload:null});assert.equal(requests.at(-1).keepalive,true);
 console.log('PASS: large board updates avoid browser unload quota; small end/close notifications survive navigation.');
})().catch(e=>{console.error(e);process.exit(1)});
