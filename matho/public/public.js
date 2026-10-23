/* Public originals are static and read-only; only an explicit copy writes to a teacher library. */
(async function(){
 const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const math=s=>'<span>\\('+esc(s)+'\\)</span>';
 let config,bank;
 try{
  const slug=new URLSearchParams(location.search).get('set');
  const response=await fetch('../sets/index.json?v=exponents-expanded-1');if(!response.ok)throw Error('The public catalogue could not load.');
  const catalogue=await response.json();if(!catalogue.some(s=>s.slug===slug))throw Error('Choose a public set from the MATHO home page.');
  const c=await fetch('../sets/'+slug+'.json?v=exponents-expanded-1');if(!c.ok)throw Error('This public set could not load.');config=await c.json();
  if(config.id!==slug||!/^[a-z0-9-]+\.json$/.test(config.bankFile))throw Error('This public set is unavailable.');
  const b=await fetch('../sets/'+config.bankFile+'?v=exponents-expanded-1');if(!b.ok)throw Error('The public questions could not load.');bank=await b.json();
  if(!Array.isArray(bank))throw Error('The question list is unavailable.');
  document.title='MATHO · '+config.title+' · Public set';$('publicTitle').textContent=config.title;
  $('publicQuestions').innerHTML=['M','A','T','H','O'].map(letter=>'<section class="library-card"><h2>Column '+letter+'</h2><div class="public-question-row public-question-head"><strong>Question</strong><strong>Answer</strong></div>'+bank.filter(q=>q.letter===letter).map(q=>'<div class="public-question-row"><div>'+math(q.question)+'</div><div>'+math(q.answer)+'</div></div>').join('')+'</section>').join('');
  $('publicStatus').textContent=bank.length+' public questions · read only';$('copyPublicSet').disabled=false;
  const renderMath=()=>{if(window.MathJax?.startup?.promise)window.MathJax.startup.promise.then(()=>MathJax.typesetPromise?.([$('publicQuestions')])).catch(()=>{});};renderMath();window.addEventListener('load',renderMath,{once:true});
 }catch(error){$('publicStatus').textContent=error.message;return;}
 $('playPublicSet').onclick=async()=>{
  const button=$('playPublicSet');button.disabled=true;
  try{await MathoTeacherAuth.ready();if(!MathoTeacherAuth.enabled()||!MathoTeacherAuth.account())throw Error('Sign in with an approved teacher account to host a game.');const url=new URL('../game/room.html',location.href);url.searchParams.set('set',config.id);url.searchParams.set('public','1');url.searchParams.set('start','1');location.assign(url.href);}
  catch(error){$('publicStatus').textContent=error.message;button.disabled=false;}
 };
 $('copyPublicSet').onclick=async()=>{
  const button=$('copyPublicSet');button.disabled=true;
  try{
   await MathoLibrary.ready();
   if(!MathoTeacherAuth.enabled())throw Error('Teacher sign-in is unavailable. Please try again later.');
   if(!MathoTeacherAuth.account()){location.assign(MathoTeacherAuth.signin(location.href));return;}
   $('publicStatus').textContent='Saving a private copy to your teacher account…';
   const saved=await MathoLibrary.createSet(config.title,structuredClone(bank),config);
   const url=MathoLibrary.gameUrl(saved.id);location.assign(url.href);
  }catch(error){$('publicStatus').textContent=error.message;button.disabled=false;}
 };
 try{await MathoTeacherAuth.ready();const signedIn=MathoTeacherAuth.enabled()&&!!MathoTeacherAuth.account();$('playPublicSet').hidden=!signedIn;$('publicPlayNote').hidden=!signedIn;}catch{}
})();
