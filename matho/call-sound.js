/* Optional local chimes. Start audio directly inside a click for Safari. */
(function(root){
class MathoCallSound{
 constructor(storageKey){this.key=storageKey;this.context=null;this.enabled=false;this.onchange=()=>{};try{this.enabled=localStorage.getItem(storageKey)==='on';}catch{}}
 static isNewCall(previous,next){return !!previous&&previous.epoch===next.epoch&&Array.isArray(previous.calls)&&Array.isArray(next.calls)&&next.calls.length>previous.calls.length&&next.calls.at(-1)?.id!==previous.calls.at(-1)?.id;}
 get ready(){return this.enabled&&this.context?.state==='running';}
 async unlock({fresh=false}={}){
  if(!this.enabled)return false;
  try{
   const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return false;
   if(fresh||!this.context||this.context.state==='closed'||this.context.state==='interrupted'){
    const old=this.context;this.context=new Audio();if(old&&old.state!=='closed')old.close?.().catch?.(()=>{});
    this.context.onstatechange=()=>this.onchange();
   }
   const ctx=this.context;
   // Start a silent source in the same user gesture, before waiting on resume.
   if(ctx.createBuffer&&ctx.createBufferSource){const source=ctx.createBufferSource();source.buffer=ctx.createBuffer(1,1,ctx.sampleRate||44100);source.connect(ctx.destination);source.onended=()=>source.disconnect();source.start(0);}
   if(ctx.state!=='running'){
    const resumed=ctx.resume();
    let timer;try{await Promise.race([resumed,new Promise(resolve=>{timer=setTimeout(resolve,1600);})]);}finally{clearTimeout(timer);}
   }
   this.onchange();return ctx===this.context&&ctx.state==='running';
  }catch{this.onchange();return false;}
 }
 async setEnabled(value,options={}){this.enabled=!!value;if(this.enabled&&!await this.unlock(options))this.enabled=false;try{localStorage.setItem(this.key,this.enabled?'on':'off');}catch{}this.onchange();return this.enabled;}
 async test(){if(!await this.setEnabled(true,{fresh:true}))return false;return this.play();}
 play(){
  if(!this.enabled)return false;
  if(this.context?.state!=='running'){const deadline=Date.now()+1800;this.unlock().then(ok=>{if(ok&&this.enabled&&Date.now()<deadline)this.play();});return false;}
  try{const ctx=this.context,start=ctx.currentTime+.025;for(const [offset,frequency]of [[0,660],[.14,880]]){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start+offset);gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(.12,start+offset+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+offset+.23);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start+offset);oscillator.stop(start+offset+.25);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}return true;}catch{return false;}
 }
 bindToggle(button,label,notify=()=>{}){
  const render=()=>{button.textContent=label+': '+(this.ready?'on':this.enabled?'tap to enable':'off');button.setAttribute('aria-pressed',String(!!this.ready));};
  this.onchange=render;
  button.onclick=async()=>{button.disabled=true;try{if(this.ready){await this.setEnabled(false);return;}if(await this.setEnabled(true,{fresh:true}))this.play();else notify('Sound could not start. Try the test-sound button and check that Safari’s tab and your computer are not muted.');}finally{button.disabled=false;render();}};
  render();
 }
}
root.MathoCallSound=MathoCallSound;if(typeof module!=='undefined')module.exports=MathoCallSound;
})(globalThis);
