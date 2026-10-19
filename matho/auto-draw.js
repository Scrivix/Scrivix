/* Teacher-controlled countdown. Delayed tabs draw once, never a catch-up burst. */
(function(root){
class MathoAutoDraw{
 constructor({fire,onUpdate=()=>{},now=()=>Date.now(),schedule=fn=>setInterval(fn,200),cancel=id=>clearInterval(id)}){this.fire=fire;this.onUpdate=onUpdate;this.now=now;this.schedule=schedule;this.cancel=cancel;this.seconds=30;this.remainingMs=30000;this.deadline=0;this.running=false;this.hasStarted=false;this.reason='Auto draw is off.';this.handle=null;}
 static valid(seconds){return Number.isInteger(seconds)&&seconds>=5&&seconds<=600;}
 setSeconds(seconds){if(!MathoAutoDraw.valid(seconds))throw Error('Enter a whole number from 5 to 600 seconds.');if(seconds!==this.seconds){this.seconds=seconds;this.remainingMs=seconds*1000;if(this.running)this.deadline=this.now()+this.remainingMs;}this.onUpdate();}
 start(seconds=this.seconds){this.setSeconds(seconds);if(this.running)return;this.running=true;this.hasStarted=true;this.reason='';this.deadline=this.now()+(this.remainingMs>0?this.remainingMs:this.seconds*1000);this.handle=this.schedule(()=>this.tick());this.onUpdate();}
 pause(reason='Paused by teacher.'){if(this.running)this.remainingMs=Math.max(0,this.deadline-this.now());this.running=false;if(this.handle!=null)this.cancel(this.handle);this.handle=null;this.reason=reason;this.onUpdate();}
 stop(reason='Auto draw is off.'){this.pause(reason);this.hasStarted=false;this.remainingMs=this.seconds*1000;this.onUpdate();}
 restart(){this.remainingMs=this.seconds*1000;if(this.running)this.deadline=this.now()+this.remainingMs;this.onUpdate();}
 get secondsLeft(){return Math.ceil(Math.max(0,this.running?this.deadline-this.now():this.remainingMs)/1000);}
 tick(){if(!this.running)return;if(this.now()>=this.deadline){this.deadline=this.now()+this.seconds*1000;this.remainingMs=this.seconds*1000;if(this.fire()===false)this.stop('No expressions left in this selection.');}this.onUpdate();}
}
root.MathoAutoDraw=MathoAutoDraw;if(typeof module!=='undefined')module.exports=MathoAutoDraw;
})(globalThis);
