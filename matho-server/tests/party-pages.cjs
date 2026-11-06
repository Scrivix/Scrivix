const fs=require('fs'),assert=require('assert');
for(const [script,page] of [['party-host.js','room.html'],['party-student.js','join.html']]){
 const source=fs.readFileSync('matho/game/'+script,'utf8'),html=fs.readFileSync('matho/game/'+page,'utf8'),ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 for(const match of source.matchAll(/\$\('#([A-Za-z][A-Za-z0-9]*)'\)/g))assert(ids.has(match[1]),script+' missing HTML #'+match[1]);
 const version=script==='party-student.js'?'8':'7',bootVersion='party-7';assert(html.includes(script+'?v='+version));assert(html.indexOf(script+'?v='+version)<html.indexOf('boot.js?v='+bootVersion));assert(!html.includes('resetTeamChoices'));
}
const display=fs.readFileSync('matho/game/index.html','utf8');assert(display.includes('id="classroomMystery"'));assert(display.includes('party.css?v=1'));
const remote=fs.readFileSync('matho/game/remote.html','utf8');assert(remote.includes('id="remoteMystery"'));assert(remote.includes('live-core.js?v=party-1'));
const boot=fs.readFileSync('matho/game/boot.js','utf8');assert(boot.includes('MathoPartyHost.init()'));assert(boot.includes('MathoPartyStudent.init()'));
console.log('PASS party controls have matching page elements, helpers load before engines, classroom/remote reveal controls, and cache versions.');
