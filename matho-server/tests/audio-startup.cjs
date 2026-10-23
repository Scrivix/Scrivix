const fs=require('fs'),vm=require('vm'),assert=require('assert');
function silent(src){if(!src.startsWith('data:audio/wav;base64,'))return false;const wav=Buffer.from(src.split(',')[1],'base64');return wav.length>44&&wav.subarray(44).every(x=>x===0);}
class Audio{constructor(src){this.src=src;this.events={};this.sources=[];this.pauses=0;}get volume(){return 1;}set volume(v){}addEventListener(k,f){this.events[k]=f;}play(){this.sources.push(this.src);this.events.playing?.();return Promise.resolve();}pause(){this.pauses++;}}
(async()=>{
 const data=new Map(),ctx={Audio,URL,localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},document:{currentScript:{src:'https://scrivix.us/matho/call-sound.js'}},setTimeout,clearTimeout,Date};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('matho/call-sound.js','utf8'),ctx);
 const sounds=['call','claim','celebrate'].map(t=>{data.set(t,'on');return new ctx.MathoCallSound(t,{tone:t});});
 assert(sounds.every(s=>!s.media),'Constructing room alerts never starts audio');
 await Promise.all(sounds.map(s=>s.unlock()));
 for(const sound of sounds){assert.equal(sound.media.volume,1,'Browser ignores volume changes');assert(sound.media.sources.every(silent),'Startup plays only actual silence, never an alert');assert(sound.media.pauses);}
 for(const sound of sounds){sound.play();await Promise.resolve();assert(!silent(sound.media.sources.at(-1)),'Actual event uses audible clip');}
 const race=new ctx.MathoCallSound('race',{defaultEnabled:true});race.ensureMedia();let resolveWarm;
 race.media.play=function(){this.sources.push(this.src);return this.sources.length===1?new Promise(r=>resolveWarm=r):Promise.resolve();};
 const warm=race.unlock();race.play();await Promise.resolve();const pauses=race.media.pauses;resolveWarm();await warm;
 assert.equal(race.media.pauses,pauses,'Late warmup cannot stop a real alert');assert(!silent(race.media.src));
 console.log('PASS silent startup for all alert types even when browser volume is fixed, audible real events, and late-warmup race protection.');
})().catch(e=>{console.error(e);process.exit(1)});
