/* Changing banks leaves the original transport identity and room code in place. */
let changeSetOptions=[];
async function chooseRoomSet(){
 if(!room)return;autoTimer.pause('Paused while choosing a question set.');
 $('#changeSetStatus').textContent='Loading your question sets…';$('#loadRoomSet').disabled=true;$('#roomSetChoice').replaceChildren();$('#changeSetDialog').showModal();
 const results=await Promise.allSettled([fetch('../sets/index.json?v=room-switch-1',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Shared sets could not load.');return r.json();}),MathoLibrary.list()]);
 changeSetOptions=[];
 for(let i=0;i<results.length;i++){
  if(results[i].status!=='fulfilled')continue;const sets=i===0?results[i].value:(results[i].value.sets||[]),group=document.createElement('optgroup');group.label=i===0?'Shared teacher sets':'My private library';
  for(const set of sets.slice().sort((a,b)=>a.title.localeCompare(b.title))){const entry={id:i===0?set.slug:set.id,title:set.title,private:i===1},option=document.createElement('option');option.value=String(changeSetOptions.length);option.textContent=entry.title;changeSetOptions.push(entry);group.append(option);}$('#roomSetChoice').append(group);
 }
 $('#loadRoomSet').disabled=!changeSetOptions.length;$('#changeSetStatus').textContent=results.some(r=>r.status==='rejected')?'Some sets could not load. You can choose from those shown, or close and try again.':'Students stay in this room. Switching starts a new round with fresh boards and clears calls and marks.';
}
async function loadRoomSet(){
 const choice=changeSetOptions[Number($('#roomSetChoice').value)],currentRoom=room,epoch=room?.epoch;if(!choice||!currentRoom)return;
 if(!confirm('Load “'+choice.title+'” and start a fresh round? Calls, marks, and pending claims will clear. Students and the room code stay the same.'))return;
 $('#loadRoomSet').disabled=true;$('#changeSetStatus').textContent='Loading '+choice.title+'…';
 try{
  const data=choice.private?await MathoLibrary.read(choice.id):await MathoLibrary.builtInSet(choice.id);R.validateBank(data.bank);
  if(room!==currentRoom||room.epoch!==epoch)throw Error('The round changed while loading. Close this window and choose the set again.');
  // Prepare all replacement boards before touching the running room.
  const boards=[];for(const s of room.students)boards.push(R.makeBoard(data.bank,boards));
  room.bank=structuredClone(data.bank);room.activeConfig=MathoRoomSet.metadata(data.config);$('#liveFilter').value='all';
  resetRound(boards);$('#changeSetDialog').close();updateTeacherRemotes();toast('Loaded '+choice.title+'. Students have fresh boards; the room code is unchanged.');
 }catch(error){$('#changeSetStatus').textContent=error.message;$('#loadRoomSet').disabled=false;}
}
$('#changeRoomSet').onclick=chooseRoomSet;$('#loadRoomSet').onclick=loadRoomSet;$('#cancelChangeSet').onclick=()=>$('#changeSetDialog').close();
