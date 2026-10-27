(function(){
 const G=ScrivixGroups,$=id=>document.getElementById(id),KEY='scrivix-groups-class-v1';
 let people=[],groups=null,classes=[],active='';
 const LIBRARY='scrivix-groups-classes-v1';
 const id=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-');
 function mode(){return document.querySelector('input[name="mode"]:checked').value;}
 function snapshot(){return {people:people.map(p=>({...p})),balanced:$('balance').checked,mode:mode(),amount:$('amount').value};}
 function writeClasses(){try{localStorage.setItem(LIBRARY,JSON.stringify({classes,active}));return true;}catch{$('saveStatus').textContent='Could not save in this browser. Keep this page open; these changes may not be available next visit.';return false;}}
 function classPicker(){
  $('classPicker').replaceChildren();
  for(const c of [{id:'',name:'Unsaved class'},...classes]){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;$('classPicker').append(o);}
  $('classPicker').value=active;$('deleteClass').hidden=!active;
 }
 function loadClass(data){
  people=(data.people||[]).map(p=>({id:id(),name:p.name.slice(0,100),grade:['A','B','C','D','F'].includes(p.grade)?p.grade:''}));
  $('balance').checked=!!data.balanced;
  for(const r of document.querySelectorAll('input[name="mode"]'))r.checked=r.value===(data.mode==='size'?'size':'groups');
  $('amount').value=Number.isInteger(Number(data.amount))&&Number(data.amount)>0?data.amount:4;
  $('names').value='';$('formStatus').textContent='';roster();updateMode();clearResults();
 }
 function validClass(c){return c&&Array.isArray(c.people)&&c.people.length<=200&&c.people.every(p=>p&&typeof p.name==='string');}
 function save(){
  $('remember').disabled=!!active;$('draftSave').hidden=!!active;
  if(active){const c=classes.find(c=>c.id===active);Object.assign(c,snapshot());if(writeClasses())$('saveStatus').textContent='Changes to '+c.name+' saved on this device.';return;}
  if(!$('remember').checked){try{localStorage.removeItem(KEY);}catch{}$('saveStatus').textContent='Not saved between visits. Keep this page open to keep your list.';return;}
  try{localStorage.setItem(KEY,JSON.stringify({people,balanced:$('balance').checked,mode:mode(),amount:$('amount').value}));$('saveStatus').textContent='Class list saved on this device.';}catch{$('saveStatus').textContent='This browser could not save the list. Keep this page open.';}
 }
 function clearResults(){groups=null;$('groups').replaceChildren();$('empty').hidden=false;$('resultActions').hidden=true;$('balanceNote').hidden=true;$('resultSummary').textContent='Ready when your class list is.';}
 function updateCount(){const n=people.length;$('studentCount').textContent=n+' '+(n===1?'student':'students');$('rosterWrap').hidden=!n;$('gradeHelp').hidden=!$('balance').checked;document.body.classList.toggle('balanced',$('balance').checked);}
 function roster(){
  $('roster').replaceChildren();
  people.forEach((p,index)=>{
   const row=document.createElement('div');row.className='student-row';row.dataset.id=p.id;
   const name=document.createElement('input');name.className='student-name';name.value=p.name;name.setAttribute('aria-label','Student '+(index+1)+' name');name.autocomplete='off';name.maxLength=100;name.dataset.field='name';
   const grade=document.createElement('select');grade.className='student-grade';grade.dataset.field='grade';grade.setAttribute('aria-label','Math grade for '+p.name);
   for(const [value,label] of [['','Choose'],['A','A'],['B','B'],['C','C'],['D','D'],['F','F']]){const option=document.createElement('option');option.value=value;option.textContent=label;grade.append(option);}grade.value=p.grade;
   const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.dataset.remove=p.id;remove.setAttribute('aria-label','Remove '+p.name);
   row.append(name,grade,remove);$('roster').append(row);
  });updateCount();
 }
 $('namesForm').onsubmit=e=>{
  e.preventDefault();const names=G.parseNames($('names').value);
  if(!names.length){$('formStatus').textContent='Enter at least one name, one student per line.';return;}
  if(names.length+people.length>200){$('formStatus').textContent='Use up to 200 students in one class list.';return;}
  people.push(...names.map(name=>({id:id(),name:name.slice(0,100),grade:''})));$('names').value='';$('formStatus').textContent='';roster();clearResults();save();
 };
 function editStudent(e){const row=e.target.closest('[data-id]');if(!row)return;const p=people.find(p=>p.id===row.dataset.id);if(!p)return;if(e.target.dataset.field==='name')p.name=e.target.value;if(e.target.dataset.field==='grade')p.grade=e.target.value;clearResults();save();}
 $('roster').addEventListener('input',editStudent);$('roster').addEventListener('change',editStudent);

 $('roster').onclick=e=>{const button=e.target.closest('[data-remove]');if(!button)return;people=people.filter(p=>p.id!==button.dataset.remove);roster();clearResults();save();};
 $('balance').onchange=()=>{updateCount();clearResults();save();};
 $('remember').onchange=save;
 $('saveClass').onclick=()=>{
  const name=$('className').value.trim();if(!name){$('saveStatus').textContent='Enter a class name, such as Period 1.';$('className').focus();return;}
  if(classes.some(c=>c.name.toLowerCase()===name.toLowerCase()&&c.id!==active)){$('saveStatus').textContent='That class name is already saved. Choose it above or use a different name.';return;}
  if(!active){active=id();classes.push({id:active,name,...snapshot()});}else classes.find(c=>c.id===active).name=name;
  classPicker();save();
 };
 function leaveDraft(){if(!active&&(people.length||$('names').value.trim()))return confirm('This list has not been saved as a named class. Switch classes and discard this list?');return true;}
 $('classPicker').onchange=()=>{
  const next=$('classPicker').value;if(!leaveDraft()){$('classPicker').value=active;return;}
  active=next;const c=classes.find(c=>c.id===active);loadClass(c||{});$('className').value=c?c.name:'';classPicker();writeClasses();save();
 };
 $('newClass').onclick=()=>{if(!leaveDraft())return;active='';loadClass({});$('className').value='';$('remember').checked=false;classPicker();writeClasses();save();$('className').focus();};
 $('deleteClass').onclick=()=>{const c=classes.find(c=>c.id===active);if(!c||!confirm('Delete saved class “'+c.name+'” from this device?'))return;classes=classes.filter(c=>c.id!==active);active='';$('className').value='';classPicker();$('remember').checked=false;writeClasses();save();};
 $('clearClass').onclick=()=>{if(!confirm('Clear this class list and its groups?'))return;people=[];roster();clearResults();save();$('names').focus();};
 for(const choice of document.querySelectorAll('input[name="mode"]'))choice.onchange=()=>{updateMode();clearResults();save();};
 function updateMode(){const size=mode()==='size';$('amountLabel').textContent=size?'Maximum people in a group?':'How many groups?';$('sizeHint').textContent=size?'Groups stay within this size and differ by no more than one student.':'Group sizes stay as even as possible.';}
 $('amount').oninput=()=>{clearResults();save();};
 function makeGroups(){
  $('formStatus').textContent='';
  try{
   groups=G.generate(people,{mode:mode(),amount:Number($('amount').value),balanced:$('balance').checked});
   $('groups').replaceChildren();
   groups.forEach((group,index)=>{
    const card=document.createElement('article');card.className='group-card';
    const heading=document.createElement('h3');heading.textContent='Group '+(index+1);const count=document.createElement('span');count.textContent=group.length+' '+(group.length===1?'person':'people');heading.append(count);
    const list=document.createElement('ul');group.forEach(p=>{const li=document.createElement('li');li.textContent=p.name;list.append(li);});card.append(heading,list);$('groups').append(card);
   });
   const sizes=groups.map(g=>g.length),low=Math.min(...sizes),high=Math.max(...sizes);
   $('resultSummary').textContent=people.length+' '+(people.length===1?'student':'students')+' · '+groups.length+' '+(groups.length===1?'group':'groups')+' · '+(low===high?low:low+'–'+high)+' per group';
   $('empty').hidden=true;$('resultActions').hidden=false;$('balanceNote').hidden=!$('balance').checked;
   const results=document.querySelector('.results');
   if(results&&typeof results.scrollIntoView==='function')results.scrollIntoView({behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }catch(error){groups=null;$('formStatus').textContent=error.message;$('resultActions').hidden=true;if($('balance').checked){const missing=people.find(p=>!G.values[p.grade]);if(missing)document.querySelector('[data-id="'+missing.id+'"] select')?.focus();}}
 }
 $('generate').onclick=makeGroups;$('shuffleAgain').onclick=makeGroups;
 $('print').onclick=()=>{if(groups)window.print();};
 $('copy').onclick=async()=>{if(!groups)return;const text=G.text(groups);try{await navigator.clipboard.writeText(text);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy',1800);}catch{$('copyText').value=text;$('copyDialog').showModal();$('copyText').select();}};
 $('closeCopy').onclick=()=>$('copyDialog').close();
 $('present').onclick=()=>{if(!groups)return;document.body.classList.add('presenting');$('exitPresent').hidden=false;window.scrollTo({top:0});$('exitPresent').focus();};
 function exit(){document.body.classList.remove('presenting');$('exitPresent').hidden=true;}
 $('exitPresent').onclick=exit;document.addEventListener('keydown',e=>{if(e.key==='Escape')exit();});
 try{
  const saved=JSON.parse(localStorage.getItem(KEY));
  if(saved&&Array.isArray(saved.people)&&saved.people.length<=200&&saved.people.every(p=>p&&typeof p.name==='string')){
   people=saved.people.map(p=>({id:id(),name:p.name.slice(0,100),grade:['A','B','C','D','F'].includes(p.grade)?p.grade:''}));$('remember').checked=true;$('balance').checked=!!saved.balanced;
   if(saved.mode==='size')document.querySelector('input[value="size"]').checked=true;
   if(Number.isInteger(Number(saved.amount))&&Number(saved.amount)>0)$('amount').value=saved.amount;
  }
 }catch{}
 try{const lib=JSON.parse(localStorage.getItem(LIBRARY));if(lib&&Array.isArray(lib.classes)){classes=lib.classes.filter(c=>validClass(c)&&typeof c.id==='string'&&typeof c.name==='string');if(classes.some(c=>c.id===lib.active)){active=lib.active;const c=classes.find(c=>c.id===active);loadClass(c);$('className').value=c.name;}}}catch{}
 classPicker();roster();updateMode();save();
})();
