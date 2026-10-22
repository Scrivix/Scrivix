const KEY=MATHO_SET.keys.classic,CHANNEL=MATHO_SET.keys.channel,letters=['M','A','T','H','O'];
const display=new URLSearchParams(location.search).get('view')==='display';
document.body.classList.toggle('display',display);
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const math=s=>`<span class="math">\\(${esc(s)}\\)</span>`;
let state;try{state=JSON.parse(localStorage.getItem(KEY));}catch{}if(!state||!Array.isArray(state.bank)||!Array.isArray(state.called))state={bank:structuredClone(DEFAULT_BANK),called:[],revision:0};
const expressionSound=new MathoCallSound(KEY+'-expression-sound');
const classroomResultPanel=new MathoResultPanel('classroomResult');let displayedWinnerId=null;
const celebrationSound=new MathoCallSound(KEY+'-celebration-sound',{tone:'celebrate'});
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel(CHANNEL):null;
let typesetting=Promise.resolve();function typeset(element){typesetting=typesetting.catch(()=>{}).then(async()=>{if(window.MathJax?.typesetPromise){await MathJax.startup.promise;await MathJax.typesetPromise([element]);}});}
function toast(s){$('#message').textContent=s;$('#message').style.display='block';setTimeout(()=>$('#message').style.display='none',4500);}
function save(){state.revision=Date.now();try{localStorage.setItem(KEY,JSON.stringify(state));$('#connection').textContent='● Progress saved in this browser';}catch{toast('Browser storage is unavailable. Keep this window open.');}channel?.postMessage(state);render();window.dispatchEvent(new Event('matho-bank-saved'));}
function receive(s){if(s&&Array.isArray(s.bank)&&Array.isArray(s.called)){state=s;render();}}
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{receive(JSON.parse(e.newValue));}catch{}}});if(channel)channel.onmessage=e=>receive(e.data);
function available(){const filter=$('#filter').value;return state.bank.filter(q=>q.enabled&&!state.called.some(c=>c.id===q.id)&&(filter==='all'||q.letter===filter));}
function render(){renderClassroomWinner();renderClassroomPattern();if(display)MathoVisibleClock.update(state.clock);const calls=state.called,current=calls.at(-1);$('#calledCount').textContent=calls.length;$('#historyCount').textContent=calls.length?`${calls.length} called · grouped by column`:'No calls yet';$('#callNumber').textContent=current?`Call ${calls.length} · ${current.id}`:'Ready when you are';$('#currentMath').innerHTML=current?`<span class="letter-badge" style="--accent:var(--${current.letter})">${current.letter}</span>${math(current.question)}`:'<span class="empty-title">Let’s play MATHO.</span>';$('#currentHint').textContent=current?MATHO_SET.hint('caller',current.letter):(display?'Your teacher will draw the first expression shortly.':'Open the classroom display, then draw your first expression.');$('#answerMath').innerHTML=current?math(current.answer):'—';renderQuestionBoard();$('#remaining').textContent=`${available().length} expressions left in this selection`;$('#next').disabled=!available().length;$('#undo').disabled=!calls.length;$('#bankCount').textContent=`${state.bank.length} expressions`;typeset($('.play-area'));typeset($('#board'));if(!display)renderBank();}
function renderBank(){const warnings=state.bank.filter(q=>q.note);$('#reviewNote').textContent=warnings.map(q=>`${q.id}: ${q.note}`).join(' ');$('#reviewNote').hidden=!warnings.length;$('#bank').innerHTML=state.bank.map(q=>{const locked=!MATHO_SET.config.id.startsWith('custom-')&&state.called.some(c=>c.id===q.id);return `<div class="bank-row" data-id="${esc(q.id)}"><strong>${esc(q.id)}</strong><div><label>Question · LaTeX<input type="text" data-field="question" value="${esc(q.question)}" ${locked?'disabled':''}></label><div class="preview" data-preview="question">${math(q.question)}</div></div><div><label>Answer · LaTeX<input type="text" data-field="answer" value="${esc(q.answer)}" ${locked?'disabled':''}></label><div class="preview" data-preview="answer">${math(q.answer)}</div></div><div class="question-actions"><label><input type="checkbox" data-field="enabled" ${q.enabled?'checked':''} ${locked?'disabled':''}> Include</label><button type="button" data-remove="${esc(q.id)}" ${locked?'disabled title="Start a new game before removing a called question"':''}>Remove</button></div>${q.note?`<div class="bank-note">${esc(q.note)}</div>`:''}</div>`;}).join('');if($('details').open)typeset($('#bank'));}
$('#bank').addEventListener('change',e=>{const row=e.target.closest('[data-id]'),field=e.target.dataset.field;if(!row||!field)return;const q=state.bank.find(q=>q.id===row.dataset.id);q[field]=field==='enabled'?e.target.checked:e.target.value.trim();save();});$('details').addEventListener('toggle',()=>{if($('details').open)typeset($('#bank'));});
function drawExpression(){const choices=available();if(!choices.length)return;const n=new Uint32Array(1);crypto.getRandomValues(n);state.winner=null;state.called.push(structuredClone(choices[Math.floor(n[0]/4294967296*choices.length)]));if(!display)expressionSound.play();save();if(autoTimer.running){if(available().length)autoTimer.restart();else autoTimer.stop('No expressions left in this selection.');}}$('#next').onclick=drawExpression;
$('#filter').onchange=()=>{if(autoTimer.running){if(available().length)autoTimer.restart();else autoTimer.stop('No expressions left in this selection.');}render();};$('#undo').onclick=()=>{autoTimer.pause('Paused after undo.');state.called.pop();save();};$('#reset').onclick=()=>{if(autoTimer.running)autoTimer.pause('Paused while starting a new game.');if(confirm('Start a new game? This clears the call board on both screens. Your question bank stays saved.')){autoTimer.stop('New game · start the timer when ready.');state.winner=null;state.called=[];save();}};
$('#openDisplay').onclick=()=>{const url=MATHO_SET.url('',{view:'display'});const w=window.open(url,MATHO_SET.keys.classroom,'popup,width=1400,height=900');if(!w)toast('Allow pop-ups to open the classroom display.');};$('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>toast('Use your browser’s full-screen command.'));};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(state.bank,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=MATHO_SET.config.exportFilename||('matho-'+MATHO_SET.config.id+'-question-bank.json');a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};$('#import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const bank=JSON.parse(await f.text());if(!Array.isArray(bank)||!bank.length||bank.some(q=>!letters.includes(q.letter)||typeof q.question!=='string'||!q.question.trim()||typeof q.answer!=='string'||!q.answer.trim()))throw Error('Use a question bank exported by this app, with M, A, T, H, or O for every entry.');if(!confirm('Replace the question bank and clear the current game?'))return;MathoLibrary.backup(KEY,state.bank,'Before importing a question bank');autoTimer.stop('Question bank changed.');state.bank=bank.map((q,i)=>({...q,id:q.letter+(i+1),enabled:q.enabled!==false}));state.called=[];save();toast('Question bank imported.');}catch(err){toast('Could not import: '+err.message);}e.target.value='';};
if(display){$('#viewLabel').textContent='CLASSROOM LIVE';$('#heading').textContent='Find your square.';$('#subtitle').textContent=MATHO_SET.config.presentationSubtitle;document.title='MATHO · '+MATHO_SET.config.title+' classroom';}

function renderAutoTimer(){if(typeof autoTimer==='undefined')return;const seconds=autoTimer.secondsLeft;$('#autoCountdown').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$('#autoToggle').textContent=autoTimer.running?'Pause auto draw':autoTimer.hasStarted?'Resume auto draw':'Start auto draw';$('#autoToggle').setAttribute('aria-pressed',String(autoTimer.running));$('#autoStatus').textContent=autoTimer.running?'Running · next expression when the countdown ends.':autoTimer.reason;}
const autoTimer=new MathoAutoDraw({fire:()=>{if(!available().length)return false;drawExpression();return available().length>0;},onUpdate:()=>renderAutoTimer()});
try{const saved=Number(localStorage.getItem(KEY+'-auto-seconds'));if(MathoAutoDraw.valid(saved)){autoTimer.setSeconds(saved);$('#autoSeconds').value=String(saved);}}catch{}
$('#autoToggle').onclick=()=>{if(autoTimer.running){autoTimer.pause();return;}if(!available().length){autoTimer.stop('No expressions left in this selection.');return;}try{autoTimer.start(Number($('#autoSeconds').value));localStorage.setItem(KEY+'-auto-seconds',String(autoTimer.seconds));}catch(e){autoTimer.pause(e.message);toast(e.message);}};
$('#autoSeconds').onchange=()=>{try{autoTimer.setSeconds(Number($('#autoSeconds').value));localStorage.setItem(KEY+'-auto-seconds',String(autoTimer.seconds));}catch(e){autoTimer.pause(e.message);toast(e.message);}};renderAutoTimer();

window.addEventListener('load',()=>{typeset($('.play-area'));typeset($('#board'));});render();

function renderClassroomWinner(){if(!display)return;if(!state.winner){classroomResultPanel.hide();return;}if(displayedWinnerId===state.winner.id)return;displayedWinnerId=state.winner.id;celebrationSound.play();classroomResultPanel.show(state.winner.name+(state.winner.names?.length>1?' got MATHO!':' got a MATHO!'),'A confirmed win! Let’s celebrate some great thinking.',true);}

function renderClassroomPattern(){
 const panel=$('#classroomPattern');panel.hidden=!display;if(!display)return;
 const goal=MathoRules.pattern(state.pattern||'normal');
 $('#classroomPatternDiagram').innerHTML=MathoRules.patternDiagram(state.pattern||'normal');
 $('#classroomPatternName').textContent=goal.label;
 $('#classroomPatternDescription').textContent=goal.description;
 const code=typeof state.roomCode==='string'&&/^[A-Z2-9]{8}$/.test(state.roomCode)?state.roomCode:'';
 $('#classroomRoom').hidden=!code;$('#classroomRoomCode').textContent=code;
}

if(!display){

 expressionSound.bindToggle($('#expressionSoundToggle'),'New expression sound',toast);
 window.addEventListener('click',event=>{if(!event.target?.closest?.('#expressionSoundToggle'))expressionSound.unlock();});
}

function previewNewQuestion(){
 const question=$('#newQuestionText').value.trim(),answer=$('#newAnswerText').value.trim();
 $('#newQuestionPreview').innerHTML=question?math(question):'Question preview';
 $('#newAnswerPreview').innerHTML=answer?math(answer):'Answer preview';
 typeset($('#addQuestionForm'));
}
$('#newQuestionText').addEventListener('input',previewNewQuestion);
$('#newAnswerText').addEventListener('input',previewNewQuestion);
$('#addQuestionForm').onsubmit=event=>{
 event.preventDefault();
 const letter=$('#newQuestionColumn').value,question=$('#newQuestionText').value.trim(),answer=$('#newAnswerText').value.trim(),status=$('#addQuestionStatus');
 if(!letters.includes(letter)||!question||!answer){status.textContent='Choose a column and enter both a question and its answer.';return;}
 if(question.length>500||answer.length>200){status.textContent='Keep the question under 500 characters and the answer under 200.';return;}
 if(state.bank.some(q=>q.letter===letter&&MathoRules.canonical(q.question)===MathoRules.canonical(question))){status.textContent='That question is already in column '+letter+'. Edit its existing entry instead.';return;}
 const used=new Set([...state.bank,...state.called].map(q=>String(q.id)));let number=1;
 for(const id of used){const match=id.match(new RegExp('^'+letter+'(\\d+)$'));if(match)number=Math.max(number,Number(match[1])+1);}
 while(used.has(letter+number))number++;
 const entry={id:letter+number,letter,question,answer,enabled:true,note:''};
 let insertion=-1;state.bank.forEach((q,i)=>{if(q.letter===letter)insertion=i+1;});
 if(insertion<0){insertion=state.bank.findIndex(q=>letters.indexOf(q.letter)>letters.indexOf(letter));if(insertion<0)insertion=state.bank.length;}
 state.bank.splice(insertion,0,entry);save();
 $('#newQuestionText').value='';$('#newAnswerText').value='';previewNewQuestion();
 status.textContent='Added '+entry.id+' to column '+letter+'. It is saved with this question bank. Create a new student room to use it on student boards.';
 $('#newQuestionText').focus();
};

if(location.hash==='#bankSection')$('details').open=true;

function renderQuestionBoard(){
 const current=state.called.at(-1);
 if(!display){
  $('.history-section .eyebrow').textContent='THE QUESTION SET';
  $('.history-section h2').textContent='Questions in play';
  $('#historyCount').textContent=state.bank.filter(q=>q.enabled).length+' enabled questions · grouped by column';
 }
 $('#board').innerHTML=letters.map(letter=>{
  const rows=display?state.called.map((q,i)=>({...q,index:i+1})).filter(q=>q.letter===letter).reverse():state.bank.filter(q=>q.enabled&&q.letter===letter);
  return `<div class="column" style="--accent:var(--${letter})"><div class="column-head"><strong>${letter}</strong><span>${rows.length} ${display?'CALLED':'QUESTIONS'}</span></div><div class="column-calls">${rows.length?rows.map(q=>{
   const index=display?q.index:state.called.findIndex(c=>c.id===q.id)+1;
   return `<div class="history-item ${q.id===current?.id?'newest':''}"><div class="call-index">${display?'CALL '+index:esc(q.id)+(index?' · CALLED':' · AVAILABLE')}</div><div class="history-question">${math(q.question)}</div>${display?'':`<div class="history-answer">${math(q.answer)}</div>`}</div>`;
  }).join(''):`<p class="no-calls">${display?'Waiting for a call':'No enabled questions'}</p>`}</div></div>`;
 }).join('');
}

/* Question removals can be undone and saved library versions remain recoverable. */
const removedQuestions=[];
const undoRemoval=document.createElement('button');undoRemoval.type='button';undoRemoval.id='undoQuestionRemoval';undoRemoval.textContent='Undo question removal';undoRemoval.hidden=true;
$('#bankSection .bank-actions').prepend(undoRemoval);
$('#bank').addEventListener('click',event=>{
 const button=event.target.closest('[data-remove]');if(!button||display)return;
 const index=state.bank.findIndex(q=>q.id===button.dataset.remove);if(index<0)return;
 const question=state.bank[index];if(!MATHO_SET.config.id.startsWith('custom-')&&state.called.some(q=>q.id===question.id))return;
 try{MathoLibrary.backup(KEY,state.bank,'Before removing '+question.id);}catch{toast('Could not save a backup. Download your bank before removing a question.');return;}
 removedQuestions.push({question:structuredClone(question),index});state.bank.splice(index,1);save();undoRemoval.hidden=false;
 toast('Question removed. Use Undo question removal to bring it back.');
});
undoRemoval.onclick=()=>{
 const removed=removedQuestions.pop();if(!removed)return;
 const question=removed.question;
 if(state.bank.some(q=>q.id===question.id)){
  let number=1;const used=new Set([...state.bank,...state.called].map(q=>q.id));while(used.has(question.letter+number))number++;question.id=question.letter+number;
 }
 state.bank.splice(Math.min(removed.index,state.bank.length),0,question);save();undoRemoval.hidden=!removedQuestions.length;toast('Question restored.');
};

if(display){
 $('#celebrationControls').hidden=false;
 celebrationSound.attachPlayer($('#celebrationPlayer'));
 celebrationSound.bindToggle($('#celebrationToggle'),'Celebration sound',toast);
 $('#testCelebration').onclick=async()=>{if(!await celebrationSound.test())toast('Press play on the celebration audio player to enable sound on this screen.');};
}
