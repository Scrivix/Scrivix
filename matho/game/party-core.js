/* Pure rules for anonymous teams. No accounts, network calls, or timers. */
(function(root){
 function pairs(teams){return teams.flatMap(team=>team.flatMap((a,i)=>team.slice(i+1).map(b=>[a,b].sort().join(':'))));}
 function group(tokens,previous=[]){
  const avoid=new Set(previous);let best=null,score=Infinity;
  for(let attempt=0;attempt<120;attempt++){
   const shuffled=root.MathoRules.shuffled(tokens),groups=[];
   while(shuffled.length){const count=shuffled.length===3?3:Math.min(2,shuffled.length);groups.push(shuffled.splice(0,count));}
   const cost=pairs(groups).filter(p=>avoid.has(p)).length;if(cost<score){score=cost;best=groups;}if(!score)break;
  }return best||[];
 }
 function nameKey(name){return String(name).normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();}
 function compatible(primary,candidate){
  const patterns=root.MathoRules.PATTERNS,a=patterns[primary],b=patterns[candidate];if(!a||!b||primary===candidate)return false;
  return b.sets.some(target=>!a.sets.some(line=>line.filter(i=>i!==12).every(i=>target.includes(i))));
 }
 function active(room){return [...new Set([room.pattern||'normal',...(room.mysteryEnabled&&room.mysteryRevealed&&compatible(room.pattern||'normal',room.secretPattern)?[room.secretPattern]:[])])].filter(id=>root.MathoRules.PATTERNS[id]);}
 const api={pairs,group,nameKey,compatible,active};root.MathoPartyRules=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
