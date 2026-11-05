/* Public directions for the active round; never contains the private answer bank. */
(function(root){
 let previous='',previousDisplay='',signature='';
 function metadata(config){if(!config)return null;return {id:config.id,title:config.title,copy:config.copy||{},hints:config.hints||{},presentationSubtitle:config.presentationSubtitle||'',displaySet:config.displaySet||''};}
 function apply(config,role){if(!config)return;const key=JSON.stringify(config);if(key===signature)return;signature=key;
  for(const node of document.querySelectorAll('[data-copy]')){const text=config.copy?.[node.dataset.copy];if(typeof text==='string')node.textContent=text;}
  const classes=document.body.classList;for(const name of [previous,previousDisplay,root.MATHO_SET?.config.id,root.MATHO_SET?.config.displaySet])if(name)classes.toggle('set-'+name,false);
  previous=config.id;previousDisplay=config.displaySet;classes.toggle('set-'+config.id,true);if(config.displaySet)classes.toggle('set-'+config.displaySet,true);
  document.title='MATHO · '+config.title+' · '+role;
  if(role==='Classroom'){const subtitle=document.querySelector('#subtitle');if(subtitle)subtitle.textContent=config.presentationSubtitle||'';}
 }
 function hint(config,kind,letter){const hints=config?.hints?.[kind]||{};return(hints[letter]||hints.default||'Find your answer in column {letter}.').replace(/\{letter\}/g,letter);}
 root.MathoRoomSet={metadata,apply,hint};
})(globalThis);
