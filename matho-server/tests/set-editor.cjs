const fs=require('fs'),vm=require('vm'),assert=require('assert');
const boot=fs.readFileSync('matho/game/boot.js','utf8');
async function route(existing,localBank){
 let target,creates=0;const loading={textContent:''},bank=[{id:'M1',question:'7.45 - 2.38',answer:'5.07'}];
 const c={URL,URLSearchParams,Array,JSON,console,document:{currentScript:{src:'https://scrivix.us/matho/game/boot.js'},querySelector:()=>loading,body:{dataset:{page:'caller'}}},location:{href:'https://scrivix.us/matho/game/?set=decimal-subtraction',search:'?set=decimal-subtraction',hash:'',replace:u=>target=u},localStorage:{getItem:()=>localBank?JSON.stringify({bank:localBank}):null},MathoTeacherAuth:{enabled:()=>true,account:()=>({})},MathoLibrary:{ready:async()=>{},credentials:()=>({}),list:async()=>({sets:existing?[{id:'custom-existing',title:'Subtracting Decimals'}]:[]}),backup(){},createSet:async(title,b)=>{creates++;assert.deepEqual(b,localBank||bank);return {id:'custom-new'};},gameUrl:id=>new URL('https://scrivix.us/matho/game/?set='+id)},fetch:async u=>({ok:true,json:async()=>String(u).includes('bank.json')?bank:{id:'decimal-subtraction',title:'Subtracting Decimals',bankFile:'decimal-subtraction-bank.json'}})};
 vm.createContext(c);await vm.runInContext(boot,c);assert(target.includes('custom-'));assert(!target.includes('/library/'));assert.equal(creates,existing?0:1);
}
(async()=>{
 await route(true);await route(false);await route(false,[{id:'M1',question:'home edit',answer:'1'}]);
 const source=fs.readFileSync('matho/game/app.js','utf8'),a=source.indexOf("// The teacher's set page"),b=source.indexOf('/* Question removals',a),nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{textContent:'',value:'',innerHTML:'',open:false,before(){},append(){}});return nodes.get(s);};
 let hosted,validated=0,toasts=[];const R=require('../../matho/game/live-core.js');
 const c={display:false,$:node,document:{body:{classList:{add(){}}},createElement:()=>({append(){}})},MATHO_SET:{config:{title:'Test'},url:(page,p)=>new URL('https://scrivix.us/matho/game/'+page+'?pattern='+p.pattern)},MathoRules:{...R,validateBank:()=>validated++},esc:s=>s,state:{bank:[],libraryDirty:true},toast:s=>toasts.push(s),location:{assign:u=>hosted=u}};
 vm.createContext(c);vm.runInContext(source.slice(a,b),c);
 assert(node('#bankSection details').open);assert.equal(node('#heading').textContent,'Test');
 node('#hostSetGame').onclick();assert(!hosted);assert(toasts.length);
 c.state.libraryDirty=false;node('#setPattern').value='corners';node('#hostSetGame').onclick();assert(hosted.includes('room.html?pattern=corners'));assert.equal(validated,1);
 console.log('PASS direct set routing, reuse saved copies, preserve local edits, open editor, wait for cloud save, and pass chosen winning pattern to game setup.');
})().catch(e=>{console.error(e);process.exit(1)});
