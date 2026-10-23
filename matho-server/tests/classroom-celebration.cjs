const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const wav=fs.readFileSync('matho/sounds/celebration.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');const rate=wav.readUInt32LE(24),count=wav.readUInt32LE(40)/2;assert(rate>=16000);assert(count/rate>2&&count/rate<4);let peak=0,energy=0;for(let i=44;i<wav.length;i+=2){const x=wav.readInt16LE(i);peak=Math.max(peak,Math.abs(x));energy+=x*x;}assert(peak<32767&&energy>100000,'Fanfare is audible and does not clip');
 class Audio{constructor(src){this.src=src;this.events={};this.style={};this.volume=.85;this.played=[];}addEventListener(k,fn){this.events[k]=fn;}play(){this.played.push(this.volume);this.events.playing?.();return Promise.resolve();}pause(){}remove(){}setAttribute(){}}
 const store=new Map(),ctx={Audio,URL,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},document:{currentScript:{src:'https://scrivix.us/matho/call-sound.js?v=celebration-1'}},setTimeout,clearTimeout,Date,console};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('matho/call-sound.js','utf8'),ctx);
 const Sound=ctx.MathoCallSound,c=new Sound('celebrate',{tone:'celebrate'});assert.equal(c.play(),false,'Silent until enabled on this screen');assert(await c.test());assert(c.media.src.endsWith('/matho/sounds/celebration.wav'));assert(c.ready);assert.equal(new Sound('claim',{tone:'claim'}).tone,'claim');assert.equal(new Sound('call').tone,'call');
 const toggle=new Sound('silent-toggle'),button={setAttribute(){}};toggle.bindToggle(button,'Sound');await button.onclick();assert(toggle.ready);assert.deepEqual(toggle.media.played,[0],'Enabling is silent');assert.equal(toggle.media.currentTime,0);assert.equal(toggle.media.volume,.85);
 toggle.play();await Promise.resolve();assert.equal(toggle.media.played.at(-1),.85,'Actual game events are audible');await button.onclick();assert(!toggle.enabled);
 const automatic=new Sound('automatic',{tone:'celebrate',defaultEnabled:true});assert(automatic.enabled);automatic.play();await Promise.resolve();assert.equal(automatic.media.played[0],.85);
 const savedOff=new Sound('silent-toggle',{defaultEnabled:true});assert(!savedOff.enabled,'Intentional off setting is preserved');
 const source=fs.readFileSync('matho/game/app.js','utf8'),fn=source.split('\n').find(line=>line.startsWith('function renderClassroomWinner()'));let plays=0,shown=0;
 const state={winner:null},w={display:true,state,displayedWinnerId:null,celebrationSound:{play(){plays++;}},classroomResultPanel:{hide(){},show(){shown++;}}};vm.createContext(w);vm.runInContext(fn,w);
 vm.runInContext('renderClassroomWinner()',w);assert.equal(plays,0);
 state.winner={id:'first',name:'Ada'};vm.runInContext('renderClassroomWinner();renderClassroomWinner()',w);assert.equal(plays,0);assert.equal(shown,1);
 state.winner={id:'second',name:'Ben'};vm.runInContext('renderClassroomWinner()',w);assert.equal(plays,0);
 w.display=false;state.winner={id:'third',name:'Cam'};vm.runInContext('renderClassroomWinner()',w);assert.equal(plays,0,'Classroom stays visual; teacher plays the confirmation sound');
 const css=fs.readFileSync('matho/live.css','utf8');assert(css.includes('.student-page .student-history-card #studentCalls{height:0;min-height:0;flex:1 1 0%;max-height:none;overflow:auto'));assert(css.includes('.student-page .student-history-card #studentCalls{height:auto;max-height:none;overflow:visible}'));
 console.log('PASS: original WAV format/duration/levels, silent native-audio switches, automatic celebration defaults, separate sound tones, visual-only classroom celebration, duplicate suppression, and responsive history overrides.');
})().catch(e=>{console.error(e);process.exit(1);});
