(async function(){
 const L=MathoLibrary,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let catalogue=[],sets=[],autoOpening=false;
 const message=s=>$('libraryStatus').textContent=s;
 // Remove the key from the address bar before doing any network work.
 let incoming=location.hash;if(incoming)history.replaceState(null,'',location.pathname+location.search);
 if(incoming)try{sessionStorage.setItem('matho-pending-library-migration',JSON.stringify(L.parse(location.origin+location.pathname+incoming)));}catch{}
 await L.ready();
 if(MathoTeacherAuth.enabled()){
  incoming='';
  if(!MathoTeacherAuth.account()){location.replace(MathoTeacherAuth.signin(location.href));return;}
  const account=MathoTeacherAuth.account();
  $('connectDeviceButton').hidden=true;$('deviceSection').hidden=true;
  const section=document.createElement('section');section.className='library-card';
  section.innerHTML='<div class="library-head"><p id="accountIdentity"></p><div class="library-actions"><button id="linkAppleAccount" hidden>Link Apple sign-in</button><button id="signOutTeacher">Sign out</button></div></div><details id="teacherAccess" hidden><summary>Teacher access</summary><p>Invite a teacher by their Google email address. They will get their own private question sets. This grants access; it does not send email.</p><form id="inviteTeacher"><label for="inviteEmail">Teacher’s Google email</label><input id="inviteEmail" type="email" required class="library-input"><button type="submit">Approve teacher</button></form><div id="teacherAccessList"></div></details>';
  $('connectedLibrary').prepend(section);$('accountIdentity').textContent='Signed in as '+account.email+(account.role==='owner'?' · Owner':'');
  $('signOutTeacher').onclick=async()=>{try{await MathoTeacherAuth.logout();}catch(e){message(e.message);}};
  const apple=MathoTeacherAuth.config().appleClientId;
  if(apple&&!account.providers.includes('apple')){$('linkAppleAccount').hidden=false;$('linkAppleAccount').onclick=()=>{const u=new URL('../signin/',location.href);u.searchParams.set('link','apple');location.assign(u.href);};}
  if(account.role==='owner'){
   $('teacherAccess').hidden=false;
   async function teachers(){const data=await MathoTeacherAuth.api('teachers');$('teacherAccessList').innerHTML=data.invitations.filter(i=>!i.revoked).map(i=>'<div class="library-version"><span>'+esc(i.email)+'</span><button data-revoke-teacher="'+esc(i.email)+'">Remove access</button></div>').join('')||'<p>Only you have access. Add up to '+data.limit+' invited teachers.</p>';}
   $('inviteTeacher').onsubmit=async e=>{e.preventDefault();try{await MathoTeacherAuth.api('teachers',{method:'POST',body:{email:$('inviteEmail').value,action:'invite'}});$('inviteEmail').value='';await teachers();message('Teacher approved. They can sign in at scrivix.us/matho/.');}catch(error){message(error.message);}};
   $('teacherAccessList').onclick=async e=>{const address=e.target.dataset.revokeTeacher;if(!address||!confirm('Remove this teacher’s access and end their active games?'))return;try{await MathoTeacherAuth.api('teachers',{method:'POST',body:{email:address,action:'revoke'}});await teachers();}catch(error){message(error.message);}};
   teachers().catch(e=>message(e.message));
  }
 }

 async function loadCatalogue(){
  if(catalogue.length)return;
  const r=await fetch('../sets/index.json?v=simple-library-1');if(!r.ok)throw Error('The question sets could not load. Please refresh.');
  catalogue=await r.json();catalogue.sort((a,b)=>a.title.localeCompare(b.title,'en'));
 }
 async function openBuiltIn(slug){
  const url=new URL('../public/',location.href);url.searchParams.set('set',slug);location.assign(url.href);
 }
 function card(title,actions,extra=''){return '<article class="library-card"><h3>'+esc(title)+'</h3><div class="library-actions">'+actions+'</div>'+extra+'</article>';}
 function savedCard(s){
  return card(s.title,'<a href="'+esc(L.gameUrl(s.id).href)+'#bankSection">Edit questions</a><a href="'+esc(L.gameUrl(s.id,'room.html').href)+'">Host a game →</a>','<details><summary>Saved versions</summary><button type="button" data-history="'+s.id+'">Show saved versions</button><div id="versions-'+s.id+'"></div></details>');
 }
 async function refresh(){
  const c=L.credentials();$('librarySetup').hidden=!!c;$('connectedLibrary').hidden=!c;if(!c)return;
  message('Opening your question sets…');
  try{
   await loadCatalogue();sets=(await L.list()).sets;
   $('librarySets').innerHTML=sets.length?sets.map(savedCard).join(''):'<p>Your private library is empty. Create a new set, or browse the public sets below and choose “Copy to my library.”</p>';
   $('publicLibrarySets').innerHTML=catalogue.map(s=>card(s.title,'<a href="../public/?set='+encodeURIComponent(s.slug)+'">View public set & copy →</a>','<p>Read-only original. Copies belong only to you.</p>')).join('');
   message(L.migrationWarning||'Only your own sets appear in My private library. Changes to them never change public originals or another teacher’s library.');
  }catch(e){message(e.message);}
 }
 async function openRequested(){
  const params=new URLSearchParams(location.search),slug=params.get('open');
  if(!slug||autoOpening||!L.credentials())return false;
  await loadCatalogue();if(!catalogue.some(s=>s.slug===slug)){message('Choose a question set below.');return;}
  autoOpening=true;message('Opening your saved question set…');
  try{await openBuiltIn(slug,params.get('mode')==='host'?'host':'edit');return true;}catch(error){autoOpening=false;message(error.message);}
 }
 async function connect(value){await L.connect(value);$('privateConnection').hidden=true;$('libraryQR').textContent='';await refresh();}
 if(incoming)try{await connect(location.origin+location.pathname+incoming);}catch(e){message(e.message);}
 $('createLibrary').onclick=async()=>{const b=$('createLibrary');b.disabled=true;try{await L.create();await refresh();$('connectDeviceButton').click();}catch(e){message(e.message);}finally{b.disabled=false;}};
 for(const [form,input]of [['connectLibrary','privateLink'],['switchLibrary','switchLink']])$(form).onsubmit=async e=>{e.preventDefault();try{await connect($(input).value);$(input).value='';}catch(err){message(err.message);}};
 $('refreshLibrary').onclick=refresh;
 $('showPrivateLink').onclick=()=>{const link=L.link();if(!link)return;$('privateConnection').hidden=false;$('connectionLink').href=link;$('connectionLink').textContent=link;$('libraryQR').textContent='';if(typeof QRCode==='function')new QRCode($('libraryQR'),{text:link,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});};
 $('copyLibraryLink').onclick=async()=>{try{await navigator.clipboard.writeText(L.link());message('Private library link copied. Open it on your other device, or save it somewhere private.');}catch{message('Press and hold the private link above to copy it.');}};
 $('newLibrarySet').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const instructions=$('setInstructions').value.trim()||'Solve the question and mark the matching answer in the called column.',s=await L.createSet($('setTitle').value.trim(),[],{copy:{studentInstructions:instructions}});const u=L.gameUrl(s.id);u.hash='bankSection';location.assign(u.href);}catch(err){message(err.message);}finally{b.disabled=false;}};
 $('newSetButton').onclick=()=>{$('newSetSection').open=true;$('setTitle').focus();$('newSetSection').scrollIntoView?.({behavior:'smooth',block:'start'});};
 $('connectDeviceButton').onclick=()=>{$('deviceSection').open=true;$('showPrivateLink').click();$('deviceSection').scrollIntoView?.({behavior:'smooth',block:'start'});};
 $('librarySets').onclick=async e=>{
  const slug=e.target.dataset.openSet;
  if(slug){e.target.disabled=true;message('Opening your questions…');try{await openBuiltIn(slug,e.target.dataset.page);}catch(error){message(error.message);e.target.disabled=false;}return;}
  const id=e.target.dataset.history,copyId=e.target.dataset.copySet,revision=e.target.dataset.revision;
  if(id){e.target.disabled=true;try{const data=await L.versions(id);$('versions-'+id).innerHTML=data.versions.map(v=>'<div class="library-version"><span>Version '+v.revision+' · '+esc(new Date(v.created).toLocaleString())+'</span><button data-copy-set="'+id+'" data-revision="'+v.revision+'">Save a copy</button></div>').join('');}catch(err){message(err.message);}finally{e.target.disabled=false;}}
  if(copyId){e.target.disabled=true;try{const [set,v]=await Promise.all([L.read(copyId),L.version(copyId,Number(revision))]);const title=prompt('Name this recovered copy:',set.title+' — version '+revision);if(!title?.trim())return;await L.createSet(title.trim(),v.bank,set.config);await refresh();message('Saved that version as a separate set. The current set is unchanged.');}catch(err){message(err.message);}finally{e.target.disabled=false;}}
 };
 if(await openRequested())return;
 if(!incoming)await refresh();
})();
