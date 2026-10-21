
/* A remote is an authenticated controller, never a replacement host. */
(function(){
 const $=id=>document.getElementById(id),R=MathoRules,params=new URLSearchParams(location.hash.slice(1));
 const relay=params.get('relay'),key=params.get('key');let peer=null,conn=null,state=null,stopped=false,lastSeen=0,retry=null,inspected=null,attempt=0,lastHeartbeat=null;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const math=s=>'\\('+esc(s)+'\\)';let typesetting=Promise.resolve();
 function typeset(el){typesetting=typesetting.catch(()=>{}).then(async()=>{if(window.MathJax?.typesetPromise){await MathJax.startup.promise;MathJax.typesetClear?.([el]);await MathJax.typesetPromise([el]);}});}
 function status(message,ok=false){$('remoteStatus').textContent=message;$('remoteMain').hidden=!state;document.querySelectorAll('[data-remote-action]').forEach(b=>b.disabled=!ok);}
 function notice(message){$('remoteNotice').textContent=message;}
 function stop(message){stopped=true;attempt++;clearTimeout(retry);conn?.close();peer?.destroy();status(message);$('remoteMain').hidden=true;notice(message);}
 function command(action,extra={}){
  if(!conn?.open||!state||Date.now()-lastSeen>20000){notice('Waiting for the laptop connection. Try again once connected.');return;}
  conn.send({type:'teacher-command',id:crypto.randomUUID(),epoch:state.epoch,callCount:state.calls.length,action,...extra});
 }
 function render(){
  $('remoteHeading').textContent=(state.title||'MATHO')+' · Teacher remote';$('remoteMain').hidden=false;$('remoteRoom').textContent='ROOM '+state.code+' · ROUND '+state.round;
  const current=state.calls.at(-1);$('remoteCurrent').innerHTML=current?esc(current.letter)+' · '+math(current.question):'Ready for the first expression';
  $('remoteAnswer').innerHTML=current?'Answer: '+math(current.answer):'Answers appear here after each draw.';
  const pattern=R.pattern(state.pattern);$('remotePattern').innerHTML=R.patternDiagram(state.pattern)+'<strong>'+esc(pattern.label)+'</strong>';
  const pending=state.students.filter(s=>s.claim).length;
  $('remoteCount').textContent=state.students.length+' students · '+state.students.filter(s=>s.connected).length+' connected';
  $('remoteClaims').textContent=pending?pending+' MATHO '+(pending===1?'claim':'claims')+' to check':'No pending MATHO claims';
  $('remoteRoster').innerHTML=state.students.slice().sort((a,b)=>Number(!!b.claim)-Number(!!a.claim)).map(s=>'<div class="student-entry"><div class="student-row"><div><strong>'+esc(s.name)+'</strong><span class="student-meta">'+(s.connected?'Connected':'Disconnected')+' · '+s.marks.length+' marked'+(s.feedback==='valid'?' · MATHO confirmed!':'')+'</span></div><button data-inspect="'+esc(s.token)+'">View board</button></div>'+(s.claim?'<div class="student-claim"><strong>Called MATHO!</strong><button class="live-primary" data-check="'+esc(s.token)+'">Check MATHO</button></div>':'')+'</div>').join('')||'<p>Students appear here when they join.</p>';
  $('remoteNext').disabled=state.roundComplete||!state.remaining;
  $('remoteLock').textContent=state.locked?'Unlock joining':'Lock joining';
  $('remoteAuto').disabled=state.roundComplete;$('remoteAuto').textContent=state.timer.running?'Pause auto draw':'Start / resume auto draw';
  if(document.activeElement!==$('remoteSeconds'))$('remoteSeconds').value=state.timer.seconds;$('remoteSeconds').disabled=state.roundComplete;
  $('remoteTimer').textContent=Math.floor(state.timer.secondsLeft/60)+':'+String(state.timer.secondsLeft%60).padStart(2,'0');
  $('remoteWinners').textContent=state.winner?'MATHO: '+state.winner.name:'';
  $('remoteReview').hidden=!state.roundComplete;$('remoteReview').disabled=!!state.review||pending>0;
  if(inspected)renderInspection();typeset($('remoteCurrent'));typeset($('remoteAnswer'));
 }
 function renderInspection(){
  const s=state.students.find(s=>s.token===inspected);if(!s)return;
  $('remoteInspectName').textContent=s.name+'’s board';
  const marks=new Set(s.claim?.marks||s.marks),review=state.review?R.reviewBoard(s.board,[...marks],state.calls):null;
  $('remoteInspectBoard').innerHTML=R.LETTERS.map(l=>'<div class="board-letter" style="--accent:var(--'+l+')">'+l+'</div>').join('')+s.board.map((cell,i)=>'<button disabled class="board-square '+(cell.free?'free':'')+' '+(review?.incorrect.includes(i)?'review-incorrect':review?.missed.includes(i)?'review-missed':'')+'" aria-pressed="'+(cell.free||marks.has(i))+'">'+(cell.free?'FREE':/^-?\d+(?:\.\d+)?$/.test(cell.answer)?esc(cell.answer):math(cell.answer))+'</button>').join('');
  typeset($('remoteInspectBoard'));
 }
 function connect(){
  if(stopped)return;const generation=++attempt;clearTimeout(retry);conn?.close();peer?.destroy();status('Connecting to laptop…');
  peer=new Peer(undefined,{debug:0});
  peer.on('open',()=>{if(generation!==attempt)return;conn=peer.connect(relay,{reliable:true,serialization:'json'});
   conn.on('open',()=>conn.send({type:'teacher-hello',key}));
   conn.on('data',m=>{if(generation!==attempt)return;
    if(m?.type==='remote-ended'){stop('The teacher remote has been disconnected. Scan a new QR code from your laptop to reconnect.');return;}
    if(m?.type==='remote-denied'){stop('This private link is no longer valid. Scan a new QR code from your laptop.');return;}
    if(m?.type==='remote-notice'){notice(m.message);return;}
    if(m?.type!=='state'||m.role!=='teacher-remote')return;
    if(m.heartbeat&&m.heartbeat===lastHeartbeat)return;if(m.heartbeat)lastHeartbeat=m.heartbeat;state=m;lastSeen=Date.now();status('Connected to laptop',true);notice('Your laptop is hosting. Boards '+(state.roundComplete?'are locked for this round.':'and claims update here.'));render();
   });
   conn.on('close',()=>{if(generation===attempt)reconnect();});conn.on('error',()=>{if(generation===attempt)reconnect();});
  });peer.on('error',()=>{if(generation===attempt)reconnect();});setTimeout(()=>{if(generation===attempt&&!stopped&&(!lastSeen||Date.now()-lastSeen>14000))reconnect();},15000);
 }
 function reconnect(){if(stopped||retry)return;status('Reconnecting to laptop…');notice('Keep the teacher page open and the laptop awake.');retry=setTimeout(()=>{retry=null;connect();},3000);}
 for(const id of ['remoteNext','remoteLock','remoteNew','remoteEnd','remoteAuto','remoteReview'])$(id).setAttribute('data-remote-action','true');
 $('remoteNext').onclick=()=>command('next');$('remoteLock').onclick=()=>command('lock');
 $('remoteNew').onclick=()=>{if(confirm('Start a new round? Calls and marks will clear and students will get fresh boards.'))command('new-round');};
 $('remoteEnd').onclick=()=>{if(confirm('End this room and disconnect every student?'))command('end');};
 $('remoteAuto').onclick=()=>{const seconds=Number($('remoteSeconds').value);if(!Number.isInteger(seconds)||seconds<5||seconds>600){notice('Enter a whole number from 5 to 600 seconds.');return;}command('auto',{seconds});};
 $('remoteReview').onclick=()=>{if(confirm('Reveal incorrect marks and missed called answers? This closes further MATHO claims for the round.'))command('review');};
 $('remoteRoster').onclick=event=>{const inspect=event.target.closest('[data-inspect]'),check=event.target.closest('[data-check]');if(inspect){inspected=inspect.dataset.inspect;renderInspection();$('remoteInspect').showModal();}if(check){const s=state.students.find(s=>s.token===check.dataset.check);if(s?.claim)command('check',{student:s.token,claimSeq:s.seq});}};
 $('remoteCloseInspect').onclick=()=>{inspected=null;$('remoteInspect').close();};
 setInterval(()=>{if(!stopped&&state&&Date.now()-lastSeen>20000)reconnect();},5000);
 window.addEventListener('beforeunload',()=>{stopped=true;peer?.destroy();});
 if(!/^matho-teacher-[-a-f0-9]{36}-v1-[A-Z2-9]{8}$/.test(relay||'')||!/^[-a-f0-9]{36}$/.test(key||'')){stop('Open this page by scanning the private teacher QR code on your laptop.');return;}
 connect();
})();
