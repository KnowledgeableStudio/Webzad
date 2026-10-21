/* Real launched projects and separately labeled original design studies.
 * Captures are populated only by the read-only capture tool. No stock fallback. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebzadPortfolioTools = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const PROJECTS = Object.freeze([
    {id:'zaddy', name:'ZADDY.ART', url:'https://zaddy.art/', category:'Artist · Music · Merchandise', description:'An immersive home for iZad Casanova’s music, story, and Zaddy Collection. The experience brings artist identity, release discovery, and merchandise together.', highlights:['Artist identity and story','Music releases and listening destinations','Zaddy Collection merchandise']},
    {id:'la-socieda', name:'LA SOCIEDA RECORD', url:'https://www.lasociedarecord.com/', category:'Record label · Entertainment', description:'A digital stage for an independent record label. Discover artists, explore its music catalog, and experience videos and the label’s visual identity.', highlights:['Artist roster and discovery','Music catalog and videos','Record-label storytelling']},
    {id:'one-of-six', name:'1 OF 6 PRODUCTIONS', url:'https://1of6.productions/', category:'Video production · Live events', description:'A production-company presence centered on concerts, live events, and the work behind the scenes. A focused introduction to the studio, its capabilities, and its visual work.', highlights:['Concert and event presentation','Video-production identity','Studio and portfolio experience']},
    {id:'brg', name:'BRG OFFICIAL', url:'https://www.brgofficial.com/', category:'E-commerce · Collectibles', description:'A product-led digital experience for the BRG plush collection. Collection storytelling, lifestyle imagery, and detailed product presentation lead into the shopping interface.', highlights:['Collectible product presentation','Collection and lifestyle imagery','Shopping interface; payment processing not independently verified']}
  ].map(project => Object.freeze({...project, highlights:Object.freeze(project.highlights), captures:Object.freeze([])})));
  const STUDIES = Object.freeze({
    services:Object.freeze({name:'Authority-Driven Websites',path:'assets/work-professional-services-B68gLSwb.png'}),
    hospitality:Object.freeze({name:'Brand-Rich Experiences',path:'assets/work-hospitality-lifestyle-BOhuuqm2.png'}),
    growth:Object.freeze({name:'Conversion-Focused Pages',path:'assets/work-growth-campaigns-CwnhtZED.png'})
  });
  const allowedViews = new Set(['desktop','secondary','mobile']);
  function validPath(path, id) {
    return typeof path === 'string' && path.startsWith(`assets/portfolio/${id}/`) && !path.includes('..') && /^[-a-zA-Z0-9_/]+\.(png|webp|avif)$/.test(path);
  }
  function getApprovedCaptures(entry, project) {
    if (!entry || entry.status !== 'captured' || !Array.isArray(entry.captures)) return [];
    return entry.captures.filter(c => {
      try {
        return c.status === 'captured' && c.sourceUrl === project.url && new URL(c.finalUrl).hostname.replace(/^www\./,'') === new URL(project.url).hostname.replace(/^www\./,'') && new URL(c.finalUrl).protocol === 'https:' &&
          allowedViews.has(c.view) && c.httpStatus === 200 && c.contentVerified === true && validPath(c.path,project.id) && /^[a-f0-9]{64}$/.test(c.sha256) &&
          typeof c.alt === 'string' && c.alt.trim().length > 0 && Number.isFinite(Date.parse(c.capturedAt)) && c.viewport?.width > 0 && c.viewport?.height > 0;
      } catch { return false; }
    });
  }
  function createPortfolio({document:doc, projects=PROJECTS, motionPolicy, fetchFn}={}) {
    if (!doc) throw new TypeError('A document is required');
    let disposed=false, active=null, restoreTarget=null, currentProject=null;
    const captures=new Map(), listeners=[], win=doc.defaultView;
    const request=fetchFn === undefined ? win?.fetch?.bind(win) : fetchFn;
    const el=(tag, className, text)=>{const e=doc.createElement(tag); if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
    const listen=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
    function liveLink(project) {const a=el('a','btn btn-outline','Visit Live Website ↗');a.href=project.url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`Visit ${project.name}; opens in a new tab`);return a;}
    function makeImage(capture,project) {
      const img=el('img');img.src=capture.path+'?v='+capture.sha256.slice(0,12);img.alt=capture.alt;img.width=capture.viewport.width;img.height=capture.viewport.height;img.loading='lazy';img.decoding='async';
      const variants=(capture.variants||[]).filter(v=>validPath(v.path,project.id)&&v.width>0);
      if(variants.length){img.srcset=variants.map(v=>`${v.path}?v=${(v.sha256||capture.sha256).slice(0,12)} ${v.width}w`).join(', ');img.sizes='(max-width: 800px) calc(100vw - 40px), (max-width: 1200px) 60vw, 900px';}
      img.addEventListener('error',()=>{const note=el('p','capture-status-note','This captured image could not be loaded. The live website is still available.');img.replaceWith(note);},{once:true});
      return img;
    }
    function populateGallery(project) {
      const capture=(captures.get(project.id)||[]).find(c=>c.view==='desktop');if(!capture)return;
      const holder=doc.querySelector(`[data-project-image="${project.id}"] .project-image-area`);if(!holder)return;
      holder.replaceChildren(makeImage(capture,project));holder.classList.add('has-capture');
    }
    function closeTopOverlay() {
      if(!active||!active.open)return false;
      const top=[...doc.querySelectorAll('dialog[open]')].at(-1);
      if(top&&top!==active)return false;
      active.close();return true;
    }
    function mountDialog(title, trigger, className='project-dialog') {
      if(active?.open)active.close();
      restoreTarget=trigger||doc.activeElement;
      const dialog=el('dialog',className);dialog.setAttribute('aria-labelledby','webzad-dialog-title');
      const header=el('div','dialog-header');const heading=el('h2','',title);heading.id='webzad-dialog-title';
      const close=el('button','dialog-close','×');close.type='button';close.setAttribute('aria-label','Close project details');
      header.append(heading,close);dialog.append(header);doc.body.append(dialog);active=dialog;
      close.addEventListener('click',()=>dialog.close());
      dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();dialog.close();});
      dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
      dialog.addEventListener('close',()=>{dialog.remove();if(active===dialog){active=null;currentProject=null;}const target=restoreTarget;if(target?.isConnected)target.focus({preventScroll:true});});
      return {dialog, close};
    }
    function showDialog(dialog, close) {
      if(typeof dialog.showModal!=='function'){dialog.remove();active=null;return false;}
      dialog.showModal();close.focus();return true;
    }
    function openProject(id,trigger) {
      if(disposed)return false;const project=projects.find(p=>p.id===id);if(!project)return false;
      const {dialog,close}=mountDialog(project.name,trigger);currentProject=id;
      const content=el('div','dialog-content');content.append(el('p','eyebrow',project.category),el('p','dialog-description',project.description));
      const highlights=el('ul','project-tags');for(const text of project.highlights||[]){highlights.append(el('li','',text));}content.append(highlights);
      const collection=el('div','dialog-captures'), available=captures.get(id)||[];
      if(available.length){for(const c of available){const fig=el('figure',c.view==='mobile'?'mobile-capture':'');fig.append(makeImage(c,project),el('figcaption','',c.view==='desktop'?'Homepage':c.view==='mobile'?'Mobile homepage':'Additional section'));collection.append(fig);}}
      else {collection.append(el('p','capture-status-note','Actual website screenshots have not been captured in this build yet. No generated mockup or stock image is being presented as the website. Open the live site to explore the real work.'));}
      content.append(collection);const actions=el('div','project-actions');const contact=el('button','btn btn-primary','Start a Related Project →');contact.type='button';
      contact.addEventListener('click',()=>{restoreTarget=null;dialog.close();const section=doc.getElementById('contact');section?.scrollIntoView({behavior:motionPolicy?.enabled?'smooth':'auto'});section?.focus({preventScroll:true});});
      actions.append(liveLink(project),contact);content.append(actions);dialog.append(content);return showDialog(dialog,close);
    }
    function openStudy(id,trigger) {
      if(disposed||!Object.hasOwn(STUDIES,id))return false;
      const study=STUDIES[id],{dialog,close}=mountDialog(study.name,trigger,'project-dialog study-dialog');
      const content=el('div','dialog-content');content.append(el('p','eyebrow','ORIGINAL DESIGN STUDY — NOT A VERIFIED CLIENT LAUNCH'));
      const img=el('img','study-full');img.src=study.path;img.alt=study.name+' — original Webzad concept illustration';img.decoding='async';content.append(img);dialog.append(content);
      return showDialog(dialog,close);
    }
    doc.querySelectorAll('[data-project-open]').forEach(button=>listen(button,'click',()=>openProject(button.dataset.projectOpen,button)));
    doc.querySelectorAll('[data-study]').forEach(button=>listen(button,'click',()=>openStudy(button.dataset.study,button)));
    // Pointer tilt is attached only when motion is allowed; touch keeps a flat, legible image.
    if(win?.matchMedia?.('(hover: hover) and (pointer: fine)').matches){
      doc.querySelectorAll('[data-project-image]').forEach(wrapper=>{
        let raf=0;const reset=()=>{if(raf)win.cancelAnimationFrame(raf);raf=0;wrapper.style.transform='';};
        listen(wrapper,'pointermove',event=>{if(!motionPolicy?.enabled||event.pointerType==='touch'){reset();return;}if(raf)return;const x=event.clientX,y=event.clientY;raf=win.requestAnimationFrame(()=>{raf=0;const r=wrapper.getBoundingClientRect();wrapper.style.transform=`perspective(1400px) rotateX(${(0.5-(y-r.top)/r.height)*2}deg) rotateY(${((x-r.left)/r.width-.5)*2}deg)`;});});
        listen(wrapper,'pointerleave',reset);listeners.push(reset);if(motionPolicy?.subscribe)listeners.push(motionPolicy.subscribe(on=>{if(!on)reset();}));
      });
    }
    const ready=typeof request==='function'?request('assets/portfolio/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Capture manifest unavailable');return r.json();}).then(manifest=>{if(disposed)return;for(const project of projects){const entry=manifest.projects?.find(p=>p.id===project.id&&p.url===project.url);captures.set(project.id,getApprovedCaptures(entry,project));populateGallery(project);}if(currentProject){const id=currentProject,target=restoreTarget;openProject(id,target);}}).catch(()=>{}):Promise.resolve();
    return {openProject,openStudy,closeTopOverlay,ready,destroy(){disposed=true;listeners.splice(0).forEach(fn=>fn());restoreTarget=null;active?.close();active?.remove();active=null;}};
  }
  return {PROJECTS,STUDIES,getApprovedCaptures,createPortfolio};
});
