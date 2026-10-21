(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{const destination=api.getDestination(root.location.pathname);if(destination)root.location.replace(destination);}})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const sections=Object.freeze({hero:'top',top:'top',services:'services',automation:'automation',work:'work',process:'process',contact:'contact'});
  function getDestination(pathname){if(typeof pathname!=='string'||!/^\/[a-z-]+\/?$/.test(pathname))return null;const slug=pathname.replace(/^\/|\/$/g,'');return Object.hasOwn(sections,slug)?'/#'+sections[slug]:null;}
  return {getDestination};
});
