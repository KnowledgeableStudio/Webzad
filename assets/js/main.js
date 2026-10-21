/* Webzad page enhancement. Content, links and artwork remain visible without JavaScript. */
(function(){
'use strict';
const nav=document.getElementById('nav'),toggle=document.getElementById('navToggle'),menu=document.getElementById('mobileMenu');
const progress=document.getElementById('scrollProgress'),links=[...document.querySelectorAll('.nav-link')];
let store;try{store=window.localStorage;}catch{}
const policy=window.WebzadMotionTools.createMotionPolicy({mediaQuery:window.matchMedia('(prefers-reduced-motion: reduce)'),storage:store,document,connection:navigator.connection});
window.WebzadMotion=policy;
const motionButton=document.getElementById('motionToggle');
policy.subscribe(enabled=>{
 document.documentElement.dataset.motion=enabled?'on':'off';document.body.classList.toggle('motion-on',enabled);
 if(motionButton){const restricted=policy.reduced||policy.saveData;motionButton.disabled=restricted;motionButton.setAttribute('aria-pressed',String(!enabled));motionButton.setAttribute('aria-label',restricted?'Visual motion reduced by device preference':enabled?'Pause visual motion':'Resume visual motion');const span=motionButton.querySelector('span');if(span)span.textContent=restricted?'Motion reduced':enabled?'Motion on':'Motion paused';}
 if(!enabled)document.querySelectorAll('.reveal-pending').forEach(el=>el.classList.remove('reveal-pending'));
});
motionButton?.addEventListener('click',()=>policy.setUserPaused(!policy.userPaused));
const video=document.getElementById('heroVideo');
if(video)window.WebzadMotionTools.bindMotionVideo(video,policy,{IntersectionObserver:window.IntersectionObserver,mobile:window.matchMedia('(max-width: 600px)').matches});
function closeMenu(restoreFocus=false){if(!menu||menu.hidden)return false;menu.hidden=true;menu.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open menu');if(restoreFocus)toggle?.focus();return true;}
toggle?.addEventListener('click',()=>{if(!menu)return;if(!menu.hidden){closeMenu(true);return;}menu.hidden=false;menu.classList.add('open');toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close menu');menu.querySelector('a')?.focus();});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeMenu(false)));
document.addEventListener('click',event=>{if(menu&&!menu.hidden&&!menu.contains(event.target)&&!toggle?.contains(event.target))closeMenu(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open]')&&!window.zadaCompanion?.holoUI?.isOpen){if(closeMenu(true))event.preventDefault();}});
document.addEventListener('webzad:close-menu',()=>closeMenu(true));
window.addEventListener('resize',()=>{if(window.innerWidth>800)closeMenu(false);},{passive:true});
const sectionIds=['work','services','automation','process','contact'];
let queued=false;
function scrollUpdate(){queued=false;nav?.classList.toggle('sc',window.scrollY>20);const max=document.documentElement.scrollHeight-window.innerHeight;if(progress)progress.style.width=`${max>0?Math.min(100,Math.max(0,window.scrollY/max*100)):0}%`;let current='';for(const id of sectionIds){const el=document.getElementById(id);if(el){const r=el.getBoundingClientRect();if(r.top<=window.innerHeight*.42&&r.bottom>=window.innerHeight*.42){current='#'+id;break;}}}for(const a of links){if(a.getAttribute('href')===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}}
window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(scrollUpdate);}},{passive:true});scrollUpdate();
if('IntersectionObserver' in window){try{const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.remove('reveal-pending');observer.unobserve(e.target);}}},{threshold:.06});for(const el of document.querySelectorAll('[data-reveal]')){if(policy.enabled&&el.getBoundingClientRect().top>window.innerHeight+25)el.classList.add('reveal-pending');observer.observe(el);}}catch{document.querySelectorAll('.reveal-pending').forEach(el=>el.classList.remove('reveal-pending'));}}
function selectService(value){const field=document.querySelector('#contactForm select[name="service"]');if(!field||![...field.options].some(o=>o.value===value))return;field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('contact')?.scrollIntoView({behavior:policy.enabled?'smooth':'auto',block:'start'});field.focus({preventScroll:true});}
document.querySelectorAll('[data-service-value]').forEach(button=>button.addEventListener('click',()=>selectService(button.dataset.serviceValue)));
let pendingZada=null;
function openZada(button){const companion=window.zadaCompanion;if(!companion?.holoUI){pendingZada=button;button?.setAttribute('aria-busy','true');return;}pendingZada=null;button?.removeAttribute('aria-busy');companion.hideGreetingBubble?.();companion.holoUI.open();const prompt=button?.dataset.zadaPrompt;if(prompt){companion.holoUI.addMessage('user',prompt);companion.handleUserMessage(prompt);}}
document.querySelectorAll('[data-open-zada]').forEach(button=>button.addEventListener('click',()=>openZada(button)));
window.addEventListener('zada:ready',()=>{if(pendingZada)openZada(pendingZada);});
if(window.WebzadPortfolioTools)window.WebzadPortfolio=window.WebzadPortfolioTools.createPortfolio({document,projects:window.WebzadPortfolioTools.PROJECTS,motionPolicy:policy});
if(window.WebzadContactTools)window.WebzadContact=window.WebzadContactTools.mountContactForm({document,fetchFn:window.fetch.bind(window),apiBase:/^(www\.)?webzad\.dev$/.test(location.hostname)?'https://webzad.pages.dev':''});
document.querySelectorAll('[data-current-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
})();
