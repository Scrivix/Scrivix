/* The catalogue and question-set files are data; every link uses the same game. */
(async function(){
 const catalogue=document.querySelector('#editions');
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 try{
  const response=await fetch('sets/index.json?v=sets-2');
  if(!response.ok)throw Error('Could not load question sets.');
  const editions=await response.json();
  for(const edition of editions){
   if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(edition.slug))continue;
   const link=page=>'game/'+page+'?set='+encodeURIComponent(edition.slug);
   const card=document.createElement('article');card.className='edition-card '+(edition.color==='purple'?'purple':'gold');
   card.innerHTML='<div class="edition-sample" aria-hidden="true">'+edition.sample+'</div><div class="edition-content"><div class="eyebrow">'+esc(edition.tag)+'</div><h2>'+esc(edition.title)+'</h2><p>'+esc(edition.description)+'</p><span class="edition-detail">'+esc(edition.detail)+'</span><a class="edition-primary" href="'+link('')+'">'+esc(edition.label)+' <span>→</span></a><div class="edition-secondary"><a href="'+link('room.html')+'">Host student game</a><a href="'+link('join.html')+'">Student join ↗</a></div></div>';
   catalogue.append(card);
  }
 }catch(error){
  catalogue.innerHTML='<p>Question sets could not load. Refresh to try again, or open <a href="game/?set=addition">Addition</a> or <a href="game/?set=exponents">Exponents</a>.</p>';
 }
})();
