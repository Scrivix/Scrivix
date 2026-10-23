const R=MathoRules,$=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),math=s=>`<span>\\(${esc(s)}\\)</span>`;
const SESSION=MATHO_SET.keys.host,CLASSIC=MATHO_SET.keys.classic;let room=null,peer=null,links=new Map(),busy=false;let typesetting=Promise.resolve();
function typeset(el){typesetting=typesetting.catch(()=>{}).then(async()=>{if(window.MathJax?.typesetPromise){await MathJax.startup.promise;MathJax.typesetClear?.([el]);await MathJax.typesetPromise([el]);}});}
function toast(s){$('#teacherToast').textContent=s;$('#teacherToast').hidden=false;setTimeout(()=>$('#teacherToast').hidden=true,5000);}
function status(s,error=false){$('#roomStatus').textContent=s;$('#roomStatus').classList.toggle('error',error);}
function persist(){if(room)try{sessionStorage.setItem(SESSION,JSON.stringify(room));}catch{toast('Room recovery storage is full. Keep this window open.');}}
function publishClassic(){if(!room)return;let bank=room.bank,saved;try{saved=JSON.parse(localStorage.getItem(CLASSIC));if(MATHO_SET.config.id.startsWith('custom-')&&Array.isArray(saved?.bank)&&saved.bank.length)bank=saved.bank;}catch{}const s={...(saved||{}),bank,called:room.calls,roomCode:room.ended?null:room.code,joinedCount:room.ended?0:room.students.length,pattern:room.pattern||'normal',winner:room.winner||null,clock:audienceClock('classroom'),revision:Date.now()};try{localStorage.setItem(CLASSIC,JSON.stringify(s));const c=new BroadcastChannel(MATHO_SET.keys.channel);c.postMessage(s);c.close();}catch{}}
function publicCalls(){return room.calls.map(({id,letter,question})=>({id,letter,question}));}
function send(conn,data){try{if(conn?.open)conn.send(data);}catch{}}
function sync(student){const l=links.get(student.token);send(l?.conn,{type:'state',epoch:room.epoch,code:room.code,round:room.round,clock:audienceClock('student'),pattern:room.pattern||'normal',board:student.board,name:student.name,marks:student.marks,ack:student.seq,calls:publicCalls(),feedback:student.feedback||'',resultId:student.resultId||null,incorrectCount:Number.isInteger(student.incorrectCount)?student.incorrectCount:null,roundComplete:!!room.roundComplete,review:room.review?R.reviewBoard(student.board,student.marks,room.calls):null,pending:!!student.claim});}
function broadcast(){for(const s of room.students)sync(s);}
function remaining(){return room.bank.filter(q=>q.enabled&&!room.calls.some(c=>c.id===q.id)&&($('#liveFilter').value==='all'||q.letter===$('#liveFilter').value));}
function boardHTML(board,marks){const selected=new Set(marks);return R.LETTERS.map(l=>`<div class="board-letter" style="--accent:var(--${l})">${l}</div>`).join('')+board.map((s,i)=>`<button disabled class="board-square ${s.free?'free':''}" aria-pressed="${s.free||selected.has(i)}">${s.free?'<span>✦</span>FREE':squareAnswer(s.answer)}</button>`).join('');}
function render(){if(!room)return;$('#revealReview').hidden=!room.roundComplete;$('#revealReview').disabled=!!room.review||room.students.some(s=>s.claim);$('#revealReview').textContent=room.review?'Round review revealed':'Reveal round review';for(const id of ['liveFilter','winningPattern','autoToggle','autoSeconds'])$('#'+id).disabled=!!room.roundComplete;$('#showClassroomClock').checked=!!room.showClassroomClock;$('#showStudentClock').checked=!!room.showStudentClock;$('#shareIncorrect').checked=!!room.shareIncorrectCount;$('#clearWinner').hidden=!room.winner;room.pattern=room.pattern||'normal';$('#winningPattern').value=room.pattern;renderPattern($('#teacherPatternPreview'),room.pattern);$('#teacherGame').hidden=false;$('#teacherSetup').hidden=true;$('#roomCode').textContent=room.code;const url=new URL('../join/',location.href);url.searchParams.set('set',MATHO_SET.config.id);url.searchParams.set('room',room.code);$('#joinUrl').href=url.href;$('#joinUrl').textContent=url.href;$('#lockRoom').textContent=room.locked?'Unlock joining':'Lock joining';const q=room.calls.at(-1);$('#liveCurrent').innerHTML=q?`<span class="letter-badge" style="--accent:var(--${q.letter})">${q.letter}</span>${math(q.question)}`:'Ready for the first draw';$('#liveAnswer').innerHTML=q?'<small>ANSWER · TEACHER ONLY</small>'+math(q.answer):'<small>Answers appear here after each draw</small>';$('#liveRemaining').textContent=`Round ${room.round} · ${room.calls.length} called · ${remaining().length} left in this selection`;$('#liveNext').disabled=!!room.roundComplete||!remaining().length;$('#liveUndo').disabled=!!room.roundComplete||!room.calls.length;$('#teacherCalls').innerHTML=room.calls.slice().reverse().map(c=>`<div class="room-call"><span>${c.letter}</span><div>${math(c.question)}<div class="history-answer">${math(c.answer)}</div></div></div>`).join('');renderRoster();typeset($('#liveCurrent'));typeset($('#liveAnswer'));typeset($('#teacherCalls'));}
function renderRoster(){const online=room.students.filter(s=>links.get(s.token)?.conn.open).length;$('#studentCount').textContent=`${room.students.length} students · ${online} connected`;const list=room.students.slice().sort((a,b)=>Number(!!b.claim)-Number(!!a.claim));$('#roster').innerHTML=list.length?list.map(s=>`<div class="student-entry"><div class="student-row"><div><strong>${esc(s.name)}</strong><span class="student-meta">${links.get(s.token)?.conn.open?'Connected':'Disconnected · can rejoin'} · ${s.marks.length} marked</span></div><div class="student-actions"><button data-inspect="${s.token}">View board</button><button class="remove-student" data-remove-student="${s.token}">Remove student</button></div></div>${s.claim?`<div class="student-claim"><strong>Called MATHO!</strong><div class="claim-buttons"><button class="live-primary" data-check="${s.token}">Check MATHO</button><button data-inspect="${s.token}">Inspect claim</button></div></div>`:s.feedback?`<p class="result-pill">${s.feedback==='valid'?'✓ Bingo confirmed':s.feedback==='invalid'?'Not yet · keep thinking':esc(s.feedback)}</p>`:''}</div>`).join(''):'<p class="live-note">Students will appear here when they join.</p>';}
function clearClaims(message){for(const s of room.students){s.claim=null;s.feedback=message||'';s.resultId=null;s.incorrectCount=null;}}
function createCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',a=new Uint8Array(8);crypto.getRandomValues(a);return Array.from(a,n=>alphabet[n%alphabet.length]).join('');}
async function start(newRoom){if(busy)return;busy=true;$('#createRoom').disabled=true;try{if(typeof Peer!=='function')throw Error('Live connection library could not load. Refresh and try again.');if(newRoom){let classic;try{classic=JSON.parse(localStorage.getItem(CLASSIC));}catch{}const bank=structuredClone(MATHO_SET.config.id.startsWith('custom-')?(classic?.bank||DEFAULT_BANK):DEFAULT_BANK);R.validateBank(bank);room={code:(MATHO_SET.config.joinPrefix||'')+createCode().slice((MATHO_SET.config.joinPrefix||'').length),epoch:crypto.randomUUID(),round:1,bank,calls:[],students:[],locked:false,pattern:$('#setupPattern').value||'normal'};}if(newRoom&&MATHO_SET.config.id.startsWith('custom-'))await MathoLibrary.registerRoom(MATHO_SET.config.id,room.code);status('Opening live room…');peer=new Peer(MATHO_SET.keys.peer+room.code,{debug:0});peer.on('open',()=>{busy=false;$('#createRoom').disabled=false;status('Room open · keep this window running');persist();publishClassic();render();});peer.on('connection',handleConnection);peer.on('error',err=>{busy=false;$('#createRoom').disabled=false;status(err.type==='unavailable-id'?'This room is already open in another teacher window.':'Connection interrupted. Check your network and retry.',true);if(!peer.open){$('#teacherSetup').hidden=false;$('#createRoom').textContent='Create a new room';}});peer.on('disconnected',()=>{if(autoTimer.running)autoTimer.pause('Paused while reconnecting.');status('Reconnecting room…',true);if(!peer.destroyed)peer.reconnect();});}catch(e){busy=false;$('#createRoom').disabled=false;$('#teacherSetup').hidden=false;status(e.message,true);}}
function handleConnection(conn){let student=null;const timer=setTimeout(()=>{if(!student)conn.close();},12000);conn.on('data',m=>{if(!m||typeof m!=='object'||!room)return;try{if(m.type==='hello'){if(student)return;if(typeof m.token!=='string'||!/^[-a-f0-9]{36}$/.test(m.token)||typeof m.name!=='string'||!m.name.trim())return;if(room.removedTokens?.includes(m.token)){send(conn,{type:'removed',message:'Your teacher removed you from this room. Please speak with your teacher.'});setTimeout(()=>conn.close(),300);return;}student=room.students.find(s=>s.token===m.token);if(!student){if(room.locked||room.students.length>=60){send(conn,{type:'error',message:room.locked?'Your teacher has locked this room. Ask them to unlock joining.':'This room is full.'});setTimeout(()=>conn.close(),300);return;}student={token:m.token,name:m.name.trim().slice(0,32),board:R.makeBoard(room.bank,room.students.map(s=>s.board)),marks:[],seq:0,feedback:'',claim:null};room.students.push(student);}const previous=links.get(student.token);links.set(student.token,{conn,lastSeen:Date.now()});if(previous?.conn!==conn)previous?.conn.close();clearTimeout(timer);persist();publishClassic();sync(student);renderRoster();return;}if(!student||links.get(student.token)?.conn!==conn)return;links.get(student.token).lastSeen=Date.now();if(m.type==='ping'){sync(student);return;}if(m.epoch!==room.epoch){sync(student);return;}if(room.roundComplete&&(m.type==='marks'||(m.type==='claim'&&(room.review||student.feedback==='valid')))){sync(student);return;}if(m.type==='marks'&&Number.isSafeInteger(m.seq)&&m.seq>student.seq){student.marks=R.cleanMarks(m.marks);student.seq=m.seq;student.claim=null;student.feedback='';student.resultId=null;student.incorrectCount=null;persist();sync(student);renderRoster();}if(m.type==='claim'&&Number.isSafeInteger(m.seq)&&m.seq>=student.seq){if(!room.calls.length){sync(student);return;}if((m.pattern||'normal')!==(room.pattern||'normal')){sync(student);return;}if(student.claim)return;const claimMarks=R.cleanMarks(room.roundComplete?student.marks:m.marks),claimKey=JSON.stringify([room.epoch,room.pattern||'normal',room.calls.map(c=>c.id),claimMarks]);if(student.lastClaimKey===claimKey){sync(student);return;}student.lastClaimKey=claimKey;if(!R.isBingo(student.board,claimMarks,room.calls,room.pattern||'normal')){student.marks=claimMarks;student.seq=m.seq;student.claim=null;student.feedback='invalid';student.resultId=crypto.randomUUID();student.incorrectCount=room.shareIncorrectCount?R.incorrectMarkCount(student.board,claimMarks,room.calls):null;persist();sync(student);renderRoster();return;}student.marks=claimMarks;student.seq=m.seq;student.claim={marks:student.marks.slice(),callIds:room.calls.map(c=>c.id),epoch:room.epoch,pattern:room.pattern||'normal'};student.feedback='';student.resultId=null;student.incorrectCount=null;claimSound.play();if(autoTimer.running)autoTimer.pause('Paused for a MATHO claim.');persist();sync(student);render();}}catch(e){send(conn,{type:'error',message:'Could not complete that request. Please try again.'});}});conn.on('close',()=>{clearTimeout(timer);if(student&&links.get(student.token)?.conn===conn){links.delete(student.token);renderRoster();}});conn.on('error',()=>{if(student&&links.get(student.token)?.conn===conn){links.delete(student.token);renderRoster();}});}
$('#createRoom').onclick=()=>start(true);$('#liveFilter').onchange=()=>{if(autoTimer.running){if(remaining().length)autoTimer.restart();else autoTimer.stop('No expressions left in this selection.');}render();};function drawExpression(){if(room?.roundComplete)return;const choices=remaining();if(!choices.length)return;room.winner=null;room.calls.push(R.shuffled(choices)[0]);expressionSound.play();persist();publishClassic();broadcast();render();if(autoTimer.running){if(remaining().length)autoTimer.restart();else autoTimer.stop('No expressions left in this selection.');}}$('#liveNext').onclick=drawExpression;$('#liveUndo').onclick=()=>{if(room?.roundComplete)return;autoTimer.pause('Paused after undo.');room.winner=null;room.calls.pop();clearClaims('Call list changed. Claim again when ready.');persist();publishClassic();broadcast();render();};function resetRound(){autoTimer.stop('New round · start the timer when ready.');room.round++;room.roundComplete=false;room.review=false;room.winners=[];room.epoch=crypto.randomUUID();room.calls=[];room.winner=null;const boards=[];for(const s of room.students){s.board=R.makeBoard(room.bank,boards);boards.push(s.board);s.marks=[];s.seq=0;s.feedback='New round! Your board has been reshuffled.';s.claim=null;s.resultId=null;s.incorrectCount=null;}persist();publishClassic();broadcast();render();}let pendingAction=null;function askAction(title,text,action){if(autoTimer.running)autoTimer.pause('Paused while reviewing game rules.');pendingAction=action;$('#roomActionTitle').textContent=title;$('#roomActionText').textContent=text;$('#roomActionDialog').showModal();}$('#liveReset').onclick=()=>askAction('Start a new round?','This clears all calls and student marks and deals fresh boards. Students stay in the room.',resetRound);$('#cancelRoomAction').onclick=()=>{$('#roomActionDialog').close();pendingAction=null;};$('#confirmRoomAction').onclick=()=>{$('#roomActionDialog').close();const action=pendingAction;pendingAction=null;action?.();};$('#lockRoom').onclick=()=>{room.locked=!room.locked;persist();render();};$('#copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText($('#joinUrl').href);toast('Student join link copied.');}catch{toast('Copy the link shown beneath the room code.');}};$('#openRoomDisplay').onclick=()=>window.open(MATHO_SET.url('',{view:'display'}),MATHO_SET.keys.classroom,'popup,width=1400,height=900');$('#endRoom').onclick=()=>askAction('End this room?','All students will be disconnected. You can create a new room whenever you are ready.',()=>{autoTimer.stop('Room ended.');room.ended=true;stopTeacherRemote();publishClassic();for(const l of links.values())send(l.conn,{type:'ended'});sessionStorage.removeItem(SESSION);room=null;links.clear();setTimeout(()=>{peer?.destroy();location.reload();},250);});
$('#roster').onclick=e=>{const remove=e.target.closest('[data-remove-student]');if(remove){const s=room.students.find(s=>s.token===remove.dataset.removeStudent);if(s)askAction('Remove student?',s.name+' will be removed from this room, and this student session will be blocked from rejoining. Ask them to speak with you before trying again.',()=>removeStudent(s.token));return;}const inspect=e.target.closest('[data-inspect]'),check=e.target.closest('[data-check]');if(inspect){const s=room.students.find(s=>s.token===inspect.dataset.inspect);if(!s)return;$('#inspectName').textContent=s.name+(s.claim?' · submitted claim':' · current board');$('#inspectBoard').innerHTML=boardHTML(s.board,s.claim?.marks||s.marks);$('#inspectDialog').showModal();typeset($('#inspectBoard'));}if(check){const s=room.students.find(s=>s.token===check.dataset.check);if(!s?.claim)return;const claim=s.claim;const called=room.calls.filter(c=>claim.callIds.includes(c.id));const valid=claim.epoch===room.epoch&&(claim.pattern||'normal')===(room.pattern||'normal')&&R.isBingo(s.board,claim.marks,called,room.pattern||'normal');s.feedback=valid?'valid':'invalid';s.resultId=crypto.randomUUID();s.incorrectCount=!valid&&room.shareIncorrectCount?R.incorrectMarkCount(s.board,claim.marks,called):null;s.claim=null;if(valid){const newlyConfirmed=!room.winners?.some(w=>w.token===s.token);room.winners=room.winners||room.students.filter(player=>player.feedback==='valid').map(player=>({id:player.resultId||crypto.randomUUID(),name:player.name,round:room.round,token:player.token}));if(!room.winners.some(w=>w.token===s.token)){room.winners.push({id:s.resultId,name:s.name,round:room.round,token:s.token});}if(newlyConfirmed)celebrationSound.play();room.winner={id:crypto.randomUUID(),name:room.winners.map(w=>w.name).join(' & '),names:room.winners.map(w=>w.name),round:room.round};room.roundComplete=true;autoTimer.stop('Round complete · check remaining claims, then reveal the review.');}persist();publishClassic();broadcast();render();$('#clearWinner').hidden=!room.winner;toast(s.name+': '+(valid?'Bingo confirmed!':'Not yet. No incorrect squares were revealed.'));}};$('#closeInspect').onclick=()=>$('#inspectDialog').close();
window.addEventListener('load',()=>{if(room)render();});window.addEventListener('beforeunload',e=>{if(room&&links.size){e.preventDefault();e.returnValue='';}});setInterval(()=>{if(!room)return;for(const [token,l] of links){if(Date.now()-l.lastSeen>22000){l.conn.close();links.delete(token);renderRoster();}else sync(room.students.find(s=>s.token===token));}},6000);
try{const saved=JSON.parse(sessionStorage.getItem(SESSION));if(saved?.code&&saved?.bank&&saved?.students){room=saved;start(false);}}catch{}

function renderPattern(el,id){const p=R.pattern(id);el.innerHTML=R.patternDiagram(id)+'<div><strong>'+esc(p.label)+'</strong><p>'+esc(p.description)+'</p></div>';}
$('#setupPattern').onchange=()=>renderPattern($('#setupPatternPreview'),$('#setupPattern').value);
const requestedPattern=new URLSearchParams(location.search).get('pattern');if(R.PATTERNS[requestedPattern])$('#setupPattern').value=requestedPattern;
renderPattern($('#setupPatternPreview'),$('#setupPattern').value||'normal');
$('#winningPattern').onchange=()=>{if(room?.roundComplete)return;const id=$('#winningPattern').value;if(!R.PATTERNS[id])return;const old=room.pattern||'normal';$('#winningPattern').value=old;if(id===old)return;askAction('Change the winning pattern?','Calls and student marks will stay. Pending claims will be cleared, and everyone will see the new goal.',()=>{room.pattern=id;room.winner=null;clearClaims('Winning pattern changed. Check the new goal before claiming.');persist();publishClassic();broadcast();render();});};

function renderAutoTimer(){if(typeof autoTimer==='undefined')return;const seconds=autoTimer.secondsLeft;$('#autoCountdown').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$('#autoToggle').textContent=autoTimer.running?'Pause auto draw':autoTimer.hasStarted?'Resume auto draw':'Start auto draw';$('#autoToggle').setAttribute('aria-pressed',String(autoTimer.running));$('#autoStatus').textContent=autoTimer.running?'Running · next expression when the countdown ends.':autoTimer.reason;}
const autoTimer=new MathoAutoDraw({fire:()=>{if(!remaining().length)return false;drawExpression();return remaining().length>0;},onUpdate:()=>{renderAutoTimer();publishClockChange();}});
try{const saved=Number(localStorage.getItem(CLASSIC+'-auto-seconds'));if(MathoAutoDraw.valid(saved)){autoTimer.setSeconds(saved);$('#autoSeconds').value=String(saved);}}catch{}
$('#autoToggle').onclick=()=>{if(room?.roundComplete)return;if(autoTimer.running){autoTimer.pause();return;}if(room.students.some(s=>s.claim)){toast('Check pending MATHO claims before resuming.');return;}if(!remaining().length){autoTimer.stop('No expressions left in this selection.');return;}try{autoTimer.start(Number($('#autoSeconds').value));localStorage.setItem(CLASSIC+'-auto-seconds',String(autoTimer.seconds));}catch(e){autoTimer.pause(e.message);toast(e.message);}};
$('#autoSeconds').onchange=()=>{try{autoTimer.setSeconds(Number($('#autoSeconds').value));localStorage.setItem(CLASSIC+'-auto-seconds',String(autoTimer.seconds));}catch(e){autoTimer.pause(e.message);toast(e.message);}};renderAutoTimer();

function squareAnswer(answer){const content=/^-?\d+(?:\.\d+)?$/.test(answer)?'<span class="numeric-answer">'+esc(answer)+'</span>':math(answer);return '<span class="square-scroll"><span class="square-answer">'+content+'</span></span>';}

$('#shareIncorrect').onchange=()=>{room.shareIncorrectCount=$('#shareIncorrect').checked;persist();};
$('#clearWinner').onclick=()=>{room.winner=null;persist();publishClassic();$('#clearWinner').hidden=true;};

const claimSound=new MathoCallSound(CLASSIC+'-claim-sound',{tone:'claim'});
const expressionSound=new MathoCallSound(CLASSIC+'-expression-sound');
const celebrationSound=new MathoCallSound(CLASSIC+'-winner-celebration-sound',{tone:'celebrate',defaultEnabled:true});

claimSound.bindToggle($('#claimSoundToggle'),'MATHO alerts',toast);
expressionSound.bindToggle($('#expressionSoundToggle'),'New expression sound',toast);
celebrationSound.bindToggle($('#celebrationSoundToggle'),'Winner celebration',toast);
window.addEventListener('click',event=>{if(event.target?.closest?.('#claimSoundToggle,#expressionSoundToggle,#celebrationSoundToggle'))return;claimSound.unlock();expressionSound.unlock();celebrationSound.unlock();});

$('#revealReview').onclick=()=>{if(!room?.roundComplete||room.review)return;if(room.students.some(s=>s.claim)){toast('Check the remaining MATHO claims before revealing the review.');return;}room.review=true;persist();broadcast();render();toast('Round review revealed. Choose New Round when everyone is ready.');};

/* Private teacher remote uses a separate relay room; student capacity and credentials are unchanged. */
let teacherPeer=null,teacherRemoteLinks=new Set(),teacherRemoteLast='',teacherRemoteTimer=null,teacherRemoteGeneration=crypto.randomUUID(),teacherRemoteBeat=0;
function teacherSnapshot(){
 if(!room)return null;
 return {type:'state',role:'teacher-remote',heartbeat:teacherRemoteGeneration+':'+(++teacherRemoteBeat),title:MATHO_SET.config.title,code:room.code,epoch:room.epoch,round:room.round,pattern:room.pattern||'normal',
 locked:!!room.locked,roundComplete:!!room.roundComplete,review:!!room.review,winner:room.winner||null,
 calls:room.calls.slice(),remaining:remaining().length,filter:$('#liveFilter').value||'all',
 timer:{running:autoTimer.running,seconds:autoTimer.seconds,secondsLeft:autoTimer.secondsLeft,remainingMs:Math.max(0,autoTimer.running?autoTimer.deadline-Date.now():autoTimer.remainingMs),reason:autoTimer.reason},
 students:room.students.map(s=>({token:s.token,name:s.name,board:s.board,marks:s.marks,seq:s.seq,claim:s.claim,feedback:s.feedback,
 connected:!!links.get(s.token)?.conn.open}))};
}
function updateTeacherRemotes(){const snapshot=teacherSnapshot();if(!snapshot)return;for(const c of teacherRemoteLinks)send(c,snapshot);}
function stopTeacherRemote(){
 $('#teacherRemoteDialog').close();
 for(const c of teacherRemoteLinks)send(c,{type:'remote-ended'});
 teacherRemoteLinks.clear();clearInterval(teacherRemoteTimer);
 const old=teacherPeer;teacherPeer=null;if(old)setTimeout(()=>old.destroy(),300);
}
function startTeacherRemote(){
 if(!room?.remote)return;if(teacherPeer){if(!teacherPeer.open&&!teacherPeer.destroyed)teacherPeer.reconnect();return;}
 teacherPeer=new Peer(room.remote.relay,{debug:0});
 teacherPeer.on('connection',conn=>{
  let authorized=false;const timeout=setTimeout(()=>{if(!authorized)conn.close();},12000);
  conn.on('data',m=>{
   if(!room||!m||typeof m!=='object')return;
   if(!authorized){
    if(m.type!=='teacher-hello'||m.key!==room.remote?.key){send(conn,{type:'remote-denied'});setTimeout(()=>conn.close(),200);return;}
    authorized=true;clearTimeout(timeout);teacherRemoteLinks.add(conn);send(conn,teacherSnapshot());return;
   }
   if(m.type==='ping'||m.type==='teacher-ping'){send(conn,teacherSnapshot());return;}
   if(m.type!=='teacher-command')return;
   if(!/^[-a-f0-9]{36}$/.test(m.id||'')||m.epoch!==room.epoch||m.callCount!==room.calls.length){send(conn,{type:'remote-notice',message:'The game changed. Your remote has refreshed; try again.'});send(conn,teacherSnapshot());return;}
   room.remote.done=room.remote.done||[];if(room.remote.done.includes(m.id)){send(conn,teacherSnapshot());return;}
   const allowed=['next','check','review','new-round','lock','auto','end'];if(!allowed.includes(m.action))return;
   room.remote.done.push(m.id);room.remote.done=room.remote.done.slice(-100);persist();
   switch(m.action){
    case 'next':$('#liveNext').onclick();break;
    case 'check':{const s=room.students.find(s=>s.token===m.student);if(!s?.claim||s.seq!==m.claimSeq)break;
     $('#roster').onclick({target:{closest:selector=>selector==='[data-check]'?{dataset:{check:s.token}}:null}});break;}
    case 'review':$('#revealReview').onclick();break;
    case 'new-round':$('#liveReset').onclick();$('#confirmRoomAction').onclick();break;
    case 'lock':$('#lockRoom').onclick();break;
    case 'auto':if(m.seconds!==undefined){if(!MathoAutoDraw.valid(m.seconds))break;$('#autoSeconds').value=String(m.seconds);}$('#autoToggle').onclick();break;
    case 'end':$('#endRoom').onclick();$('#confirmRoomAction').onclick();return;
   }
   updateTeacherRemotes();
  });
  conn.on('close',()=>{clearTimeout(timeout);teacherRemoteLinks.delete(conn);});
  conn.on('error',()=>{clearTimeout(timeout);teacherRemoteLinks.delete(conn);});
 });
 teacherPeer.on('error',()=>{$('#remotePairStatus').textContent='Remote connection interrupted. Close this panel and try Connect iPad again.';});
 teacherPeer.on('disconnected',()=>{if(teacherPeer&&!teacherPeer.destroyed)teacherPeer.reconnect();});
 teacherRemoteTimer=setInterval(updateTeacherRemotes,2500);
}
function showTeacherPairing(){
 if(!room)return;
 if(!room.remote){room.remote={relay:'matho-teacher-'+crypto.randomUUID()+'-v1-'+room.code,key:crypto.randomUUID(),done:[]};persist();}
 startTeacherRemote();
 const url=new URL('remote.html',location.href);url.searchParams.set('set',MATHO_SET.config.id);
 url.hash=new URLSearchParams({relay:room.remote.relay,key:room.remote.key}).toString();
 $('#privateTeacherLink').href=url.href;$('#privateTeacherLink').textContent='Open private teacher remote';
 const qr=qrcode(0,'M');qr.addData(url.href);qr.make();$('#teacherQr').innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true});
 $('#remotePairStatus').textContent='Scan with your iPad camera. Keep the laptop awake and this teacher page open.';
 $('#teacherRemoteDialog').showModal();
}
$('#connectTeacherRemote').onclick=showTeacherPairing;
$('#closeTeacherPair').onclick=()=>$('#teacherRemoteDialog').close();
$('#copyTeacherRemote').onclick=async()=>{try{await navigator.clipboard.writeText($('#privateTeacherLink').href);$('#remotePairStatus').textContent='Private link copied. Open it only on your own device.';}catch{$('#remotePairStatus').textContent='Use the QR code, or open the private link and copy its address.';}};
$('#disconnectTeacherRemote').onclick=()=>{stopTeacherRemote();if(room){delete room.remote;persist();}$('#teacherRemoteDialog').close();toast('Teacher remote disconnected. Connect iPad creates a new private link.');};
if(room?.remote)startTeacherRemote();

$('#editQuestionBank').href=MATHO_SET.url('').href+'#bankSection';

function audienceClock(view){if(!room||room.ended||!(view==='student'?room.showStudentClock:room.showClassroomClock)||!autoTimer.hasStarted)return null;return {sentAt:Date.now(),running:autoTimer.running,remainingMs:Math.max(0,autoTimer.running?autoTimer.deadline-Date.now():autoTimer.remainingMs)};}
var lastAudienceClockKey;
function publishClockChange(){if(!room)return;const key=JSON.stringify([autoTimer.running,autoTimer.hasStarted,autoTimer.deadline,autoTimer.running?null:autoTimer.remainingMs,!!room.showClassroomClock,!!room.showStudentClock]);if(key===lastAudienceClockKey)return;lastAudienceClockKey=key;persist();publishClassic();broadcast();}
for(const [id,field] of [['showClassroomClock','showClassroomClock'],['showStudentClock','showStudentClock']])$('#'+id).onchange=e=>{if(!room)return;room[field]=e.target.checked;publishClockChange();};


function removeStudent(token){
 if(!room)return;const student=room.students.find(s=>s.token===token);if(!student)return;
 room.removedTokens=room.removedTokens||[];if(!room.removedTokens.includes(token))room.removedTokens.push(token);
 const connection=links.get(token)?.conn;
 send(connection,{type:'removed',message:'Your teacher removed you from this room. Please speak with your teacher.'});
 links.delete(token);room.students=room.students.filter(s=>s.token!==token);
 if(room.winners?.some(w=>w.token===token)){
  room.winners=room.winners.filter(w=>w.token!==token);
  room.winner=room.winners.length?{id:crypto.randomUUID(),name:room.winners.map(w=>w.name).join(' & '),names:room.winners.map(w=>w.name),round:room.round}:null;
 }
 persist();publishClassic();broadcast();render();updateTeacherRemotes();
 setTimeout(()=>connection?.close(),300);toast('Student removed. Their current session cannot rejoin this room.');
}


// Start once from the set editor; recovery always keeps the existing room.
if(new URLSearchParams(location.search).get('start')==='1'){
 const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('start');
 history.replaceState(null,'',cleanUrl.href);
 if(!room){$('#teacherSetup').hidden=true;start(true);}
}
