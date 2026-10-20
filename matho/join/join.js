(async function(){
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 let sets;
 try{const response=await fetch('../sets/index.json?v=join-1');if(!response.ok)throw Error();sets=await response.json();}
 catch{$('entryError').textContent='Could not load the games. Please refresh and try again.';$('entryButton').disabled=true;return;}
 for(const set of sets){const option=document.createElement('option');option.value=set.slug;option.textContent=set.title;$('edition').append(option);}
 $('code').value=(params.get('room')||'').toUpperCase();$('name').value=params.get('name')||'';
 const specified=sets.find(s=>s.slug===params.get('set'));
 $('entryForm').onsubmit=event=>{
  event.preventDefault();$('entryError').textContent='';
  const code=$('code').value.trim().toUpperCase(),name=$('name').value.trim();
  if(!/^[A-Z2-9]{8}$/.test(code)||!name){$('entryError').textContent='Enter your room code and name.';return;}
  const selected=sets.find(s=>s.slug===$('edition').value);
  const set=specified||selected||sets.find(s=>s.joinPrefix&&code.startsWith(s.joinPrefix));
  if(!set){$('olderRoom').hidden=false;$('edition').required=true;$('edition').focus();return;}
  const url=new URL('../game/join.html',location.href);url.searchParams.set('set',set.slug);url.searchParams.set('room',code);url.searchParams.set('name',name.slice(0,32));location.assign(url.href);
 };
})();
