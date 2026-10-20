/* Shared pages load a data file, then start the same game for every question set. */
(async function(){
 const base=new URL('./',document.currentScript.src);
 const loading=document.querySelector('#gameLoading');
 try{
  const id=new URLSearchParams(location.search).get('set')||'exponents';
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))throw Error('Choose a question set from All games.');
  const response=await fetch(new URL('../sets/'+id+'.json?v=join-1',base));
  if(!response.ok)throw Error('That question set could not be loaded. Choose a set from All games.');
  const config=await response.json();
  if(config.id!==id)throw Error('The question set did not match this link.');
  const page=document.body.dataset.page;
  if(!['caller','room','student'].includes(page))throw Error('This game page is unavailable.');
  // Student pages need instructions and connection keys, never the answer bank.
  if(page!=='student'){
   if(!/^[a-z0-9-]+\.json$/.test(config.bankFile))throw Error('This question bank is unavailable.');
   const bankResponse=await fetch(new URL('../sets/'+config.bankFile+'?v=shared-1',base));
   if(!bankResponse.ok)throw Error('The question bank could not load. Please refresh and try again.');
   config.bank=await bankResponse.json();MathoRules.validateBank(config.bank);
  }
  globalThis.MATHO_SET=MathoQuestionSet.create(config,location.href);
  globalThis.DEFAULT_BANK=MATHO_SET.bank;
  document.title='MATHO · '+config.title+' · '+{caller:'Caller',room:'Teacher room',student:'Student board'}[page];
  document.body.classList.add('set-'+id);
  for(const node of document.querySelectorAll('[data-copy]')){const text=config.copy[node.dataset.copy];if(typeof text==='string')node.textContent=text;}
  for(const node of document.querySelectorAll('[data-game-page]'))node.href=MATHO_SET.url(node.dataset.gamePage).href;
  const invite=document.querySelector('#inviteHelp');
  if(invite)invite.textContent='Share this link, or ask students to open '+new URL('../join/',location.href).href+' and enter the code.';
  const engine=document.createElement('script');engine.src=new URL({caller:'app.js',room:'room.js',student:'student.js'}[page]+'?v=classroom-invite-1',base);
  await new Promise((resolve,reject)=>{engine.onload=resolve;engine.onerror=()=>reject(Error('The game could not load. Please refresh and try again.'));document.body.append(engine);});
  loading.hidden=true;document.body.removeAttribute('data-loading');
 }catch(error){
  document.body.dataset.loading='error';
  loading.textContent=error.message||'The game could not load. Please refresh and try again.';
  const link=document.createElement('a');link.href=new URL('../',base);link.textContent=' Back to All games';loading.append(link);
 }
})();
