/* Fit only the question; the column badge keeps its normal size. */
(function(){
 const selector='#currentMath,#liveCurrent,#studentCurrent';
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function content(question){
  const words=/^\\text\{([^{}]*)\}$/.exec(question);
  return words?'<span class="current-call-content current-call-words">'+escape(words[1])+'</span>':'<span class="current-call-content">\\('+escape(question)+'\\)</span>';
 }
 function fit(el){
  const text=el.querySelector('.current-call-content');if(!text||!el.clientWidth)return;
  text.style.fontSize='';
  const base=parseFloat(getComputedStyle(el).fontSize),words=text.classList.contains('current-call-words');
  if(!base)return;
  // Word phrases may wrap to three lines; formulas retain their mathematical layout.
  const fits=()=>text.scrollWidth<=text.clientWidth+1&&(!words||text.scrollHeight<=base*3.6+1);
  if(fits())return;
  let low=1,high=base;
  for(let i=0;i<12;i++){const mid=(low+high)/2;text.style.fontSize=mid+'px';if(fits())low=mid;else high=mid;}
  text.style.fontSize=Math.floor(low*10)/10+'px';
 }
 let queued=false;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;document.querySelectorAll(selector).forEach(fit);});}
 window.MathoCurrentCall={content,fitAll:schedule};
 function start(){
  document.querySelectorAll(selector).forEach(el=>{
   new MutationObserver(schedule).observe(el,{childList:true,subtree:true,characterData:true});
   if(window.ResizeObserver)new ResizeObserver(schedule).observe(el);
  });
  window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);
  document.fonts?.ready.then(schedule);schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
