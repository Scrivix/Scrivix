const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('matho/public/public.js','utf8');
const bank=JSON.parse(fs.readFileSync('matho/sets/decimal-subtraction-bank.json')),config=JSON.parse(fs.readFileSync('matho/sets/decimal-subtraction.json'));
async function visit(signedIn=true){
 const nodes=new Map(),writes=[],navigations=[],requests=[];let readyCalls=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',disabled:false});return nodes.get(id);};
 const ctx={URLSearchParams,structuredClone,console,document:{getElementById:node},window:{addEventListener(){}},location:{search:'?set=decimal-subtraction',href:'https://scrivix.us/matho/public/?set=decimal-subtraction',assign:u=>navigations.push(u)},fetch:async u=>{requests.push(u);return {ok:true,json:async()=>u.includes('index.json')?[{slug:config.id}]:u.includes('bank.json')?structuredClone(bank):structuredClone(config)};},MathoLibrary:{ready:async()=>readyCalls++,createSet:async(t,b,c)=>{writes.push({title:t,bank:b,config:c});return{id:'custom-copy'};},gameUrl:id=>new URL('https://scrivix.us/matho/game/?set='+id)},MathoTeacherAuth:{enabled:()=>true,account:()=>signedIn?{role:'teacher'}:null,signin:()=>new URL('https://scrivix.us/matho/signin/?next=public')}};
 vm.createContext(ctx);await vm.runInContext(source,ctx);
 assert.equal(writes.length,0,'Browsing must never create a private copy');assert.equal(readyCalls,0,'Public browsing does not require an account');
 assert(!node('copyPublicSet').disabled);assert(node('publicQuestions').innerHTML.includes('7'));assert(!node('publicQuestions').innerHTML.includes('<input'));assert(!node('publicQuestions').innerHTML.includes('data-remove'));
 assert(node('publicQuestions').innerHTML.includes('\\('),'Math delimiters retained');
 await node('copyPublicSet').onclick();
 if(signedIn){assert.equal(writes.length,1);assert.deepEqual(writes[0].bank,bank);writes[0].bank[0].question='private edit';assert.notEqual(bank[0].question,'private edit');assert(String(navigations[0]).includes('custom-copy'));}
 else{assert.equal(writes.length,0);assert(String(navigations[0]).includes('/signin/'));}
}
(async()=>{await visit(true);await visit(false);console.log('PASS anonymous read-only public browsing, no implicit copies, explicit approved-account copy, independent banks, and sign-in before copying.');})().catch(e=>{console.error(e);process.exit(1)});
