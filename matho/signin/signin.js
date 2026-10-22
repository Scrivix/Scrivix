(async function(){
 const A=MathoTeacherAuth,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),link=params.get('link')==='apple',next=A.safeNext(params.get('next'));
 const message=s=>$('signinStatus').textContent=s;
 function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('The sign-in provider could not load. Check whether this network allows it.'));document.head.append(s);});}
 $('retrySignin').onclick=()=>location.reload();
 try{
  const config=await A.ready();if(!config.enabled){message('Teacher sign-in is being configured. Your current library remains available.');return;}
  if(A.account()&&!link){location.replace(next);return;}
  if(link&&!A.account()){location.replace(A.signin(location.href));return;}
  if(link){$('signinTitle').textContent='Link Apple to your teacher account';$('signinIntro').textContent='Both sign-in options will open the same question sets. Linking never combines separate teacher accounts.';}
  const challenge=await A.api('challenge',{method:'POST',body:{purpose:link?'link':'login'}});
  async function complete(provider,credential){message(link?'Linking Apple…':'Signing in…');$('appleSignin').disabled=true;try{const result=await A.api('login',{method:'POST',body:{provider,credential,challengeId:challenge.id}});if(result.user)A.setAccount(result.user);location.replace(next);}catch(e){message(e.message);$('retrySignin').hidden=false;}}
  if(!link){await script('https://accounts.google.com/gsi/client');google.accounts.id.initialize({client_id:config.googleClientId,nonce:challenge.nonce,auto_select:false,callback:r=>complete('google',r.credential)});google.accounts.id.renderButton($('googleSignin'),{type:'standard',theme:'outline',size:'large',text:'signin_with',width:280});}
  if(config.appleClientId){await script('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');AppleID.auth.init({clientId:config.appleClientId,scope:'name email',redirectURI:new URL('/matho/signin/',location.origin).href,state:challenge.id,nonce:challenge.nonce,usePopup:true});$('appleSignin').hidden=false;$('appleNote').hidden=link;$('appleSignin').onclick=()=>{AppleID.auth.signIn().then(result=>{if(result.authorization?.state!==challenge.id)throw Error('Apple sign-in did not match this request.');return complete('apple',result.authorization.id_token);}).catch(e=>{message(e.error==='popup_closed_by_user'?'Sign-in cancelled.':e.message||'Apple sign-in could not complete.');});};}
  else if(link){message('Apple sign-in has not been configured yet.');return;}
  message(link?'Choose your Apple account to link it.':'Choose your teacher sign-in.');
 }catch(e){message(e.message);$('retrySignin').hidden=false;}
})();
