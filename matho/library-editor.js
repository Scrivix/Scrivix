/* Save private library sets without discarding offline or concurrent drafts. */
(function(){
 const L=MathoLibrary,custom=MATHO_SET.config.id.startsWith('custom-'),panel=document.createElement('div');
 panel.className='notice';panel.id='librarySavePanel';
 panel.innerHTML='<strong>MY TEACHER LIBRARY</strong><p id="librarySaveStatus" role="status"></p><div class="bank-actions"><button id="saveLibraryCopy" type="button"></button><a href="../library/">Open my library / connect another device ↗</a></div>';
 $('#bankSection details').insertBefore(panel,$('#bankSection .bank-intro'));
 const button=$('#saveLibraryCopy'),status=$('#librarySaveStatus');
 button.textContent=custom?'Save a separate copy':'Save this set to my library';
 let lastSaved=JSON.stringify(MATHO_SET.bank),timer=null,saving=false,again=false;
 function message(text){status.textContent=text;}
 if(custom)message(MATHO_SET.config.libraryOffline?'Offline draft loaded. Changes will save when you reconnect.':state.libraryDirty?'This device has unsaved changes. Saving will preserve any newer version on another device.':'Saved in your private teacher library. Changes save automatically. Keep your private connection link to open it elsewhere.');
 else message('Save a private copy online to edit and use from your iPad, home computer, or school computer. Your original questions stay saved in this browser.');
 async function sync(){
  if(!custom||JSON.stringify(state.bank)===lastSaved&&!state.libraryDirty)return;
  if(saving){again=true;return;}saving=true;message('Saving to your teacher library…');
  const bank=structuredClone(state.bank),signature=JSON.stringify(bank);
  try{
   const result=await L.update(MATHO_SET.config.id,state.libraryRevision||MATHO_SET.config.libraryRevision,bank);
   lastSaved=signature;state.libraryRevision=result.revision;state.libraryDirty=JSON.stringify(state.bank)!==signature;
   localStorage.setItem(KEY,JSON.stringify(state));
   message(state.libraryDirty?'More changes waiting to save…':'Saved online · available on your other connected devices.');
  }catch(e){message(e.message+' Use “Save a separate copy” to keep this draft online without replacing anything.');}
  finally{saving=false;if(again){again=false;clearTimeout(timer);timer=setTimeout(sync,1500);}}
 }
 window.addEventListener('matho-bank-saved',()=>{
  if(!custom||JSON.stringify(state.bank)===lastSaved&&!state.libraryDirty)return;
  state.libraryDirty=true;try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}
  message('Changes saved on this device · saving online shortly…');clearTimeout(timer);timer=setTimeout(sync,1500);
 });
 window.addEventListener('online',sync);
 window.addEventListener('beforeunload',e=>{if(custom&&state.libraryDirty){e.preventDefault();e.returnValue='';}});
 button.onclick=async()=>{
  button.disabled=true;
  try{
   if(!L.credentials())await L.create();
   const title=prompt('Name this saved question set:',MATHO_SET.config.title+(custom?' — copy':''));if(!title?.trim())return;
   L.backup(KEY,state.bank,'Before saving a library copy');
   const saved=await L.createSet(title.trim(),state.bank,MATHO_SET.config);
   const url=L.gameUrl(saved.id);url.hash='bankSection';location.assign(url.href);
  }catch(e){message(e.message);}finally{button.disabled=false;}
 };
 if(custom&&state.libraryDirty)timer=setTimeout(sync,1500);
})();
