/* One shared, preference-aware motion policy. No external runtime dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WebzadMotionTools=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function createMotionPolicy({mediaQuery,storage,document,connection}={}){
    const listeners=new Set(),removers=[];let userPaused=false,active=true;
    try{userPaused=storage?.getItem('webzad-motion-paused')==='1';}catch{}
    const compute=()=>!userPaused&&!mediaQuery?.matches&&!document?.hidden&&!connection?.saveData;
    let enabled=compute();
    const refresh=()=>{if(!active)return;const next=compute();if(next!==enabled){enabled=next;listeners.forEach(fn=>fn(enabled));}};
    const listen=(source,event)=>{if(source?.addEventListener){source.addEventListener(event,refresh);removers.push(()=>source.removeEventListener(event,refresh));}else if(event==='change'&&source?.addListener){source.addListener(refresh);removers.push(()=>source.removeListener(refresh));}};
    listen(mediaQuery,'change');listen(document,'visibilitychange');listen(connection,'change');
    return {
      get enabled(){return enabled;},get userPaused(){return userPaused;},get reduced(){return !!mediaQuery?.matches;},get saveData(){return !!connection?.saveData;},
      setUserPaused(paused){if(!active)return;userPaused=!!paused;try{storage?.setItem('webzad-motion-paused',userPaused?'1':'0');}catch{}refresh();},
      subscribe(listener){if(typeof listener!=='function'||!active)return ()=>{};listeners.add(listener);listener(enabled);return ()=>listeners.delete(listener);},
      destroy(){active=false;removers.forEach(fn=>fn());listeners.clear();}
    };
  }
  function bindMotionVideo(video,policy,{IntersectionObserver:Observer,mobile=false}={}){
    let visible=!Observer,loaded=false,destroyed=false;
    const update=()=>{
      if(destroyed)return;
      if(!policy.enabled||!visible){video.pause();return;}
      if(!loaded){const src=mobile?video.dataset.srcMobile||video.dataset.src:video.dataset.src;if(!src)return;video.src=src;video.load();loaded=true;}
      try{const play=video.play();if(play&&typeof play.catch==='function')play.catch(()=>{});}catch{}
    };
    const loadedFrame=()=>{video.dataset.ready='true';};video.addEventListener('loadeddata',loadedFrame);
    const unsubscribe=policy.subscribe(update);
    const observer=Observer?new Observer(entries=>{visible=entries.some(e=>e.isIntersecting);update();},{threshold:0.03}):null;
    observer?.observe(video);
    return {destroy(){destroyed=true;unsubscribe();observer?.disconnect();video.pause();video.removeEventListener('loadeddata',loadedFrame);}};
  }
  return {createMotionPolicy,bindMotionVideo};
});
