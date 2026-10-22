(async function(){
 const L=MathoLibrary,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let catalogue=[],sets=[],autoOpening=false;
 const message=s=>$('libraryStatus').textContent=s;
 // Remove the key from the address bar before doing any network work.
 const incoming=location.hash;if(incoming)history.replaceState(null,'',location.pathname+location.search);
 async function loadCatalogue(){
  if(catalogue.length)return;
  const r=await fetch('../sets/index.json?v=simple-library-1');if(!r.ok)throw Error('The question sets could not load. Please refresh.');
  catalogue=await r.json();
 }
 async function openBuiltIn(slug,page){
  const configResponse=await fetch('../sets/'+slug+'.json?v=simple-library-1');if(!configResponse.ok)throw Error('This set could not load.');
  const config=await configResponse.json(),latest=(await L.list()).sets;
  let saved=latest.find(s=>s.title.toLowerCase()===config.title.toLowerCase());
  if(!saved){
   const key=(config.storagePrefix||'matho-'+slug)+'-game-v1';let local;try{local=JSON.parse(localStorage.getItem(key));}catch{}
   let bank=local?.bank;
   if(!Array.isArray(bank)){const r=await fetch('../sets/'+config.bankFile+'?v=simple-library-1');if(!r.ok)throw Error('The questions could not load.');bank=await r.json();}
   L.backup(key,bank,'Before opening this set in teacher library');
   saved=await L.createSet(config.title,bank,config);
  }
  const u=L.gameUrl(saved.id,page==='host'?'room.html':'');if(page==='edit')u.hash='bankSection';location.assign(u.href);
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
   const used=new Set(),cards=[];
   for(const builtIn of catalogue){
    const existing=sets.find(s=>s.title.toLowerCase()===builtIn.title.toLowerCase());
    if(existing){used.add(existing.id);cards.push(savedCard(existing));}
    else cards.push(card(builtIn.title,'<button type="button" data-open-set="'+esc(builtIn.slug)+'" data-page="edit">Edit questions</button><button type="button" data-open-set="'+esc(builtIn.slug)+'" data-page="host">Host a game →</button>'));
   }
   for(const saved of sets)if(!used.has(saved.id))cards.push(savedCard(saved));
   $('librarySets').innerHTML=cards.join('');
   message('Choose a set to edit or play. Your saved sets follow you across connected devices.');
  }catch(e){message(e.message);}
 }
 async function openRequested(){
  const params=new URLSearchParams(location.search),slug=params.get('open');
  if(!slug||autoOpening||!L.credentials())return;
  await loadCatalogue();if(!catalogue.some(s=>s.slug===slug)){message('Choose a question set below.');return;}
  autoOpening=true;message('Opening your saved question set…');
  try{await openBuiltIn(slug,params.get('mode')==='host'?'host':params.get('mode')==='edit'?'edit':'caller');}catch(error){autoOpening=false;message(error.message);}
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
 if(!incoming)await refresh();
 await openRequested();
})();
