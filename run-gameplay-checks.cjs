const fs=require('fs'),vm=require('vm');
// Old gameplay harnesses predate the shared current-call formatter.
const original=fs.readFileSync;fs.readFileSync=function(path,...args){const result=original.call(this,path,...args);if(typeof path==='string'&&/matho\/game\/(room|student|app)\.js$/.test(path))return original.call(this,'matho/game/room-set.js','utf8')+'\n'+'globalThis.MathoCurrentCall={content:s=>s};\n'+result;if(typeof path==='string'&&path==='matho/auto-draw.js')return original.call(this,'matho/visible-clock.js',...args)+'\n'+result;return result;};
process.argv[2]='scientific-notation';require('./matho-server/tests/'+process.argv[3]);
