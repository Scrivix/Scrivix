const fs=require('fs'),vm=require('vm'),assert=require('assert');
const codeSource=fs.readFileSync('matho/game/room.js','utf8').split('\n').find(l=>l.startsWith('function createCode()'));
const c={Uint8Array,crypto:require('crypto').webcrypto};vm.createContext(c);vm.runInContext(codeSource,c);
for(let i=0;i<100;i++){const code=c.createCode();assert.equal(code.length,5);assert(/^[A-HJ-NP-Z2-9]{5}$/.test(code));}
for(const path of ['matho/game/join.html','matho/join/index.html']){
 const html=fs.readFileSync(path,'utf8'),pattern=html.match(/pattern="([^"]+)"/)[1],valid=new RegExp('^(?:'+pattern+')$');
 for(const code of ['CS234','EXABC','CSAB2345'])assert(valid.test(code),path+code);
 for(const code of ['CS23','CS2345','CS23456','CS23!'])assert(!valid.test(code),path+code);
}
async function join(code){
 const nodes={},node=id=>nodes[id]||(nodes[id]={value:'',textContent:'',append(){}}),destinations=[],lookups=[];
 const ctx={URL,URLSearchParams,document:{getElementById:node,createElement:()=>({})},location:{href:'https://scrivix.us/matho/join/',search:'',assign:u=>destinations.push(u)},MathoLibrary:{lookupRoom:async c=>{lookups.push(c);return{setId:'custom-test'};}},fetch:async()=>({ok:true,json:async()=>[{slug:'exponents',joinPrefix:'EX',title:'Exponents'}]})};
 vm.createContext(ctx);await vm.runInContext(fs.readFileSync('matho/join/join.js','utf8'),ctx);node('code').value=code;node('name').value='Student';await node('entryForm').onsubmit({preventDefault(){}});
 assert.equal(destinations.length,1);assert(new URL(destinations[0]).searchParams.get('room')===code);assert.equal(lookups.length,code.startsWith('CS')?1:0);
}
(async()=>{for(const code of ['CS234','CSAB2345','EXABC','EXAB2345'])await join(code);console.log('PASS five-character generation, ambiguous-character avoidance, five/eight-character forms, public prefix routing, and private-code lookup.');})().catch(e=>{console.error(e);process.exit(1)});
