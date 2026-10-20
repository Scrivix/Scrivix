/* Optional, locally generated new-call chime. No audio file or service needed. */
(function(root){
class MathoCallSound{
 constructor(storageKey){this.key=storageKey;this.context=null;this.enabled=false;try{this.enabled=localStorage.getItem(storageKey)==='on';}catch{}}
 static isNewCall(previous,next){return !!previous&&previous.epoch===next.epoch&&Array.isArray(previous.calls)&&Array.isArray(next.calls)&&next.calls.length>previous.calls.length&&next.calls.at(-1)?.id!==previous.calls.at(-1)?.id;}
 async unlock(){if(!this.enabled)return false;try{const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return false;if(!this.context||this.context.state==='closed')this.context=new Audio();if(this.context.state!=='running')await this.context.resume();return this.context.state==='running';}catch{return false;}}
 async setEnabled(value){this.enabled=!!value;if(this.enabled&&!await this.unlock())this.enabled=false;try{localStorage.setItem(this.key,this.enabled?'on':'off');}catch{}return this.enabled;}
 play(){if(!this.enabled||this.context?.state!=='running')return false;try{const ctx=this.context,start=ctx.currentTime;for(const [offset,frequency]of [[0,660],[.11,880]]){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start+offset);gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(.035,start+offset+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+offset+.16);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start+offset);oscillator.stop(start+offset+.18);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}return true;}catch{return false;}}
}
root.MathoCallSound=MathoCallSound;if(typeof module!=='undefined')module.exports=MathoCallSound;
})(globalThis);
