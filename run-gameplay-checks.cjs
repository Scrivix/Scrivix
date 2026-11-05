const fs=require('fs');
// Load the browser helpers used by current engines into the legacy VM harnesses.
const original=fs.readFileSync;
fs.readFileSync=function(path,...args){
 const result=original.call(this,path,...args);
 if(typeof path==='string'&&/matho\/game\/(room|student|app)\.js$/.test(path)){
  const helper=path.endsWith('room.js')?'party-host.js':path.endsWith('student.js')?'party-student.js':null;
  return original.call(this,'matho/game/room-set.js','utf8')+'\n'+original.call(this,'matho/game/party-core.js','utf8')+'\n'+(helper?original.call(this,'matho/game/'+helper,'utf8'):'')+'\nglobalThis.MathoCurrentCall={content:s=>s};\n'+result;
 }
 if(typeof path==='string'&&path==='matho/auto-draw.js')return original.call(this,'matho/visible-clock.js',...args)+'\n'+result;
 return result;
};
process.argv[2]='scientific-notation';require('./matho-server/tests/'+process.argv[3]);
