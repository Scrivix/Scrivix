/* Identity tokens are exchanged for a server-issued HttpOnly session cookie. */
(function(root){
 const endpoint='https://matho-live.scrivix.us';let config=null,current=null,opening=null;
 async function api(path,{method='GET',body,csrf=true}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const r=await fetch(endpoint+'/v1/auth/'+path,{method,credentials:'include',signal:controller.signal,cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(csrf&&current?{'X-Matho-CSRF':current.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{throw Error('Teacher sign-in could not load. Please retry.');}if(!r.ok){const e=Error(data.error||'Teacher sign-in could not complete.');e.status=r.status;throw e;}return data;}catch(e){if(e.name==='AbortError')throw Error('Teacher sign-in timed out. Please retry.');throw e;}finally{clearTimeout(timer);}
 }
 async function ready(){if(!opening)opening=(async()=>{config=await api('config');if(config.enabled)try{current=(await api('me')).user;}catch(e){if(e.status!==401)throw e;current=null;}return config;})();return opening;}
 function safeNext(value){try{const u=new URL(value||'/matho/library/',location.origin);if(u.origin===location.origin&&u.pathname.startsWith('/matho/')&&!u.pathname.startsWith('/matho/signin/'))return u.href;}catch{}return new URL('/matho/library/',location.origin).href;}
 function signin(next=location.href){const u=new URL('/matho/signin/',location.origin);u.searchParams.set('next',safeNext(next));return u.href;}
 async function logout(){
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('matho-custom-')&&k.endsWith('-game-v1'))try{if(JSON.parse(localStorage.getItem(k))?.libraryDirty)throw Error('Save your pending question edits before signing out.');}catch(e){if(e.message.includes('pending'))throw e;}}
  await api('logout',{method:'POST',body:{}});current=null;location.assign('/matho/');
 }
 root.MathoTeacherAuth={ready,api,enabled:()=>!!config?.enabled,account:()=>current,config:()=>config,safeNext,signin,logout,setAccount:u=>{current=u;}};
})(globalThis);
