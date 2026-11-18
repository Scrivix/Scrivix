/* Audience clocks tick locally. Existing join/ping replies estimate teacher clock offset. */
(function(root){
 let clock=null,end=0,offset=null,bestRtt=Infinity,sampledAt=0;
 const monotonic=()=>root.performance?.now?root.performance.now():Date.now();
 function render(){
  const el=document.querySelector('#audienceClock');if(!el)return;el.hidden=!clock;if(el.dataset?.presentationClock==='true')el.parentElement?.classList.toggle('has-countdown',!!clock);if(!clock)return;
  const remaining=clock.running?end-monotonic():clock.remainingMs,seconds=Math.ceil(Math.max(0,remaining)/1000);
  const time=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  if(el.dataset?.presentationClock==='true'){const html='<span class="clock-caption">'+(clock.running?'Next expression in':'Timer paused')+'</span><strong>'+time+'</strong>';if(el.innerHTML!==html)el.innerHTML=html;}else el.textContent=(clock.running?'Next expression in ':'Paused · ')+time;
 }
 root.MathoVisibleClock={update(value,timing={}){
  const received=Date.now();
  if(timing.remote&&Number.isFinite(timing.hostTime)&&Number.isFinite(timing.echo)){
   const rtt=received-timing.echo;
   if(rtt>=0&&rtt<30000&&(rtt<=bestRtt||received-sampledAt>60000)){
    offset=timing.hostTime-(timing.echo+received)/2;bestRtt=rtt;sampledAt=received;
   }
  }
  clock=value&&Number.isFinite(value.remainingMs)?value:null;
  if(clock){
   const teacherNow=timing.remote?(offset===null?(Number.isFinite(timing.hostTime)?timing.hostTime:clock.sentAt):received+offset):received;
   const deadline=Number.isFinite(clock.deadline)?clock.deadline:clock.sentAt+clock.remainingMs;
   const left=Number.isFinite(deadline)&&Number.isFinite(teacherNow)?deadline-teacherNow:clock.remainingMs;
   end=monotonic()+Math.max(0,left);
  }
  render();
 }};
 setInterval(render,200);
 if(typeof window!=='undefined'){window.addEventListener('focus',render);window.addEventListener('pageshow',render);}
 if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',render);
})(globalThis);
