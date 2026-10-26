(function(root){
 const values={A:5,B:4,C:3,D:2,F:1},letters=Object.keys(values);
 function random(){if(root.crypto?.getRandomValues){const a=new Uint32Array(1);root.crypto.getRandomValues(a);return a[0]/4294967296;}return Math.random();}
 function shuffle(items,rng=random){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function parseNames(text){return String(text).split(/\r?\n/).map(n=>n.replace(/^\s*(?:\d+[.)]\s+|[-*•]\s+)/,'').trim()).filter(Boolean);}
 function sizes(n,mode,amount){if(!Number.isInteger(n)||n<1)throw Error('Add at least one student first.');if(!Number.isInteger(amount)||amount<1)throw Error('Enter a whole number of at least 1.');if(!['groups','size'].includes(mode))throw Error('Choose how to split your class.');if(mode==='groups'&&amount>n)throw Error('Choose no more groups than students, so every group has someone.');const count=mode==='groups'?amount:Math.ceil(n/amount);return Array.from({length:count},(_,i)=>Math.floor(n/count)+(i<n%count?1:0));}
 function stats(group){const counts={A:0,B:0,C:0,D:0,F:0};let sum=0;for(const p of group){counts[p.grade]++;sum+=values[p.grade];}return{n:group.length,sum,counts};}
 function penalty(s,mean,proportions){let v=4*(s.sum/s.n-mean)**2;for(const l of letters)v+=(s.counts[l]-proportions[l]*s.n)**2;return v;}
 function generate(people,{mode='groups',amount=4,balanced=false,rng=random}={}){
  if(people.length>200)throw Error('Use up to 200 students in one class list.');
  if(people.some(p=>!String(p.name||'').trim()))throw Error('Give every student a name, or remove their empty row.');
  const capacities=sizes(people.length,mode,amount);
  if(balanced&&people.some(p=>!letters.includes(p.grade)))throw Error('Choose a math grade for every student before balancing.');
  const students=people.map(p=>({...p,name:p.name.trim()}));
  if(!balanced){const order=shuffle(students,rng);return shuffle(capacities,rng).map(n=>order.splice(0,n));}
  const mean=students.reduce((t,p)=>t+values[p.grade],0)/students.length;
  const proportions=Object.fromEntries(letters.map(l=>[l,students.filter(p=>p.grade===l).length/students.length]));
  let best=null,bestScore=Infinity;
  for(let trial=0;trial<5;trial++){
   const caps=shuffle(capacities,rng),groups=caps.map(()=>[]),sums=caps.map(()=>0);
   const sorted=shuffle(students,rng).sort((a,b)=>values[b.grade]-values[a.grade]);
   for(const p of sorted){
    const options=shuffle(groups.map((_,i)=>i).filter(i=>groups[i].length<caps[i]),rng);
    options.sort((a,b)=>groups[a].filter(x=>x.grade===p.grade).length-groups[b].filter(x=>x.grade===p.grade).length||sums[a]/caps[a]-sums[b]/caps[b]);
    const i=options[0];groups[i].push(p);sums[i]+=values[p.grade];
   }
   const ss=groups.map(stats);
   // Improve the mix with swaps that preserve every group's size.
   for(let pass=0;pass<4;pass++){
    let changed=false;
    for(let a=0;a<groups.length;a++)for(let b=a+1;b<groups.length;b++){
     for(let i=0;i<groups[a].length;i++)for(let j=0;j<groups[b].length;j++){
      const x=groups[a][i],y=groups[b][j];if(x.grade===y.grade)continue;
      const before=penalty(ss[a],mean,proportions)+penalty(ss[b],mean,proportions),delta=values[y.grade]-values[x.grade];
      ss[a].sum+=delta;ss[b].sum-=delta;ss[a].counts[x.grade]--;ss[a].counts[y.grade]++;ss[b].counts[y.grade]--;ss[b].counts[x.grade]++;
      const after=penalty(ss[a],mean,proportions)+penalty(ss[b],mean,proportions);
      if(after<before-1e-9){groups[a][i]=y;groups[b][j]=x;changed=true;}
      else{ss[a].sum-=delta;ss[b].sum+=delta;ss[a].counts[x.grade]++;ss[a].counts[y.grade]--;ss[b].counts[y.grade]++;ss[b].counts[x.grade]--;}
     }
    }
    if(!changed)break;
   }
   const score=ss.reduce((t,s)=>t+penalty(s,mean,proportions),0);
   if(score<bestScore-1e-9){bestScore=score;best=groups.map(g=>shuffle(g,rng));}
  }
  return shuffle(best,rng);
 }
 function text(groups){return groups.map((g,i)=>'Group '+(i+1)+'\n'+g.map(p=>p.name).join('\n')).join('\n\n');}
 const api={values,parseNames,sizes,generate,text};root.ScrivixGroups=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
