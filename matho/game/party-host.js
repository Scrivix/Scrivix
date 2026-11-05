/* All team membership, secret choices, and unrevealed patterns stay with the host. */
const MathoPartyHost={
 team(student){return room?.teamMode?room.teams?.find(t=>t.members.includes(student.token)):null;},
 members(team){return room.students.filter(s=>team.members.includes(s.token));},
 active(){return MathoPartyRules.active(room);},
 state(student){
  const team=this.team(student),call=room.calls.at(-1);
  const offer=room.winnerChoice?.token===student.token?{id:room.winnerChoice.id,patterns:room.winnerChoice.patterns,selected:room.winnerChoice.selected||null,approved:room.winnerChoice.approved||null}:null;
  const result={patterns:this.active(),mystery:{enabled:!!room.mysteryEnabled,revealed:!!room.mysteryRevealed},winnerOffer:offer,team:null};
  if(!room.teamMode)return result;
  if(!team){result.team={enabled:true,waiting:true,message:'Waiting for the next round to receive a secret team.'};return result;}
  const current=team.callId===call?.id;
  result.team={enabled:true,waiting:false,size:team.members.length,attempt:team.attempt,callId:call?.id||null,
   choice:current&&Object.hasOwn(team.ballots,student.token)?team.ballots[student.token]:null,
   status:current?team.status:'ready',complete:current&&team.complete,
   partners:room.roundComplete?this.members(team).filter(s=>s.token!==student.token).map(s=>s.name):null};
  return result;
 },
 reset(){
  if(room.nextPattern&&R.PATTERNS[room.nextPattern])room.pattern=room.nextPattern;delete room.nextPattern;room.winnerChoice=null;room.mysteryRevealed=false;
  if(room.secretPattern===room.pattern){room.mysteryEnabled=false;room.secretPattern=null;}
  const previous=room.teamPairs||[];
  room.teams=[];
  if(room.teamMode){
   const groups=MathoPartyRules.group(room.students.map(s=>s.token),previous);room.teamPairs=MathoPartyRules.pairs(groups);
   for(const members of groups){const first=room.students.find(s=>s.token===members[0]);const team={id:crypto.randomUUID(),members,agreements:{},ballots:{},attempt:crypto.randomUUID(),callId:null,status:'ready',complete:false};
    for(const s of room.students.filter(s=>members.includes(s.token)))s.board=structuredClone(first.board);room.teams.push(team);
   }
  }
 },
 beginCall(){if(!room.teamMode)return;for(const t of room.teams||[]){t.callId=room.calls.at(-1)?.id||null;t.ballots={};t.attempt=crypto.randomUUID();const agreed=t.agreements&&Object.hasOwn(t.agreements,t.callId);t.complete=!!agreed;t.status=agreed?(t.agreements[t.callId]===-1?'skipped':'matched'):'ready';}},
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
   // In team mode a claim can use only the host's agreed marks.
   m.marks=student.marks.slice();return false;
  }
  if(m.type!=='team-vote')return false;
  const call=room.calls.at(-1),members=this.members(team);
  if(room.roundComplete||!call||members.some(s=>s.claim||(s.failedClaims||0)>=3))return true;
  if(team.callId!==call.id)this.beginCall();
  if(team.complete||m.callId!==call.id||m.attempt!==team.attempt||Object.hasOwn(team.ballots,student.token))return true;
  if(!Number.isInteger(m.square)||m.square< -1||m.square>24)return true;
  if(m.square!==-1){const cell=student.board[m.square];if(!cell||cell.free||cell.letter!==call.letter)return true;}
  team.ballots[student.token]=m.square;team.status='waiting';
  if(members.every(s=>Object.hasOwn(team.ballots,s.token))){
   const choices=members.map(s=>team.ballots[s.token]);
   if(choices.every(i=>i===choices[0])){
    const square=choices[0],next=R.cleanMarks(members[0].marks);
    if(square!==-1&&!next.includes(square)&&next.length<Math.min(24,room.calls.length))next.push(square);
    for(const s of members){s.marks=R.cleanMarks(next);s.feedback='';s.resultId=null;s.claim=null;s.incorrectCount=null;}
    team.agreements=team.agreements||{};team.agreements[call.id]=square;team.complete=true;team.status=square===-1?'skipped':'matched';
   }else{team.ballots={};team.status='mismatch';team.attempt=crypto.randomUUID();}
   persist();this.syncTeam(team);renderRoster();updateTeacherRemotes();
  }else{persist();sync(student);}
  return true;
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
 reveal(){if(!room?.mysteryEnabled||room.mysteryRevealed||room.roundComplete)return;room.mysteryRevealed=true;autoTimer.pause('Mystery pattern revealed · review both patterns, then resume.');clearClaims('Another winning pattern is now available.');for(const s of room.students)s.lastClaimKey='';persist();publishClassic();broadcast();render();updateTeacherRemotes();},
 render(){
  if(!room)return;
  const modeKey=JSON.stringify([room.epoch,room.teamMode,room.mysteryEnabled,room.secretPattern]);if(this.modeKey!==modeKey){this.modeKey=modeKey;$('#partyTeamMode').checked=!!room.teamMode;$('#partyMystery').checked=!!room.mysteryEnabled;$('#partySecret').value=room.secretPattern||'corners';}

  $('#partyReveal').disabled=!room.mysteryEnabled||!!room.mysteryRevealed||!!room.roundComplete;
  $('#partyStatus').textContent=(room.teamMode?'Secret teams active. ':'Individual boards. ')+(room.mysteryEnabled?(room.mysteryRevealed?'Both patterns can win.':'Hidden pattern: '+R.pattern(room.secretPattern).label+'.'):'');
  $('#partyTeamList').textContent=room.teamMode?(room.teams||[]).map(t=>this.members(t).map(s=>s.name).join(' + ')).join(' · '):'';
  const target=$('#winnerChoiceStudent'),value=target.value;target.innerHTML=(room.winners||[]).map(w=>'<option value="'+esc(w.token)+'">'+esc(w.name)+'</option>').join('');if((room.winners||[]).some(w=>w.token===value))target.value=value;
  $('#offerWinnerChoice').disabled=!room.roundComplete||!room.winners?.length;
  const offer=room.winnerChoice;$('#winnerChoiceStatus').textContent=room.nextPattern?'Next round: '+R.pattern(room.nextPattern).label+'.':offer?.selected?'Suggested: '+R.pattern(offer.selected).label+'. Approve it or choose another pattern below.':offer?'Waiting for the winner’s suggestion.':'Invite a confirmed winner to suggest the next pattern.';
  if(offer?.selected&&$('#winnerNextPattern').dataset.offer!==offer.id){$('#winnerNextPattern').value=offer.selected;$('#winnerNextPattern').dataset.offer=offer.id;}
  $('#approveWinnerPattern').disabled=!room.roundComplete;
 },
 init(){
  const options=Object.entries(R.PATTERNS).map(([id,p])=>'<option value="'+id+'">'+esc(p.label)+'</option>').join('');
  for(const id of ['setupPattern','winningPattern','partySecret','winnerNextPattern']){const el=$('#'+id),value=el.value;el.innerHTML=options;el.value=R.PATTERNS[value]?value:(id==='partySecret'?'corners':'normal');}
  $('#winnerAllowedPatterns').innerHTML=Object.entries(R.PATTERNS).map(([id,p])=>'<label><input type="checkbox" data-winner-pattern="'+id+'" checked> '+esc(p.label)+'</label>').join('');
  $('#applyPartyModes').onclick=()=>{
   if(!room)return;const teams=$('#partyTeamMode').checked,mystery=$('#partyMystery').checked,secret=$('#partySecret').value;
   if(teams&&room.students.length<2){toast('At least two students must join before starting secret teams.');return;}
   if(mystery&&secret===room.pattern){toast('Choose a mystery pattern different from the current winning pattern.');return;}
   askAction('Start a new round with these modes?','Calls and marks will clear. Secret partners are hidden until the round ends and reshuffled every round.',()=>{room.teamMode=teams;room.mysteryEnabled=mystery;room.secretPattern=mystery?secret:null;resetRound();updateTeacherRemotes();});
  };
  $('#partyReveal').onclick=()=>this.reveal();
  $('#resetTeamChoices').onclick=()=>{if(!room?.teamMode)return;for(const t of room.teams||[]){if(t.complete)continue;t.ballots={};t.status='ready';t.attempt=crypto.randomUUID();this.syncTeam(t);}persist();toast('Unfinished team choices reset.');};
  $('#offerWinnerChoice').onclick=()=>{const token=$('#winnerChoiceStudent').value;if(!room?.roundComplete||!room.winners?.some(w=>w.token===token))return;const patterns=[...document.querySelectorAll('[data-winner-pattern]:checked')].map(n=>n.dataset.winnerPattern).filter(id=>R.PATTERNS[id]);if(!patterns.length){toast('Allow at least one pattern.');return;}room.winnerChoice={id:crypto.randomUUID(),token,patterns,selected:null};persist();broadcast();render();};
  $('#approveWinnerPattern').onclick=()=>{const id=$('#winnerNextPattern').value;if(!room?.roundComplete||!R.PATTERNS[id])return;room.nextPattern=id;if(room.winnerChoice)room.winnerChoice.approved=id;persist();broadcast();render();toast('Next round will use '+R.pattern(id).label+'. You can override it before starting.');};
  if(room)this.render();
 }
};
