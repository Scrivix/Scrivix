/* Students receive their own vote and, only after the round, partner names. */
const MathoPartyStudent={
 lastOffer:null,
 canVote(){return online&&game?.team?.enabled&&!game.team.waiting&&!game.roundComplete&&!game.pending&&!game.claimLocked&&game.calls.length>0&&!game.team.complete&&game.team.choice===null&&this.sending!==game.team.attempt;},
 choose(square){if(!this.canVote())return;const call=game.calls.at(-1);if(square!==-1&&game.board[square]?.letter!==call.letter)return;const attempt=game.team.attempt;this.sending=attempt;send({type:'team-vote',epoch:game.epoch,callId:call.id,attempt,square});this.render();setTimeout(()=>{if(game?.team?.attempt===attempt&&game.team.choice===null&&!game.team.complete){this.sending=null;this.render();}},5000);},
 render(){
  $('#mysteryNotice').hidden=!game?.mystery?.enabled||!!game?.mystery?.revealed;
  const team=game?.team;
  if(team?.enabled){const key=JSON.stringify([game.epoch,team.callId,team.attempt,team.status]);if(this.lastTeamKey!==key){if(this.lastCall&&this.lastCall!==team.callId&&!this.lastComplete)toast('Next question: unfinished team choices were cleared.');if(team.status==='mismatch')toast('Your team’s choices did not match. Try again.');if(team.status==='matched')toast('Your team agreed! The square is marked.');if(team.status==='skipped')toast('Your team agreed: no matching answer.');this.lastTeamKey=key;}if(this.lastCall!==team.callId)this.sending=null;this.lastCall=team.callId;this.lastComplete=team.complete;}
  const panel=$('#secretTeamPanel');panel.hidden=!team?.enabled;
  if(team?.enabled){
   $('#teamPartners').hidden=!game.roundComplete;
   $('#teamPartners').textContent=game.roundComplete?(team.partners?.length?'Your secret '+(team.partners.length===1?'partner was ':'partners were ')+team.partners.join(' & ')+'.':'No partner remained in this round.') :'';
   $('#teamInstructions').textContent=team.waiting?team.message:team.size===1?'Your partner left. Continue on your own until the next round.':'Tap an answer in the current column to submit it privately. Your team must agree. A match does not tell you whether the answer is correct. Next question clears unfinished choices. Use “No matching answer” if it is not on your board.';
   $('#teamVoteStatus').textContent=team.waiting?'Waiting for next round.':team.status==='mismatch'?'Your team’s choices didn’t match. Try again.':team.status==='matched'?'Your team matched. The square is marked.':team.status==='skipped'?'Your team agreed there is no matching answer on this board.':this.sending===team.attempt&&team.choice===null?'Sending your choice…':team.choice!==null?'Choice submitted. Waiting for your secret team.':game.calls.length?'Choose your answer privately.':'Waiting for the first question.';
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
