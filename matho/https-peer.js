/* Peer-compatible HTTPS polling adapter. No WebRTC, UDP, or WebSocket required. */
(function(root){
class Events{
 constructor(){this.listeners=new Map();}
 on(event,fn){if(!this.listeners.has(event))this.listeners.set(event,[]);this.listeners.get(event).push(fn);return this;}
 emit(event,...args){for(const fn of this.listeners.get(event)||[])fn(...args);}
}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const clock=()=>root.performance?.now?.()??Date.now();
function stateKey(payload){
 if(payload?.type!=='state')return null;
 const copy={...payload};delete copy.sentAt;delete copy.clockPing;
 if(copy.clock){copy.clock={...copy.clock};delete copy.clock.sentAt;if(copy.clock.running&&Number.isFinite(copy.clock.deadline))delete copy.clock.remainingMs;}
 if(copy.role==='teacher-remote'){
  delete copy.heartbeat;
  if(copy.timer){copy.timer={...copy.timer};if(copy.timer.running&&Number.isFinite(copy.timer.deadline)){delete copy.timer.remainingMs;delete copy.timer.secondsLeft;}}
 }
 return JSON.stringify(copy);
}
class Connection extends Events{
 constructor(peer,id){super();this.owner=peer;this.remote=id;this.open=false;this.queue=Promise.resolve();}
 send(payload){if(!this.open)return;if(this.owner.session!=='host'&&payload?.type==='ping')return;if(this.owner.session!=='host'&&['hello','teacher-hello'].includes(payload?.type))payload={...payload,transportVersion:2};this.transmit('data',payload);}
 transmit(kind,payload){
  const requestId=crypto.randomUUID(),state=kind==='data'?stateKey(payload):null;
  this.queue=this.queue.then(async()=>{if(this.stableState&&state&&state===this.sentState&&!Number.isFinite(payload.clockPing)&&(payload.role!=='teacher-remote'||clock()-(this.sentStateAt??-Infinity)<10000))return;await this.owner.request('/v1/send',{room:this.owner.room,id:this.owner.session,to:this.remote,kind,payload,requestId});if(state){this.sentState=state;this.sentStateAt=clock();}}).catch(error=>{if(!this.owner.destroyed&&(error.status===403||error.status===404))this.emit('error',error);});
 }
 close(){if(!this.open)return;this.transmit('close',null);this.open=false;this.emit('close');if(this.owner.session!=='host')this.owner.destroy();}
}
class MathoHttpsPeer extends Events{
 static endpoint='';
 constructor(id,options={}){
  super();this.id=id||crypto.randomUUID();this.session=id?'host':this.id;this.room=id||null;this.endpoint=options.endpoint||MathoHttpsPeer.endpoint;this.open=false;this.destroyed=false;this.links=new Map();this.after=0;this.pollTimer=null;this.failSince=0;this.disconnected=false;
  this.heartbeatTimer=setInterval(()=>this.heartbeat(),4000);
  if(id){const key='matho-relay-host:'+id;try{this.secret=sessionStorage.getItem(key)||token();sessionStorage.setItem(key,this.secret);}catch{this.secret=token();}Promise.resolve().then(()=>this.register());}
  else{this.secret=token();Promise.resolve().then(()=>{if(!this.destroyed){this.open=true;this.emit('open',this.id);}});}
 }
 async request(path,body,query){
  if(!this.endpoint)throw Error('The online room service is not configured.');
  const url=new URL(path,this.endpoint);if(query)for(const [key,value]of Object.entries(query))url.searchParams.set(key,value);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),path==='/v1/poll'?25000:10000);
  try{
   let result,lastError;
   // Reuse the request ID on retry; the server deduplicates messages.
   for(let attempt=0;attempt<2;attempt++){
    try{result=await fetch(url,{method:body?'POST':'GET',credentials:'include',headers:{'Authorization':'Bearer '+this.secret,...(root.MathoTeacherAuth?.account()?{'X-Matho-CSRF':root.MathoTeacherAuth.account().csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',keepalive:path==='/v1/send'&&(body.kind==='close'||body.payload?.type==='ended'),signal:controller.signal});break;}catch(error){lastError=error;if(attempt||controller.signal.aborted)throw error;}
   }
   if(!result)throw lastError;const data=await result.json();
   if(!result.ok){const error=Error(data.error||'The room service could not connect.');error.status=result.status;error.type=result.status===404?'peer-unavailable':result.status===403&&path==='/v1/rooms'?'unavailable-id':'network';throw error;}
   return data;
  }finally{clearTimeout(timeout);}
 }
 async register(){
  try{const result=await this.request('/v1/rooms',{room:this.room,token:this.secret});if(this.destroyed)return;
   try{const saved=JSON.parse(sessionStorage.getItem('matho-relay-position:'+this.room));this.after=saved?.generation===result.generation?saved.after:0;}catch{this.after=0;}
   this.generation=result.generation;this.open=true;this.disconnected=false;this.failSince=0;this.emit('open',this.id);this.poll();}
  catch(error){if(!this.destroyed)this.emit('error',error);}
 }
 connect(room){
  this.room=room;const conn=new Connection(this,'host');this.links.set('host',conn);
  Promise.resolve().then(async()=>{
   try{await this.request('/v1/connect',{room,id:this.session,token:this.secret});if(this.destroyed)return;conn.open=true;conn.emit('open');this.poll();}
   catch(error){if(!this.destroyed){this.emit('error',error);conn.emit('error',error);}}
  });return conn;
 }
 async poll(){
  if(this.destroyed||!this.room||this.polling)return;clearTimeout(this.pollTimer);this.polling=true;
  try{
   const result=await this.request('/v1/poll',null,{room:this.room,id:this.session,after:this.after,wait:18000});if(this.destroyed)return;
   this.failSince=0;this.lastContact=Date.now();this.activeSessions=new Set(result.connections||[]);this.hostOnline=result.hostOnline;
   for(const event of result.messages){
    if(event.seq<=this.after)continue;
    let conn=this.links.get(event.sender);
    if(event.kind==='connect'&&this.session==='host'){
     // Repeated connect delivery must not close an already-open connection.
     if(!conn?.open){conn=new Connection(this,event.sender);conn.open=true;this.links.set(event.sender,conn);this.emit('connection',conn);}
    }else if(event.kind==='data'&&conn?.open){if(this.session==='host'&&['hello','teacher-hello'].includes(event.payload?.type))conn.stableState=event.payload.transportVersion===2;if(this.session!=='host'&&event.payload?.type==='state'){this.lastState=event.payload;this.lastStateAt=clock();}conn.emit('data',event.payload);}
    else if(event.kind==='close'&&conn?.open){conn.open=false;conn.emit('close');}
    this.after=event.seq;
    if(this.session==='host')try{sessionStorage.setItem('matho-relay-position:'+this.room,JSON.stringify({generation:this.generation,after:this.after}));}catch{}
   }
   this.heartbeat();
  }catch(error){
   if(this.destroyed)return;this.failSince=this.failSince||Date.now();
   if(error.status===403||error.status===404||Date.now()-this.failSince>15000){
    this.open=false;
    if(this.session==='host'){if(!this.disconnected){this.disconnected=true;this.emit('disconnected');}}
    else{const conn=this.links.get('host');if(conn?.open){conn.open=false;conn.emit('close');}this.emit('error',error);}
   }
  }finally{this.polling=false;if(!this.destroyed)this.pollTimer=setTimeout(()=>this.poll(),this.session==='host'?700:1200);}
 }
 heartbeat(){
  if(this.destroyed||!this.lastContact||Date.now()-this.lastContact>35000)return;
  if(this.session==='host'){
   for(const [id,conn]of this.links)if(conn.open&&this.activeSessions?.has(id)&&Date.now()-(conn.lastHeartbeat||0)>6000){conn.lastHeartbeat=Date.now();conn.emit('data',{type:'ping'});}
   }else if(this.hostOnline&&this.lastState&&this.links.get('host')?.open){
   let state=this.lastState;
   // A local connection heartbeat must advance, rather than restart, an audience clock.
   if(state.role!=='teacher-remote'){
    const elapsed=Math.max(0,clock()-this.lastStateAt);state={...state,clockPing:null};
    if(Number.isFinite(state.sentAt))state.sentAt+=elapsed;
    if(state.clock){state.clock={...state.clock};if(Number.isFinite(state.clock.sentAt))state.clock.sentAt+=elapsed;if(state.clock.running)state.clock.remainingMs=Math.max(0,state.clock.remainingMs-elapsed);}
   }
   this.links.get('host').emit('data',state);
  }
 }
 reconnect(){if(this.destroyed)return;if(this.session==='host')this.register();else this.poll();}
 destroy(){this.destroyed=true;this.open=false;clearTimeout(this.pollTimer);clearInterval(this.heartbeatTimer);for(const conn of this.links.values()){conn.open=false;conn.emit('close');}this.links.clear();}
}
root.MathoHttpsPeer=MathoHttpsPeer;if(typeof module!=='undefined')module.exports=MathoHttpsPeer;
})(globalThis);
