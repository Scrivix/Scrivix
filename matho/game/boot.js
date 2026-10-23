/* Shared pages load a data file, then start the same game for every question set. */
(async function(){
 const base=new URL('./',document.currentScript.src);
 const loading=document.querySelector('#gameLoading');
 try{
  const id=new URLSearchParams(location.search).get('set')||'exponents';
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))throw Error('Choose a question set from All games.');
  const page=document.body.dataset.page;
  if(!['caller','room','student'].includes(page))throw Error('This game page is unavailable.');
  const custom=/^custom-[a-f0-9]{32}$/.test(id);
  const classroom=new URLSearchParams(location.search).get('view')==='display';
  if(!custom&&page==='caller'&&!classroom){const url=new URL('../public/',base);url.searchParams.set('set',id);location.replace(url.href);return;}
  if(page!=='student'){await MathoLibrary.ready();if(MathoTeacherAuth.enabled()&&!MathoTeacherAuth.account()){location.replace(MathoTeacherAuth.signin(location.href));return;}}
  let config;
  if(custom){
   if(page==='student')config=await MathoLibrary.publicConfig(id);
   else{
    if(!MathoLibrary.credentials())throw Error('Open My teacher library and connect this device with your private library link first.');
    const key='matho-'+id+'-game-v1',metaKey=key+'-library-meta';
    let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}
    let cloud;
    try{
     cloud=await MathoLibrary.read(id);
     localStorage.setItem(metaKey,JSON.stringify({config:cloud.config,libraryId:MathoLibrary.credentials().id}));
    }catch(error){
     let cached;try{cached=JSON.parse(localStorage.getItem(metaKey));}catch{}
     if(error.status===403||error.status===404||!cached||cached.libraryId!==MathoLibrary.credentials().id||!Array.isArray(saved?.bank))throw error;
     cloud={config:cached.config,bank:saved.bank,revision:saved.libraryRevision};cloud.config.libraryOffline=true;
    }
    config=cloud.config;config.libraryRevision=cloud.revision;
    // A pending local draft survives reload and concurrent edits on another device.
    if(saved?.libraryDirty&&Array.isArray(saved.bank)){config.bank=saved.bank;config.libraryRevision=saved.libraryRevision||cloud.revision;}
    else{
     config.bank=cloud.bank;
     const current={...(saved||{}),bank:cloud.bank,called:Array.isArray(saved?.called)?saved.called:[],libraryRevision:cloud.revision,libraryDirty:false};
     if(Array.isArray(saved?.bank)&&JSON.stringify(saved.bank)!==JSON.stringify(cloud.bank))MathoLibrary.backup(key,saved.bank,'Before loading latest online version');
     localStorage.setItem(key,JSON.stringify(current));
    }
   }
  }else{
   const response=await fetch(new URL('../sets/'+id+'.json?v=accounts-1',base));
   if(!response.ok)throw Error('That question set could not be loaded. Choose a set from All games.');
   config=await response.json();
   const classroom=new URLSearchParams(location.search).get('view')==='display';
   let recoveringRoom=false;
   if(page==='room')try{const recovered=JSON.parse(sessionStorage.getItem((config.storagePrefix||'matho-'+id)+'-host-v1'));recoveringRoom=!!recovered?.code&&!recovered.ended;}catch{}
   if(page!=='student'&&!classroom&&!recoveringRoom){
    const target=new URL('../public/',base);target.searchParams.set('set',id);location.replace(target.href);return;
   }
   // Students load directions and connection keys, never the answer bank.
   if(page!=='student'){
    if(!/^[a-z0-9-]+\.json$/.test(config.bankFile))throw Error('This question bank is unavailable.');
    const bankResponse=await fetch(new URL('../sets/'+config.bankFile+'?v=silent-switches-1',base));
    if(!bankResponse.ok)throw Error('The question bank could not load. Please refresh and try again.');
    config.bank=await bankResponse.json();MathoRules.validateBank(config.bank);
   }
  }
  if(config.id!==id)throw Error('The question set did not match this link.');
  globalThis.MATHO_SET=MathoQuestionSet.create(config,location.href);
  globalThis.DEFAULT_BANK=MATHO_SET.bank;
  document.title='MATHO · '+config.title+' · '+{caller:'Caller',room:'Teacher room',student:'Student board'}[page];
  document.body.classList.add('set-'+id);if(config.displaySet==='scientific-notation')document.body.classList.add('set-scientific-notation');
  for(const node of document.querySelectorAll('[data-copy]')){const text=config.copy[node.dataset.copy];if(typeof text==='string')node.textContent=text;}
  for(const node of document.querySelectorAll('[data-game-page]'))node.href=MATHO_SET.url(node.dataset.gamePage).href;
  const invite=document.querySelector('#inviteHelp');
  if(invite)invite.textContent='Share this link, or ask students to open '+new URL('../join/',location.href).href+' and enter the code.';
  const clockScript=document.createElement('script');clockScript.src=new URL('../visible-clock.js?v=1',base);await new Promise((resolve,reject)=>{clockScript.onload=resolve;clockScript.onerror=reject;document.body.append(clockScript);});
  const engine=document.createElement('script');engine.src=new URL({caller:'app.js',room:'room.js',student:'student.js'}[page]+'?v=silent-switches-1',base);
  await new Promise((resolve,reject)=>{engine.onload=resolve;engine.onerror=()=>reject(Error('The game could not load. Please refresh and try again.'));document.body.append(engine);});
  if(page==='caller'&&new URLSearchParams(location.search).get('view')!=='display'){
   const editor=document.createElement('script');editor.src=new URL('../library-editor.js?v=silent-switches-1',base);
   await new Promise((resolve,reject)=>{editor.onload=resolve;editor.onerror=()=>reject(Error('Question library controls could not load. Refresh and try again.'));document.body.append(editor);});
  }
  loading.hidden=true;document.body.removeAttribute('data-loading');
 }catch(error){
  document.body.dataset.loading='error';
  loading.textContent=error.message||'The game could not load. Please refresh and try again.';
  const link=document.createElement('a');link.href=new URL('../',base);link.textContent=' Back to All games';loading.append(link);
 }
})();
