(async function(){
 const L=MathoLibrary,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let catalogue=[],sets=[];
 const message=s=>$('libraryStatus').textContent=s;
 // Remove the key from the address bar before doing any network work.
 const incoming=location.hash;if(incoming)history.replaceState(null,'',location.pathname+location.search);
 async function refresh(){
  const c=L.credentials();$('librarySetup').hidden=!!c;$('connectedLibrary').hidden=!c;if(!c)return;
  message('Opening your teacher library…');
  try{sets=(await L.list()).sets;$('librarySets').innerHTML=sets.length?sets.map(s=>'<article class="library-card"><h3>'+esc(s.title)+'</h3><p>Saved '+esc(new Date(s.updated).toLocaleString())+'</p><div class="library-actions"><a href="'+esc(L.gameUrl(s.id).href)+'#bankSection">Edit questions</a><a href="'+esc(L.gameUrl(s.id,'room.html').href)+'">Host a game →</a></div><button type="button" data-history="'+s.id+'">Saved versions</button><div id="versions-'+s.id+'"></div></article>').join(''):'<p>No saved sets yet. Create a set below, or bring in the questions from this device.</p>';message('Connected · your saved sets are available on every device using your private link.');}catch(e){message(e.message);}
 }
 async function connect(value){await L.connect(value);$('privateConnection').hidden=true;$('libraryQR').textContent='';await refresh();}
 if(incoming)try{await connect(location.origin+location.pathname+incoming);}catch(e){message(e.message);}
 $('createLibrary').onclick=async()=>{const b=$('createLibrary');b.disabled=true;try{await L.create();await refresh();$('showPrivateLink').click();}catch(e){message(e.message);}finally{b.disabled=false;}};
 for(const [form,input]of [['connectLibrary','privateLink'],['switchLibrary','switchLink']])$(form).onsubmit=async e=>{e.preventDefault();try{await connect($(input).value);$(input).value='';}catch(err){message(err.message);}};
 $('refreshLibrary').onclick=refresh;
 $('showPrivateLink').onclick=()=>{const link=L.link();if(!link)return;$('privateConnection').hidden=false;$('connectionLink').href=link;$('connectionLink').textContent=link;$('libraryQR').textContent='';if(typeof QRCode==='function')new QRCode($('libraryQR'),{text:link,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});};
 $('copyLibraryLink').onclick=async()=>{try{await navigator.clipboard.writeText(L.link());message('Private library link copied. Open it on your other device, or save it somewhere private.');}catch{message('Press and hold the private link above to copy it.');}};
 $('newLibrarySet').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const instructions=$('setInstructions').value.trim()||'Solve the question and mark the matching answer in the called column.',s=await L.createSet($('setTitle').value.trim(),[],{copy:{studentInstructions:instructions}});const u=L.gameUrl(s.id);u.hash='bankSection';location.assign(u.href);}catch(err){message(err.message);}finally{b.disabled=false;}};
 try{const r=await fetch('../sets/index.json?v=library-1');if(!r.ok)throw Error();catalogue=await r.json();for(const s of catalogue){const option=document.createElement('option');option.value=s.slug;option.textContent=s.title;$('localSet').append(option);}}catch{message('The built-in set list could not load. Refresh to bring in a browser bank.');}
 $('bringLocal').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const slug=$('localSet').value,r=await fetch('../sets/'+slug+'.json?v=library-1');if(!r.ok)throw Error('Could not load this set.');const config=await r.json(),key=(config.storagePrefix||'matho-'+slug)+'-game-v1';let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}let bank=saved?.bank;if(!Array.isArray(bank)){const res=await fetch('../sets/'+config.bankFile+'?v=library-1');if(!res.ok)throw Error('Could not load its questions.');bank=await res.json();}const title=prompt('Name your library copy:',config.title);if(!title?.trim())return;L.backup(key,bank,'Before bringing questions into library');await L.createSet(title.trim(),bank,config);await refresh();message('Saved a separate library copy, including your additions. Open its Edit questions link to continue.');}catch(err){message(err.message);}finally{b.disabled=false;}};
 $('librarySets').onclick=async e=>{
  const id=e.target.dataset.history,copyId=e.target.dataset.copySet,revision=e.target.dataset.revision;
  if(id){e.target.disabled=true;try{const data=await L.versions(id);$('versions-'+id).innerHTML=data.versions.map(v=>'<div class="library-version"><span>Version '+v.revision+' · '+esc(new Date(v.created).toLocaleString())+'</span><button data-copy-set="'+id+'" data-revision="'+v.revision+'">Save a copy</button></div>').join('');}catch(err){message(err.message);}finally{e.target.disabled=false;}}
  if(copyId){e.target.disabled=true;try{const [set,v]=await Promise.all([L.read(copyId),L.version(copyId,Number(revision))]);const title=prompt('Name this recovered copy:',set.title+' — version '+revision);if(!title?.trim())return;await L.createSet(title.trim(),v.bank,set.config);await refresh();message('Saved that version as a separate set. The current set is unchanged.');}catch(err){message(err.message);}finally{e.target.disabled=false;}}
 };
 if(!incoming)await refresh();
})();
