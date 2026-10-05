/**
 * main.js - Page behavior: nav, mobile menu, scroll reveal, contact form, lightbox.
 * Extracted from index.html so the Content-Security-Policy can drop 'unsafe-inline'.
 */
(function () {
"use strict";
var ZADA_API_BASE = (typeof location !== 'undefined' && /^(www\.)?webzad\.dev$/.test(location.hostname)) ? 'https://webzad.pages.dev' : '';
var nav = document.getElementById('nav');
var navToggle = document.getElementById('navToggle');
var mobileMenu = document.getElementById('mobileMenu');
var heroVideo = document.getElementById('heroVideo');

/* Nav scroll state */
var progress = document.getElementById('scrollProgress');
var navLinks = document.querySelectorAll('.nav-link');
var sectionIds = ['services', 'automation', 'work', 'process', 'contact'];
function onScroll() {
  if (window.pageYOffset > 40) { nav.classList.add('sc'); } else { nav.classList.remove('sc'); }
  var max = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.width = (max > 0 ? Math.min(100, window.pageYOffset / max * 100) : 0) + '%';
  var mid = window.innerHeight * 0.4, current = '';
  for (var i = 0; i < sectionIds.length; i++) {
    var el = document.getElementById(sectionIds[i]);
    if (el) { var r = el.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) { current = '#' + sectionIds[i]; break; } }
  }
  navLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === current); });
  if (heroVideo && window.pageYOffset < window.innerHeight) {
    heroVideo.style.transform = 'translateY(' + (window.pageYOffset * 0.35) + 'px) scale(' + (1 + window.pageYOffset * 0.00025) + ')';
    heroVideo.style.opacity = Math.max(0, 1 - (window.pageYOffset / window.innerHeight) * 0.9);
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Mobile menu */
function closeMenu() {
  mobileMenu.classList.remove('open');
  navToggle.setAttribute('aria-label', 'Open menu');
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.focus();
}
navToggle.addEventListener('click', function () {
  if (mobileMenu.classList.contains('open')) {
    closeMenu();
  } else {
    mobileMenu.classList.add('open');
    navToggle.setAttribute('aria-label', 'Close menu');
    navToggle.setAttribute('aria-expanded', 'true');
    var firstLink = mobileMenu.querySelector('a');
    if (firstLink) firstLink.focus();
  }
});
mobileMenu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); } });

/* Scroll reveal */
var observer = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) { entry.target.classList.add('rv'); observer.unobserve(entry.target); }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('[data-r]').forEach(function (el) { observer.observe(el); });

/* Contact form — posts to the same-origin API which relays to email server-side */
var form = document.getElementById('contactForm');
var formSuccess = document.getElementById('formSuccess');
var formError = document.getElementById('formError');
var submitBtn = document.getElementById('submitBtn');
var lastSubmit = 0;

form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (Date.now() - lastSubmit < 5000) return; // basic double-submit debounce
  lastSubmit = Date.now();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  formError.classList.remove('show');
  var data = {};
  new FormData(form).forEach(function (v, k) { data[k] = v; });
  fetch(ZADA_API_BASE + '/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data)
  }).then(function (r) {
    return r.json().then(function (j) { return { ok: r.ok, j: j }; });
  }).then(function (res) {
    if (!res.ok || !res.j.success) throw new Error(res.j.error || 'Send failed');
    form.style.display = 'none';
    formSuccess.classList.add('show');
  }).catch(function () {
    formError.classList.add('show');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Project Brief';
  });
});

/* Lightbox */
var lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.setAttribute('role', 'dialog');
lightbox.setAttribute('aria-modal', 'true');
lightbox.innerHTML = '<div class="lightbox-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></div><img/><p class="lightbox-caption"></p>';
document.body.appendChild(lightbox);
var lbImg = lightbox.querySelector('img');
var lbCap = lightbox.querySelector('.lightbox-caption');
var lbClose = lightbox.querySelector('.lightbox-close');
var lbPrevFocus = null;
function openLightbox(src, caption) {
  lbPrevFocus = document.activeElement;
  lbImg.src = src;
  lbCap.textContent = caption || '';
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbClose.focus();
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  lbImg.src = '';
  if (lbPrevFocus) { lbPrevFocus.focus(); lbPrevFocus = null; }
}
document.querySelectorAll('[data-lightbox]').forEach(function (el) {
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.addEventListener('click', function () { openLightbox(el.dataset.lightbox, el.dataset.caption); });
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(el.dataset.lightbox, el.dataset.caption); }
  });
});
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox(); });

/* Video play fallback for mobile */
if (heroVideo) {
  heroVideo.play().catch(function () {});
  document.addEventListener('touchstart', function () {
    heroVideo.play().catch(function () {});
  }, { once: true, passive: true });
}

/* Zada chat triggers */
document.getElementById('zadaFooterTrigger') && document.getElementById('zadaFooterTrigger').addEventListener('click', function () {
  if (window.zadaCompanion && window.zadaCompanion.holoUI) window.zadaCompanion.holoUI.open();
});
document.getElementById('askZadaAutomationBtn') && document.getElementById('askZadaAutomationBtn').addEventListener('click', function () {
  if (window.zadaCompanion && window.zadaCompanion.holoUI) {
    window.zadaCompanion.holoUI.open();
    window.zadaCompanion.handleUserMessage('Tell me about your automation services');
  }
});
})();
