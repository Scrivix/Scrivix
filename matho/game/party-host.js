/* All team membership, secret choices, and unrevealed patterns stay with the host. */
const MathoPartyHost={
 team(student){return room?.teamMode?room.teams?.find(t=>t.members.includes(student.token)):null;},
 members(team){return room.students.filter(s=>team.members.includes(s.token));},
 recoverSeat(token,name){
  const canonical=room.resumeAliases?.[token]||token,direct=room.students.find(s=>s.token===canonical),key=MathoPartyRules.nameKey(name);
  if(direct&&(!room.teamMode||this.team(direct)))return direct;
  const same=room.students.filter(s=>MathoPartyRules.nameKey(s.name)===key),teamed=same.filter(s=>this.team(s));
  const connected=s=>this.connected({members:[s.token]}).length>0;
  const candidates=teamed.length?teamed:same;
  let recovered=null;
  if(candidates.length===1&&!connected(candidates[0]))recovered=candidates[0];
  if(recovered&&recovered!==direct){
   if(direct){room.resumeAliases=room.resumeAliases||{};for(const [alias,target] of Object.entries(room.resumeAliases))if(target===direct.token)room.resumeAliases[alias]=recovered.token;room.resumeAliases[direct.token]=recovered.token;const duplicate=links.get(direct.token)?.conn;send(duplicate,{type:'replaced',message:'Your original board has been restored in another tab.'});links.delete(direct.token);room.students=room.students.filter(s=>s!==direct);if(duplicate)setTimeout(()=>duplicate.close(),300);}
   room.resumeAliases=room.resumeAliases||{};room.resumeAliases[token]=recovered.token;return recovered;
  }
  if(direct){
   if(room.teamMode&&!this.team(direct)&&teamed.some(s=>s!==direct&&connected(s)))throw Error('That name already has a connected board. Close the other tab before rejoining, or add a last initial if you are a different student.');
   return direct;
  }
  if(same.length)throw Error(candidates.length>1?'More than one board has that name. Ask your teacher to remove the duplicate, or use your saved browser tab.':'That name is still connected. Close the other tab and try again shortly, or add a last initial if you are a different student.');
  return null;
 },
 assignLate(student){
  if(!room?.teamMode||this.team(student)||room.roundComplete)return;
  const available=(room.teams||[]).filter(t=>!t.finished&&!this.members(t).some(s=>s.claim||(s.failedClaims||0)>=3));
  const solo=available.filter(t=>this.connected(t).length===1),live=available.filter(t=>this.connected(t).length>0),pool=solo.length?solo:live.length?live:available;
  let team;
  if(pool.length){const smallest=Math.min(...pool.map(t=>t.members.length));team=R.shuffled(pool.filter(t=>t.members.length===smallest))[0];const partner=this.members(team)[0];student.board=structuredClone(partner.board);student.marks=partner.marks.slice();student.failedClaims=Math.max(0,...this.members(team).map(s=>s.failedClaims||0));student.feedback='';student.claim=null;student.resultId=null;student.incorrectCount=null;team.members.push(student.token);}
  else{
   const order=this.paced()&&room.teamOrderMode==='random'?R.shuffled(room.teamQueue).map(q=>q.id):null;
   team={id:crypto.randomUUID(),members:[student.token],order,present:[],connected:[],agreements:{},ballots:{},attempt:crypto.randomUUID(),cursor:0,finished:false,resolution:null,waitDeadline:null,status:'ready',complete:false,callId:null};
   team.callId=this.paced()?this.queue(team)[0]?.id||null:room.calls.at(-1)?.id||null;room.teams=room.teams||[];room.teams.push(team);
  }
  student.teamJoinNotice={id:crypto.randomUUID(),message:'You joined a team'+(this.paced()?' at question '+this.calls(student).length:'')+'. Your board and marked answers now match your teammates.'};
  room.teamPairs=MathoPartyRules.pairs(room.teams.map(t=>t.members));this.expose();
 },
 recoveryUntil:0,
 eligible(team){const connected=this.connected(team);return Date.now()<this.recoveryUntil?this.members(team).filter(s=>(team.present||team.members).includes(s.token)||connected.some(p=>p.token===s.token)):connected;},
 connected(team){return this.members(team).filter(s=>{const link=links.get(s.token);return !!link?.conn.open&&Date.now()-link.lastSeen<=22000;});},
 presenceChanged(student){
  const team=this.team(student);if(!team)return;
  const present=this.eligible(team).map(s=>s.token),previous=team.present||team.members,connected=this.connected(team).map(s=>s.token),previousConnected=team.connected||previous;
  const quorumChanged=present.length!==previous.length||present.some(token=>!previous.includes(token)),connectionChanged=connected.length!==previousConnected.length||connected.some(token=>!previousConnected.includes(token));
  team.present=present;team.connected=connected;
  if(!quorumChanged&&!connectionChanged)return;
  if(quorumChanged){
   for(const token of Object.keys(team.ballots||{}))if(!present.includes(token))delete team.ballots[token];if(!Object.keys(team.ballots||{}).length)team.waitDeadline=null;
   if(!team.complete){team.attempt=crypto.randomUUID();team.status=Object.keys(team.ballots).length?'waiting':'ready';this.resolve(team);}
  }
  persist();this.syncTeam(team);if(this.paced())publishClassic();renderRoster();this.render();updateTeacherRemotes();
 },
 resolve(team,timed=false){
  const members=this.members(team),eligible=this.eligible(team),voters=timed?eligible.filter(s=>Object.hasOwn(team.ballots,s.token)):eligible,student=members[0],call=student&&this.calls(student).at(-1);
  if(room.roundComplete||!call||team.complete||!voters.length||members.some(s=>s.claim||(s.failedClaims||0)>=3)||!voters.every(s=>Object.hasOwn(team.ballots,s.token)))return false;
  const choices=voters.map(s=>team.ballots[s.token]),same=choices.every(i=>i===choices[0]),square=choices[0];
  const correct=same&&(square===-1?!student.board.some(cell=>!cell.free&&cell.letter===call.letter&&R.canonical(cell.answer)===R.canonical(call.answer)):student.board[square]?.letter===call.letter&&R.canonical(student.board[square].answer)===R.canonical(call.answer));
  team.waitDeadline=null;
  if(same&&(!timed||correct)){
   const next=R.cleanMarks(members[0].marks);
   if(square!==-1&&!next.includes(square)&&next.length<Math.min(24,this.calls(student).length))next.push(square);
   for(const s of members){s.marks=R.cleanMarks(next);s.feedback='';s.resultId=null;s.claim=null;s.incorrectCount=null;}
   team.agreements=team.agreements||{};team.agreements[call.id]=square;team.complete=true;team.status=timed?'timeout-correct':square===-1?'skipped':'matched';team.resolution={id:crypto.randomUUID(),status:team.status,turn:this.calls(student).length};if(this.paced())this.advance(team);
  }else{team.ballots={};team.status=timed?'timeout-incorrect':'mismatch';team.attempt=crypto.randomUUID();team.resolution={id:crypto.randomUUID(),status:team.status,turn:this.calls(student).length};}
  return true;
 },
 checkTimeouts(){
  if(!this.paced()||room.roundComplete)return;let changed=false;
  for(const team of room.teams||[]){
   if(!team.waitDeadline||team.waitDeadline>Date.now()||this.eligible(team).length>this.connected(team).length)continue;
   const student=this.connected(team)[0];if(student)this.presenceChanged(student);
   if(team.waitDeadline&&team.waitDeadline<=Date.now()&&this.resolve(team,true)){this.syncTeam(team);changed=true;}
  }
  if(changed){persist();publishClassic();renderRoster();this.render();updateTeacherRemotes();}
 },
 queue(team){if(!team?.order)return room.teamQueue||[];const questions=new Map((room.teamQueue||[]).map(q=>[q.id,q]));return team.order.map(id=>questions.get(id)).filter(Boolean);},
 sanitizeMystery(){if(room?.mysteryEnabled&&!MathoPartyRules.compatible(room.pattern||'normal',room.secretPattern)){room.mysteryEnabled=false;room.secretPattern=null;return true;}return false;},
 mysteryOptions(){const select=$('#partySecret'),old=select.value,primary=room?.pattern||'normal',label=R.pattern(primary).label;if(this.mysteryPrimary===primary){if(!MathoPartyRules.compatible(primary,old))select.value=Object.keys(R.PATTERNS).find(id=>MathoPartyRules.compatible(primary,id));return;}this.mysteryPrimary=primary;select.innerHTML=Object.entries(R.PATTERNS).map(([id,p])=>{const unavailable=!MathoPartyRules.compatible(primary,id);return '<option value="'+id+'"'+(unavailable?' disabled':'')+'>'+esc(p.label+(unavailable?' · already satisfies '+label:''))+'</option>';}).join('');select.value=MathoPartyRules.compatible(primary,old)?old:Object.keys(R.PATTERNS).find(id=>MathoPartyRules.compatible(primary,id));$('#partySecretHelp').textContent='Unavailable patterns always complete '+label+' first or at the same time.';},
 paced(){return !!(room?.teamMode&&room.teamSelfPaced);},
 calls(student){const t=student&&this.team(student);if(!this.paced())return room.calls;if(!t)return [];return this.queue(t).slice(0,Math.min(t.cursor+1,this.queue(t).length));},
 revealed(student){if(!room?.mysteryEnabled||!MathoPartyRules.compatible(room.pattern||'normal',room.secretPattern))return false;if(room.mysteryRevealed)return true;const turn=room.mysteryRevealTurn||0;if(!turn)return false;if(!this.paced())return room.calls.length>=turn;if(student)return this.calls(student).length>=turn;return !!room.teams?.length&&room.teams.every(t=>Math.min(t.cursor+1,room.teamQueue.length)>=turn);},
 active(student){return MathoPartyRules.active({...room,mysteryRevealed:this.revealed(student)});},
 progress(){return (room.teams||[]).map((t,i)=>({label:'Team '+(i+1),turn:Math.min(t.cursor+1,room.teamQueue?.length||0),finished:!!t.finished}));},
 expose(){if(!this.paced())return;const seen=new Set((room.teams||[]).flatMap(t=>this.queue(t).slice(0,t.cursor+1).map(q=>q.id)));room.calls=(room.teamQueue||[]).filter(q=>seen.has(q.id));},
 advance(team){if(!this.paced())return;const queue=this.queue(team);team.cursor++;team.finished=team.cursor>=queue.length;team.callId=queue[Math.min(team.cursor,queue.length-1)]?.id||null;team.waitDeadline=null;team.ballots={};team.attempt=crypto.randomUUID();team.complete=team.finished;team.status=team.finished?'finished':'ready';this.expose();},
 state(student){
  const team=this.team(student),call=this.calls(student).at(-1);
  const offer=room.winnerChoice?.token===student.token?{id:room.winnerChoice.id,patterns:room.winnerChoice.patterns,selected:room.winnerChoice.selected||null,approved:room.winnerChoice.approved||null}:null;
  const result={patterns:this.active(student),mystery:{enabled:!!room.mysteryEnabled,revealed:this.revealed(student),turn:room.mysteryRevealTurn||0},winnerOffer:offer,team:null};
  if(!room.teamMode)return result;
  if(!team){result.team={enabled:true,waiting:true,message:room.roundComplete?'This round is finished. You will be paired when the next round starts.':'Connecting you to a team…'};return result;}
  const current=team.callId===call?.id,others=this.members(team).filter(s=>s.token!==student.token),connected=this.connected(team).filter(s=>s.token!==student.token);
  const partnersAnswered=current?connected.filter(s=>Object.hasOwn(team.ballots,s.token)).length:0;
  result.team={enabled:true,waiting:false,selfPaced:this.paced(),turn:this.calls(student).length,total:room.teamQueue?.length||0,finished:!!team.finished,resolution:team.resolution||null,joinNotice:student.teamJoinNotice||null,size:team.members.length,partnersConnected:connected.length,partnersOffline:others.length-connected.length,partnersAnswered,waitSeconds:room.teamWaitSeconds||0,waitDeadline:team.waitDeadline||null,recovering:this.eligible(team).length>this.connected(team).length,attempt:team.attempt,callId:call?.id||null,
   choice:current&&Object.hasOwn(team.ballots,student.token)?team.ballots[student.token]:null,
   status:current?team.status:'ready',complete:current&&team.complete,
   partners:room.roundComplete?this.members(team).filter(s=>s.token!==student.token).map(s=>s.name):null};
  return result;
 },
 reset(){
  if(room.nextPattern&&R.PATTERNS[room.nextPattern])room.pattern=room.nextPattern;delete room.nextPattern;room.winnerChoice=null;room.mysteryRevealed=false;
  this.sanitizeMystery();
  for(const student of room.students)delete student.teamJoinNotice;
  const previous=room.teamPairs||[];
  room.teams=[];room.teamQueue=this.paced()?R.shuffled(room.bank.filter(q=>q.enabled)):[];
  if(room.teamMode){
   const groups=MathoPartyRules.group(room.students.map(s=>s.token),previous);room.teamPairs=MathoPartyRules.pairs(groups);
   const orderKeys=new Set();
   for(const members of groups){let order=null;if(room.teamOrderMode==='random'){for(let attempt=0;attempt<100;attempt++){order=R.shuffled(room.teamQueue).map(q=>q.id);if(!orderKeys.has(JSON.stringify(order)))break;}orderKeys.add(JSON.stringify(order));}const present=members.filter(token=>this.connected({members}).some(s=>s.token===token));const first=room.students.find(s=>s.token===members[0]);const team={id:crypto.randomUUID(),members,order,waitDeadline:null,present,connected:present.slice(),agreements:{},ballots:{},attempt:crypto.randomUUID(),callId:this.paced()?(order?room.teamQueue.find(q=>q.id===order[0])?.id:room.teamQueue[0]?.id):null,cursor:0,finished:false,resolution:null,status:'ready',complete:false};
    for(const s of room.students.filter(s=>members.includes(s.token)))s.board=structuredClone(first.board);room.teams.push(team);
   }
  }
  if(this.paced())this.expose();
 },
 beginCall(){if(!room.teamMode||this.paced())return;for(const t of room.teams||[]){t.callId=room.calls.at(-1)?.id||null;t.ballots={};t.attempt=crypto.randomUUID();const agreed=t.agreements&&Object.hasOwn(t.agreements,t.callId);t.complete=!!agreed;t.status=agreed?(t.agreements[t.callId]===-1?'skipped':'matched'):'ready';}},
 undo(call){if(!room.teamMode||!call)return;for(const team of room.teams||[]){if(!team.agreements)continue;delete team.agreements[call.id];const marks=R.cleanMarks(Object.entries(team.agreements).filter(([id])=>room.calls.some(q=>q.id===id)).map(([,square])=>square));for(const student of this.members(team))student.marks=marks.slice();}},
 syncTeam(team){for(const s of this.members(team))sync(s);},
 handle(student,m){
  if(m.type==='pattern-choice'){
   const o=room.winnerChoice;if(o&&room.roundComplete&&o.token===student.token&&o.id===m.offerId&&!o.selected&&!o.approved&&o.patterns.includes(m.choice)&&R.PATTERNS[m.choice]){o.selected=m.choice;persist();sync(student);render();updateTeacherRemotes();}return true;
  }
  if(!room.teamMode)return m.type==='team-vote';
  const team=this.team(student);
  if(['team-vote','marks','claim'].includes(m.type)&&!team){sync(student);return true;}
  if(m.type==='marks'){sync(student,null,true);return true;}
  if(m.type==='claim'){
   if(this.members(team).some(s=>s.claim)||team.members.some(token=>room.students.find(s=>s.token===token)?.failedClaims>=3)){sync(student);return true;}
   if(this.paced()){this.claim(student,m);return true;}
   // In team mode a claim can use only the host's agreed marks.
   m.marks=student.marks.slice();return false;
  }
  if(m.type!=='team-vote')return false;
  this.presenceChanged(student);if(team.waitDeadline&&team.waitDeadline<=Date.now())this.checkTimeouts();
  const call=this.calls(student).at(-1),members=this.members(team);
  if(room.roundComplete||!call||members.some(s=>s.claim||(s.failedClaims||0)>=3))return true;
  if(team.callId!==call.id){sync(student);return true;}
  if(team.complete||m.callId!==call.id||m.attempt!==team.attempt||Object.hasOwn(team.ballots,student.token)){sync(student);return true;}
  if(!Number.isInteger(m.square)||m.square< -1||m.square>24)return true;
  if(m.square!==-1){const cell=student.board[m.square];if(!cell||cell.free||cell.letter!==call.letter)return true;}
  team.ballots[student.token]=m.square;team.status='waiting';if(this.paced()&&room.teamWaitSeconds>0&&!team.waitDeadline)team.waitDeadline=Date.now()+room.teamWaitSeconds*1000;
  const resolved=this.resolve(team);
  persist();this.syncTeam(team);if(resolved&&this.paced())publishClassic();renderRoster();this.render();updateTeacherRemotes();
  return true;
 },
 claim(student,m){
  const team=this.team(student),calls=this.calls(student),patterns=this.active(student);
  if(!Number.isSafeInteger(m.seq)||m.seq<student.seq||!calls.length||room.roundComplete&&(room.review||student.feedback==='valid')){sync(student);return;}
  const marks=R.cleanMarks(student.marks),key=JSON.stringify([room.epoch,patterns,calls.map(c=>c.id),marks]);
  if(student.lastClaimKey===key){sync(student);return;}student.lastClaimKey=key;student.seq=m.seq;
  if(!R.isBingo(student.board,marks,calls,patterns)){
   student.failedClaims=Math.min(3,(student.failedClaims||0)+1);student.feedback='invalid';student.resultId=crypto.randomUUID();student.incorrectCount=room.shareIncorrectCount?R.incorrectMarkCount(student.board,marks,calls):null;this.checked(student,false);
  }else{
   student.claim={marks:marks.slice(),callIds:calls.map(c=>c.id),epoch:room.epoch,pattern:room.pattern||'normal',patterns};student.feedback='';student.resultId=null;student.incorrectCount=null;claimSound.play();
  }
  persist();this.syncTeam(team);render();updateTeacherRemotes();
 },
 checked(student,valid){
  const team=this.team(student);if(!team)return;
  for(const other of this.members(team)){other.claim=null;other.feedback=valid?'valid':'invalid';other.failedClaims=student.failedClaims||0;other.resultId=other.token===student.token?student.resultId:crypto.randomUUID();other.incorrectCount=student.incorrectCount;
   if(valid&&!room.winners.some(w=>w.token===other.token))room.winners.push({id:other.resultId,name:other.name,round:room.round,token:other.token});
  }
  if(valid)room.winner={id:crypto.randomUUID(),name:room.winners.map(w=>w.name).join(' & '),names:room.winners.map(w=>w.name),round:room.round};
 },
 pending(student){const team=this.team(student);return team?this.members(team).some(s=>s.claim):!!student.claim;},
 remove(){if(!room?.teamMode)return;for(const t of room.teams||[]){const before=t.members.length;t.members=t.members.filter(token=>room.students.some(s=>s.token===token));if(t.members.length!==before&&!t.complete){t.ballots={};t.status='ready';t.attempt=crypto.randomUUID();}}room.teams=room.teams.filter(t=>t.members.length);},
 reveal(){if(!room?.mysteryEnabled||room.mysteryRevealed||room.roundComplete)return;room.mysteryRevealed=true;for(const s of room.students)s.lastClaimKey='';persist();publishClassic();broadcast();render();updateTeacherRemotes();},
 render(){
  if(!room)return;
  const modeKey=JSON.stringify([room.epoch,room.teamMode,room.mysteryEnabled,room.secretPattern,room.mysteryRevealTurn,room.teamOrderMode,room.teamWaitSeconds]);if(this.modeKey!==modeKey){this.modeKey=modeKey;$('#partyTeamMode').checked=!!room.teamMode;$('#partyMystery').checked=!!room.mysteryEnabled;$('#partySecret').value=room.secretPattern||'corners';$('#partyAutoReveal').checked=!!room.mysteryRevealTurn;$('#partyRevealTurn').value=room.mysteryRevealTurn||10;$('#partyTeamOrder').value=room.teamOrderMode||'same';$('#partyWaitEnabled').checked=room.teamWaitSeconds!==0;$('#partyWaitSeconds').value=room.teamWaitSeconds||30;}

  this.mysteryOptions();
  const paced=this.paced();$('#teamRaceNotice').hidden=!paced;if(paced)$('#teamRaceNotice').textContent='Self-paced team race · '+(room.teamOrderMode==='random'?'the same questions shuffled separately for each team.':'the same question order for every team.')+' Agreement opens the next question.'+(room.teamWaitSeconds?' Waiting answers are checked after '+room.teamWaitSeconds+' seconds.':'');$('#teacherTimer').hidden=paced;if(paced)for(const id of ['liveNext','liveUndo','liveFilter'])$('#'+id).disabled=true;$('#liveNext').hidden=paced;$('#liveUndo').hidden=paced;$('#liveFilter').hidden=paced;$('#liveFilterLabel').hidden=paced;
  $('#winnerCircleControls').hidden=!room.winners?.length;
  $('#activeModeSummary').hidden=!room.teamMode&&!this.revealed();
  $('#activeMysteryPattern').innerHTML=room.mysteryEnabled&&(this.revealed()||paced)?'<strong>'+(this.revealed()?'Mystery pattern revealed':'Mystery pattern · teacher only')+'</strong>'+R.patternDiagram(room.secretPattern)+'<p>'+esc(R.pattern(room.secretPattern).label)+'</p>':'';
  $('#teacherTeams').hidden=!room.teamMode;
  $('#activeTeamList').innerHTML=room.teamMode?(room.teams||[]).map((t,i)=>{
   const members=this.members(t),total=room.teamQueue?.length||0,done=paced?Math.min(t.cursor||0,total):Object.keys(t.agreements||{}).length,submitted=Object.keys(t.ballots||{}).length;
   const confirmed=members.some(s=>s.feedback==='valid'),pending=members.some(s=>s.claim),locked=members.some(s=>(s.failedClaims||0)>=3);
   const status=confirmed?'MATHO confirmed':pending?'MATHO called':locked?'Locked until next round':t.finished?'All questions completed':['mismatch','timeout-incorrect'].includes(t.status)?'Choosing again':t.complete?'Answer agreed':submitted?submitted+' of '+members.length+' choices submitted':'Choosing answers';
   return '<li class="teacher-team-card"><div class="teacher-team-top"><span class="teacher-team-number">Team '+(i+1)+'</span><span class="teacher-team-status'+(confirmed?' is-confirmed':pending?' is-pending':'')+'">'+esc(status)+'</span></div><div class="teacher-team-names">'+members.map(s=>'<span>'+esc(s.name)+'</span>').join('')+'</div><div class="teacher-team-progress"><strong>'+esc(paced?(t.finished?'All questions completed':'Question '+Math.min((t.cursor||0)+1,total)+' of '+total):done+' answers agreed')+'</strong>'+(paced?'<progress max="'+Math.max(1,total)+'" value="'+done+'" aria-label="Team '+(i+1)+' completed questions">'+done+' of '+total+'</progress>':'')+'</div>'+(members.length>this.connected(t).length?'<p class="teacher-team-presence">'+(members.length-this.connected(t).length)+' offline'+(this.eligible(t).length>this.connected(t).length?' · reconnecting team':this.connected(t).length===1?' · continuing solo':'')+'</p>':'')+'</li>';
  }).join(''):'';
  $('#partyReveal').disabled=!room.mysteryEnabled||this.revealed()||!!room.roundComplete;
  $('#partyStatus').textContent=(paced?'Self-paced secret team race. ':room.teamMode?'Secret teams active. ':'Individual boards. ')+(room.mysteryEnabled?(this.revealed()?'Both patterns can win.':'Hidden pattern: '+R.pattern(room.secretPattern).label+'. '+(room.mysteryRevealTurn?'Reveals at question '+room.mysteryRevealTurn+(paced?' for each team.':'.'):'Reveal manually.')):'');
  const target=$('#winnerChoiceStudent'),value=target.value;target.innerHTML=(room.winners||[]).map(w=>'<option value="'+esc(w.token)+'">'+esc(w.name)+'</option>').join('');if((room.winners||[]).some(w=>w.token===value))target.value=value;
  $('#offerWinnerChoice').disabled=!room.roundComplete||!room.winners?.length;
  const offer=room.winnerChoice;$('#winnerChoiceStatus').textContent=room.nextPattern?'Next round: '+R.pattern(room.nextPattern).label+'.':offer?.selected?'Suggested: '+R.pattern(offer.selected).label+'. Approve it or choose another pattern below.':offer?'Waiting for the winner’s suggestion.':'Invite a confirmed winner to suggest the next pattern.';
  if(offer?.selected&&$('#winnerNextPattern').dataset.offer!==offer.id){$('#winnerNextPattern').value=offer.selected;$('#winnerNextPattern').dataset.offer=offer.id;}
  $('#approveWinnerPattern').disabled=!room.roundComplete;
 },
 init(){
  this.mysteryPrimary=null;
  const options=Object.entries(R.PATTERNS).map(([id,p])=>'<option value="'+id+'">'+esc(p.label)+'</option>').join('');
  for(const id of ['setupPattern','winningPattern','partySecret','winnerNextPattern']){const el=$('#'+id),value=el.value;el.innerHTML=options;el.value=R.PATTERNS[value]?value:(id==='partySecret'?'corners':'normal');}
  $('#winnerAllowedPatterns').innerHTML=Object.entries(R.PATTERNS).map(([id,p])=>'<label><input type="checkbox" data-winner-pattern="'+id+'" checked> '+esc(p.label)+'</label>').join('');
  $('#applyPartyModes').onclick=()=>{
   if(!room)return;const teams=$('#partyTeamMode').checked,mystery=$('#partyMystery').checked,secret=$('#partySecret').value,turn=mystery&&$('#partyAutoReveal').checked?Number($('#partyRevealTurn').value):0,wait=$('#partyWaitEnabled').checked?Number($('#partyWaitSeconds').value):0,order=$('#partyTeamOrder').value==='random'?'random':'same';
   if(teams&&$('#partyWaitEnabled').checked&&(!Number.isInteger(wait)||wait<5||wait>180)){toast('Enter a teammate response limit between 5 and 180 seconds.');return;}
   if(mystery&&$('#partyAutoReveal').checked&&(!Number.isInteger(turn)||turn<1||turn>room.bank.filter(q=>q.enabled).length)){toast('Choose a reveal question between 1 and '+room.bank.filter(q=>q.enabled).length+'.');return;}
   if(teams&&room.students.length<2){toast('At least two students must join before starting secret teams.');return;}
   if(mystery&&!MathoPartyRules.compatible(room.pattern,secret)){toast('Choose a mystery pattern that can win separately from the starting pattern.');return;}
   askAction('Start a new round with these modes?','Calls and marks will clear. Secret partners are hidden until the round ends and reshuffled every round.',()=>{room.teamMode=teams;room.teamSelfPaced=teams;room.teamOrderMode=order;room.teamWaitSeconds=wait;room.mysteryRevealTurn=turn;room.mysteryEnabled=mystery;room.secretPattern=mystery?secret:null;resetRound();updateTeacherRemotes();});
  };
  $('#partyReveal').onclick=()=>this.reveal();
  $('#offerWinnerChoice').onclick=()=>{const token=$('#winnerChoiceStudent').value;if(!room?.roundComplete||!room.winners?.some(w=>w.token===token))return;const patterns=[...document.querySelectorAll('[data-winner-pattern]:checked')].map(n=>n.dataset.winnerPattern).filter(id=>R.PATTERNS[id]);if(!patterns.length){toast('Allow at least one pattern.');return;}room.winnerChoice={id:crypto.randomUUID(),token,patterns,selected:null};persist();broadcast();render();};
  $('#approveWinnerPattern').onclick=()=>{const id=$('#winnerNextPattern').value;if(!room?.roundComplete||!R.PATTERNS[id])return;room.nextPattern=id;if(room.winnerChoice)room.winnerChoice.approved=id;persist();broadcast();render();toast('Next round will use '+R.pattern(id).label+'. You can override it before starting.');};
  if(room){if(this.sanitizeMystery()){persist();publishClassic();broadcast();}this.render();}
 }
};
