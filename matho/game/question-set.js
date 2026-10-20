/* Question-set data and compatibility keys; no game behavior belongs in a set. */
(function(root){
function create(config,href){
 if(!config||!/^[-a-z0-9]+$/.test(config.id))throw Error('This question set is unavailable.');
 const prefix=config.storagePrefix||'matho-'+config.id;
 const keys={classic:prefix+'-game-v1',channel:prefix+'-sync-v1',host:prefix+'-host-v1',student:prefix+'-student',studentResult:prefix+'-student-result',sound:prefix+'-call-sound',peer:prefix+'-v1-',classroom:prefix+'-classroom'};
 return Object.freeze({config,keys,bank:config.bank||[],
  url(page='',params={}){const url=new URL(page||'./',href);url.search='';url.hash='';url.searchParams.set('set',config.id);for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);return url;},
  hint(kind,letter){const hints=config.hints?.[kind]||{};return (hints[letter]||hints.default||'Find your answer in column {letter}.').replace(/\{letter\}/g,letter);}
 });
}
root.MathoQuestionSet={create};if(typeof module!=='undefined')module.exports={create};
})(globalThis);
