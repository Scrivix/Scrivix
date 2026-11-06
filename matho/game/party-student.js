/* Students receive their own vote and, only after the round, partner names. */
const MathoPartyStudent={
 lastOffer:null,
 canVote(){return online&&game?.team?.enabled&&!game.team.waiting&&!game.roundComplete&&!game.pending&&!game.claimLocked&&game.calls.length>0&&!game.team.complete&&game.team.choice===null&&this.sending!==game.team.attempt;},
 choose(square){if(!this.canVote())return;const call=game.calls.at(-1);if(square!==-1&&game.board[square]?.letter!==call.letter)return;const attempt=game.team.attempt;this.sending=attempt;send({type:'team-vote',epoch:game.epoch,callId:call.id,attempt,square});this.render();setTimeout(()=>{if(game?.team?.attempt===attempt&&game.team.choice===null&&!game.team.complete){this.sending=null;this.render();}},5000);},
 render(){
  $('#mysteryNotice').hidden=!game?.mystery?.enabled||!!game?.mystery?.revealed;
  const team=game?.team,partnerStatus=$('#partnerStatus');partnerStatus.hidden=!team?.enabled||!!team.waiting||!!team.finished||!!game?.roundComplete;
  if(team?.enabled&&!team.waiting){
   const connected=team.partnersConnected||0,offline=team.partnersOffline||0,answered=team.partnersAnswered||0;
   const text=!online?'Reconnecting…':team.recovering?'Reconnecting partners…':offline&&connected===0?'Partner offline · playing solo':team.size===1?'Playing solo':connected===1?(answered?'Partner answered':'Partner choosing'):answered+' of '+connected+' partners answered';
   partnerStatus.textContent=(offline&&connected>0?offline+' partner offline · ':'')+text;
   partnerStatus.dataset.state=!online?'waiting':offline?'offline':answered?'answered':'waiting';
   if(online&&!team.recovering&&(this.presenceEpoch!==game.epoch||this.offlinePartners!==offline)){
    if(offline>(this.presenceEpoch===game.epoch?this.offlinePartners||0:0))toast(connected===0?'Your partner disconnected. You can keep playing on your own.':'A partner disconnected. Continue with your connected teammate.');
    else if(this.presenceEpoch===game.epoch&&this.offlinePartners>offline)toast('Your partner reconnected. They have rejoined your current question.');
    this.presenceEpoch=game.epoch;this.offlinePartners=offline;
   }
  }
  if(team?.enabled){
   if(this.lastAttempt!==team.attempt){this.sending=null;this.lastAttempt=team.attempt;}
   const resolution=team.resolution;
   if(resolution&&resolution.id!==this.lastResolution){this.lastResolution=resolution.id;toast(resolution.status==='mismatch'?'Your choices did not match. All choices are cleared. Choose again.':resolution.status==='matched'?'Your team agreed! Square marked. Next question.':'Your team agreed: no matching answer. Next question.');}
  }
  if(game?.mystery?.revealed&&!this.lastMystery)toast('Mystery pattern revealed! Check your winning patterns.');this.lastMystery=!!game?.mystery?.revealed;
  const panel=$('#secretTeamPanel');panel.hidden=!team?.enabled;$('#teamSkip').hidden=!team?.enabled;
  if(team?.enabled){
   $('#teamPartners').hidden=!game.roundComplete;
   $('#teamPartners').textContent=game.roundComplete?(team.partners?.length?'Your secret '+(team.partners.length===1?'partner was ':'partners were ')+team.partners.join(' & ')+'.':'No partner remained in this round.') :'';
   $('#teamInstructions').textContent=team.waiting?team.message:team.recovering?'Reconnecting your team. Existing choices are saved.':team.partnersOffline>0&&team.partnersConnected===0?'Your partner is offline. Choose an answer to continue on your own. Your partner will rejoin this shared board and current question when they reconnect.':team.selfPaced?'Question '+team.turn+' of '+team.total+'. Agree on the same answer to advance together. A mismatch clears everyone’s choice so you can retry. A match does not confirm correctness. Use “No matching answer” if the answer is not on your board.':team.size===1?'Your partner left. Continue on your own until the next round.':'Tap an answer in the current column to submit it privately. Your team must agree. A match does not tell you whether the answer is correct. Next question clears unfinished choices. Use “No matching answer” if it is not on your board.';
   $('#teamVoteStatus').textContent=team.waiting?'Waiting for next round.':team.finished?'All questions completed. Call MATHO if your board has the winning pattern, or wait for your teacher.':team.status==='mismatch'?'Your team’s choices didn’t match. Try again.':team.status==='matched'?'Your team matched. The square is marked.':team.status==='skipped'?'Your team agreed there is no matching answer on this board.':this.sending===team.attempt&&team.choice===null?'Sending your choice…':team.choice!==null?'Choice submitted. Waiting for your secret team.':game.calls.length?'Choose your answer privately.':'Waiting for the first question.';
   $('#teamSkip').disabled=!this.canVote();
   document.querySelectorAll('[data-square]').forEach(b=>{const i=Number(b.dataset.square);b.classList.toggle('team-private-choice',team.choice===i);b.disabled=!this.canVote()||b.dataset.free==='true'||game.board[i]?.letter!==game.calls.at(-1)?.letter;});
   $('#clearMarks').disabled=true;
  }
  const offer=game?.winnerOffer;$('#winnerChoiceButton').hidden=!offer||!!offer.selected;
  if(!offer){this.lastOffer=null;if($('#winnerChoiceDialog').open)$('#winnerChoiceDialog').close();return;}
  if(offer.approved){$('#winnerChoiceButton').hidden=true;if($('#winnerChoiceDialog').open)$('#winnerChoiceDialog').close();return;}
  if(offer.id!==this.lastOffer){this.lastOffer=offer.id;$('#winnerPatternChoice').innerHTML=offer.patterns.filter(id=>R.PATTERNS[id]).map(id=>'<option value="'+id+'">'+esc(R.pattern(id).label)+'</option>').join('');if(!offer.selected)$('#winnerChoiceDialog').showModal();}
 },
 init(){
  $('#teamSkip').onclick=()=>this.choose(-1);
  $('#winnerChoiceButton').onclick=()=>$('#winnerChoiceDialog').showModal();$('#winnerChoiceLater').onclick=()=>$('#winnerChoiceDialog').close();
  $('#sendWinnerChoice').onclick=()=>{const o=game?.winnerOffer,id=$('#winnerPatternChoice').value;if(!o||o.selected||!o.patterns.includes(id))return;send({type:'pattern-choice',epoch:game.epoch,offerId:o.id,choice:id});$('#winnerChoiceDialog').close();toast('Suggestion sent. Your teacher will approve or override it.');};
 }
};
