/* Private library credentials stay in this browser and private link fragments. */
(function(root){
 const endpoint='https://matho-live.scrivix.us',KEY='matho-teacher-library-v1';
 function credentials(){if(root.MathoTeacherAuth?.enabled()){const a=root.MathoTeacherAuth.account();return a?{id:a.libraryId,account:true}:null;}try{const c=JSON.parse(localStorage.getItem(KEY));if(/^[a-f0-9]{32}$/.test(c?.id)&&/^[a-f0-9]{64}$/.test(c?.key))return c;}catch{}return null;}
 async function request(path,{method='GET',body,privateAccess=true,credential}={}){
  const c=credential||credentials();if(privateAccess&&!c)throw Error('Connect your teacher library first.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(endpoint+path,{method,credentials:root.MathoTeacherAuth?.enabled()?'include':'omit',signal:controller.signal,headers:{...(body?{'Content-Type':'application/json'}:{}),...(privateAccess?(c.account?{'X-Matho-CSRF':root.MathoTeacherAuth.account().csrf}:{Authorization:'Bearer '+c.key}):{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await response.json();}catch{throw Error('The teacher library service is not ready. Your questions remain saved in this browser.');}if(!response.ok){const e=Error(data.error||'Could not connect to the teacher library.');e.status=response.status;throw e;}return data;}catch(e){if(e.name==='AbortError')throw Error('The teacher library connection timed out. Your local questions are safe. Try again.');throw e;}finally{clearTimeout(timer);}
 }
 const path=()=>'/v1/libraries/'+credentials()?.id+'/sets';
 function remember(c){localStorage.setItem(KEY,JSON.stringify(c));return c;}
 function link(){if(root.MathoTeacherAuth?.enabled())return new URL('/matho/',location.origin).href;const c=credentials();if(!c)return '';const url=new URL('../library/',new URL('game/',new URL('/matho/',location.origin)));url.hash=new URLSearchParams({library:c.id,key:c.key}).toString();return url.href;}
 function parse(value){const u=new URL(value,location.href),p=new URLSearchParams(u.hash.slice(1)),c={id:p.get('library'),key:p.get('key')};if(!/^[a-f0-9]{32}$/.test(c.id)||!/^[a-f0-9]{64}$/.test(c.key))throw Error('Paste the complete private library link.');return c;}
 let opening=null;
 const api={credentials,request,link,parse,migrationWarning:'',
  async ready(){if(!opening)opening=(async()=>{if(!root.MathoTeacherAuth)return;await root.MathoTeacherAuth.ready();const a=root.MathoTeacherAuth.account();if(!a||a.role!=='owner')return;let candidates=[];try{const c=JSON.parse(localStorage.getItem(KEY));if(c?.key)candidates.push(c);}catch{}try{const c=JSON.parse(sessionStorage.getItem('matho-pending-library-migration'));if(c?.key)candidates.push(c);}catch{}for(const c of candidates)try{await root.MathoTeacherAuth.api('claim-library',{method:'POST',body:c});if(localStorage.getItem(KEY)===JSON.stringify(c))localStorage.removeItem(KEY);sessionStorage.removeItem('matho-pending-library-migration');}catch(e){api.migrationWarning=e.message;}})();return opening;},
  async create(){if(root.MathoTeacherAuth?.enabled()){const c=credentials();if(!c)throw Error('Sign in to your teacher account.');return c;}return remember(await request('/v1/libraries',{method:'POST',body:{},privateAccess:false}));},
  async connect(value){if(root.MathoTeacherAuth?.enabled())throw Error('Use Teacher sign in instead of a private library link.');const c=parse(value);await request('/v1/libraries/'+c.id+'/sets',{credential:c});remember(c);},
  list:()=>request(path()),
  read:id=>request(path()+'/'+id),
  createSet:(title,bank,config)=>request(path(),{method:'POST',body:{title,bank,config}}),
  update:(id,revision,bank)=>request(path()+'/'+id,{method:'POST',body:{revision,bank}}),
  versions:id=>request(path()+'/'+id+'/versions'),
  version:(id,revision)=>request(path()+'/'+id+'/versions/'+revision),
  publicConfig:async id=>(await request('/v1/custom-sets/'+id,{privateAccess:false})).config,
  registerRoom:(setId,code)=>request('/v1/library-rooms',{method:'POST',body:{libraryId:credentials()?.id,setId,code}}),
  lookupRoom:code=>request('/v1/library-rooms/'+encodeURIComponent(code),{privateAccess:false}),
  backup(key,bank,reason){const storage=key+'-question-backups-v1';let backups=[];try{backups=JSON.parse(localStorage.getItem(storage))||[];}catch{}if(!Array.isArray(backups))backups=[];backups.push({date:Date.now(),reason,bank:structuredClone(bank)});localStorage.setItem(storage,JSON.stringify(backups.slice(-20)));},
  gameUrl(id,page=''){const url=new URL('/matho/game/'+page,location.origin);url.searchParams.set('set',id);return url;}
 };
 root.MathoLibrary=api;
})(globalThis);
