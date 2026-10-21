/* Existing contact payload, explicit pending/error/success states, no client secrets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WebzadContactTools=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const FIELDS=Object.freeze(['name','email','company','service','timeline','goals','website']);
  function mountContactForm({document:doc,fetchFn,apiBase=''}={}){
    if(!doc||typeof fetchFn!=='function')throw new TypeError('Document and fetch function are required');
    const form=doc.getElementById('contactForm'),button=doc.getElementById('submitBtn'),success=doc.getElementById('formSuccess'),error=doc.getElementById('formError');
    if(!form||!button||!success||!error)return {destroy(){}};
    let pending=false,destroyed=false,controller=null;
    const originalLabel=button.innerHTML;
    const onSubmit=async event=>{
      event.preventDefault();
      if(pending||destroyed||form.reportValidity?.()===false)return;
      pending=true;controller=new AbortController();button.disabled=true;button.textContent='Sending your brief…';form.setAttribute('aria-busy','true');error.hidden=true;
      const payload=Object.fromEntries(FIELDS.map(name=>[name,String(form.querySelector(`[name="${name}"]`)?.value||'')]));
      const timer=setTimeout(()=>controller?.abort(),15000);
      try{
        const response=await fetchFn(apiBase+'/api/contact',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||data.success!==true)throw new Error('Brief was not accepted');
        if(!destroyed){form.hidden=true;success.hidden=false;success.setAttribute?.('tabindex','-1');success.focus?.({preventScroll:true});}
      }catch{
        if(!destroyed){error.hidden=false;error.setAttribute?.('tabindex','-1');error.focus?.({preventScroll:true});}
      }finally{
        clearTimeout(timer);pending=false;controller=null;
        if(!destroyed){button.disabled=false;button.innerHTML=originalLabel;form.removeAttribute('aria-busy');}
      }
    };
    form.addEventListener('submit',onSubmit);
    return {destroy(){destroyed=true;controller?.abort();form.removeEventListener('submit',onSubmit);}};
  }
  return {FIELDS,mountContactForm};
});
