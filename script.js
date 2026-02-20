// Diagnostics: log success and catch errors (non‑visual)
console.log("WEBZAD: Page loaded on GitHub Pages");
window.onerror = function(msg, src, line, col, err) {
  console.error("Global error:", msg, err);
};

// ---- main React app (unchanged) ----
(function () {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ---- moving light (poll game like) ----
  const initLight = () => {
    const orb = document.getElementById('lightOrb');
    if (!orb) return;
    const move = (e) => {
      const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth / 2);
      const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight / 2);
      orb.style.left = x + 'px';
      orb.style.top = y + 'px';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchstart', move);
  };

  // ---- constants ----
  const COMPANY_NAME = "WEBZAD";
  const COMPANY_EMAIL = "hello@webzad.dev";
  const LOGO_URL = "https://image2url.com/r2/default/images/1771491812097-2bb74a32-92a6-45f0-9131-2df6201fc9e0.blob";

  const ROUTES = [
    { key: "home", label: "Home" },
    { key: "work", label: "Work" },
    { key: "services", label: "Services" },
    { key: "pricing", label: "Pricing" },
    { key: "contact", label: "Contact" },
  ];

  const IMAGES = {
    hero: "https://image2url.com/r2/default/images/1771573016706-e23ecabe-07f9-4ecf-a4c3-fda4972cbcb5.blob",
    laptops: "https://image2url.com/r2/default/images/1771572818335-5f690792-2323-4eb8-b070-90e4f35cbb1b.blob",
    city: "https://image2url.com/r2/default/images/1771572521651-e61791bd-4a6d-41db-a1fa-90c1c7890ba4.blob",
    ux: "https://image2url.com/r2/default/images/1771572140006-02606ec1-ca46-46b2-8f72-69ffcadf6b58.blob",
  };

  const capabilityCards = [
    { title: "Websites (Any Type)", desc: "Business sites, landing pages, portfolios, e-commerce, booking sites, and more — built to look premium and work flawlessly.", tags: ["Mobile-First", "Fast", "Modern UI"] },
    { title: "Custom Web Apps", desc: "Dashboards, portals, and interactive experiences with real workflows — designed clean, built solid.", tags: ["React UI", "APIs", "Portals"] },
    { title: "Brand + Visual Systems", desc: "Logos, typography, and a consistent brand look that matches a high-end tech studio vibe.", tags: ["Logo", "Identity", "Design System"] },
    { title: "Performance + SEO Foundations", desc: "Clean structure, speed-first decisions, and best practices for search + usability.", tags: ["Core Web Vitals", "SEO", "Accessibility"] },
  ];
  const services = [
    { name: "Website Build (Any Type)", desc: "From scratch: structure, design, and build — responsive on every device." },
    { name: "Website Redesign / Remodel", desc: "Upgrade your current site to modern UI, better navigation, and faster performance." },
    { name: "E-commerce + Integrations", desc: "Storefront UI patterns, checkout flows, and integrations (payments, email, CRM)." },
    { name: "Web Apps + Portals", desc: "Client portals, dashboards, admin panels, and data-driven pages." },
  ];
  const work = [
    { icon: "🏢", title: "Business Website", desc: "Clean structure + trust-driven layout for service businesses.", tags: ["Conversion", "Mobile", "SEO"] },
    { icon: "🛒", title: "E-commerce UI", desc: "Product pages, collections, and checkout-focused experience.", tags: ["Catalog", "UX", "Integrations"] },
    { icon: "📈", title: "Lead Gen Landing", desc: "High-focus landing page with clear CTA and tracking-ready structure.", tags: ["Analytics", "Speed", "CTA"] },
    { icon: "🧩", title: "Portal / Dashboard", desc: "Secure layouts for users, data views, and admin tools.", tags: ["Auth", "Roles", "Workflows"] },
  ];
  const pricingRows = [
    { service: "Hourly Rate", range: "$70 – $175/hr", project: "—" },
    { service: "Landing Page", range: "$800 – $3,000", project: "$1,500 – $6,000" },
    { service: "Business Website", range: "$3,500 – $9,000", project: "$5,000 – $15,000" },
    { service: "E-commerce", range: "$8,000 – $25,000", project: "$10,000 – $40,000+" },
    { service: "Custom Web App", range: "$20,000 – $60,000+", project: "$25,000 – $80,000+" },
    { service: "Monthly Retainer", range: "$500 – $3,000/mo", project: "—" },
  ];
  const processSteps = [
    { title: "01 — Scope & Strategy", desc: "Define pages, features, target customers, and what success means (leads, sales, bookings)." },
    { title: "02 — Structure & Content", desc: "Organize navigation + sections so customers find what they need fast." },
    { title: "03 — Design (UI/UX)", desc: "Premium look with clean typography, spacing, and modern interaction." },
    { title: "04 — Build & QA", desc: "Responsive build, speed checks, cross-browser testing, and polish." },
    { title: "05 — Launch & Improve", desc: "Deploy, connect analytics, and iterate (retainer or on-demand)." },
  ];
  const testimonials = [
    { text: "“The layout feels premium and the site finally looks modern on mobile. Clean structure and fast loading.”", who: "NYC Small Business" },
    { text: "“Clear communication and a professional build. The pages are organized and the UX makes sense.”", who: "Service Brand" },
    { text: "“Strong design choices — futuristic but still clean and readable. Exactly the vibe we needed.”", who: "Creative Studio" },
  ];
  const faqs = [
    { q: "Can you build any type of website?", a: "Yes — business sites, landing pages, e-commerce, portfolios, booking sites, and web apps." },
    { q: "Do you do mobile + desktop?", a: "Always. Everything is built responsive-first so it looks correct on phone, tablet, and desktop." },
    { q: "Do you work with templates?", a: "I can, but my specialty is custom builds for speed, control, and unique design." },
    { q: "What do you need to start?", a: "Your goal, pages you need, examples you like, and any content you already have (logo/photos/text)." },
  ];

  const getRouteFromHash = () => (window.location.hash.replace("#", "").trim()) || "home";

  // lightbox component (identical to previous zoom/drag)
  const Lightbox = ({ open, src, alt, onClose }) => {
    const stageRef = useRef(null);
    const imgRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [tx, setTx] = useState(0);
    const [ty, setTy] = useState(0);
    const [baseScale, setBaseScale] = useState(1);
    const drag = useRef({ dragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });

    useEffect(() => { if (!open) return; setZoom(1); setTx(0); setTy(0); }, [open, src]);

    useEffect(() => {
      const stage = stageRef.current; const img = imgRef.current;
      if (!stage || !img) return;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      if (!iw || !ih) return;
      setBaseScale(Math.min(stage.clientWidth / iw, stage.clientHeight / ih));
    }, [open, src]);

    useEffect(() => {
      const img = imgRef.current;
      if (!img) return;
      img.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${baseScale * zoom})`;
    }, [zoom, tx, ty, baseScale]);

    const onWheel = (e) => { e.preventDefault(); const delta = e.deltaY > 0 ? -0.1 : 0.1; setZoom(z => Math.max(1, Math.min(4, z + delta))); };
    const onPointerDown = (e) => { if (zoom <= 1) return; drag.current.dragging = true; drag.current.startX = e.clientX; drag.current.startY = e.clientY; drag.current.startTx = tx; drag.current.startTy = ty; stageRef.current?.setPointerCapture(e.pointerId); };
    const onPointerMove = (e) => { if (!drag.current.dragging) return; const dx = e.clientX - drag.current.startX; const dy = e.clientY - drag.current.startY; setTx(drag.current.startTx + dx); setTy(drag.current.startTy + dy); };
    const onPointerUp = (e) => { drag.current.dragging = false; stageRef.current?.releasePointerCapture(e.pointerId); };
    const reset = () => { setZoom(1); setTx(0); setTy(0); };
    if (!open) return null;

    return React.createElement('div', { className: 'lightbox-backdrop', onClick: (e) => { if (e.target.classList.contains('lightbox-backdrop')) onClose(); } },
      React.createElement('div', { className: 'lightbox-panel' },
        React.createElement('div', { className: 'lightbox-topbar' },
          React.createElement('span', { className: 'lightbox-title' }, alt || 'image'),
          React.createElement('div', { className: 'lightbox-actions' },
            React.createElement('button', { className: 'lb-btn', onClick: () => setZoom(z => Math.max(1, z - 0.25)) }, '−'),
            React.createElement('button', { className: 'lb-btn', onClick: () => setZoom(z => Math.min(4, z + 0.25)) }, '+'),
            React.createElement('button', { className: 'lb-btn', onClick: reset }, 'reset'),
            React.createElement('button', { className: 'lb-btn magenta', onClick: onClose }, 'close')
          )
        ),
        React.createElement('div', { ref: stageRef, className: 'lb-stage', onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
          React.createElement('img', { ref: imgRef, src, alt, className: 'lb-img', draggable: false, onLoad: () => { if (stageRef.current && imgRef.current) setBaseScale(Math.min(stageRef.current.clientWidth / imgRef.current.naturalWidth, stageRef.current.clientHeight / imgRef.current.naturalHeight)); } }),
          React.createElement('div', { className: 'lb-hint' }, 'scroll/± zoom • drag to pan • esc close')
        ),
        React.createElement('div', { className: 'lb-meta' },
          React.createElement('span', null, React.createElement('b', null, 'zoom:'), (zoom * 100).toFixed(0), '%')
        )
      )
    );
  };

  // media card with zoom button (overlay text selectable)
  const ZoomableMediaCard = ({ src, alt, badge, title, note, openLightbox }) => {
    const handleZoomClick = (e) => { e.stopPropagation(); openLightbox(src, alt || title); };
    return React.createElement('div', { className: 'media-card' },
      React.createElement('img', { src, alt, className: 'media-img', draggable: false }),
      React.createElement('div', { className: 'media-overlay' },
        badge && React.createElement('div', { className: 'media-badge', onClick: (e) => e.stopPropagation() }, badge),
        title && React.createElement('div', { className: 'media-title', onClick: (e) => e.stopPropagation() }, title),
        note && React.createElement('div', { className: 'media-note', onClick: (e) => e.stopPropagation() }, note)
      ),
      React.createElement('div', { className: 'zoom-button', onClick: handleZoomClick }, '🔍')
    );
  };

  // ---- Smoky Cursor Component (lighter version) ----
  const SmokyCursor = () => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const mouseRef = useRef({ x: 0, y: 0, moved: false });
    const animationRef = useRef();

    useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      let width, height;

      const setCanvasSize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(devicePixelRatio, devicePixelRatio);
      };
      setCanvasSize();

      const onMouseMove = (e) => {
        mouseRef.current = { x: e.clientX, y: e.clientY, moved: true };
        // add particles – increased count and size for lighter effect
        const particles = particlesRef.current;
        for (let i = 0; i < 4; i++) { // from 3 to 4
          particles.push({
            x: e.clientX + (Math.random() - 0.5) * 20,
            y: e.clientY + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8 - 0.2,
            life: 1.0,
            size: 20 + Math.random() * 30, // from 15-40 to 20-50
            colorType: Math.random() > 0.5 ? 'cyan' : 'magenta'
          });
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('resize', setCanvasSize);

      const animate = () => {
        const particles = particlesRef.current;
        // update
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.005;
          if (p.life <= 0 || p.y < -50 || p.x < -50 || p.x > width + 50) {
            particles.splice(i, 1);
          }
        }

        // draw
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        for (let p of particles) {
          const rgb = p.colorType === 'cyan' ? '0, 255, 255' : '255, 0, 255';
          ctx.beginPath();
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          // increased opacity multiplier from 0.4 to 0.9 for lighter effect
          gradient.addColorStop(0, `rgba(${rgb}, ${p.life * 0.9})`);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        animationRef.current = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', setCanvasSize);
        cancelAnimationFrame(animationRef.current);
      };
    }, []);

    return React.createElement('canvas', {
      ref: canvasRef,
      className: 'smoky-cursor'
    });
  };

  // ---- rest of pages ----
  const NavBar = ({ activeRoute, navigate, isMobileOpen, setMobileOpen, openLightbox }) => {
    const navRef = useRef(null);

    useEffect(() => {
      const nav = navRef.current;
      if (!nav) return;
      const handleMouseMove = (e) => {
        const rect = nav.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        nav.style.setProperty('--mouse-x', x + '%');
        nav.style.setProperty('--mouse-y', y + '%');
      };
      const handleMouseLeave = () => {
        nav.style.setProperty('--mouse-x', '50%');
        nav.style.setProperty('--mouse-y', '50%');
      };
      nav.addEventListener('mousemove', handleMouseMove);
      nav.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        nav.removeEventListener('mousemove', handleMouseMove);
        nav.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, []);

    return React.createElement(React.Fragment, null,
      React.createElement('nav', { ref: navRef, className: 'navbar' },
        React.createElement('div', { className: 'navbar-glow' }),
        React.createElement('div', { className: 'nav-inner' },
          React.createElement('a', { className: 'brand', href: '#home', onClick: (e) => { e.preventDefault(); navigate('home'); } },
            React.createElement('img', { src: LOGO_URL, alt: 'WEBZAD logo', className: 'brand-logo-img', onClick: (e) => { e.preventDefault(); e.stopPropagation(); openLightbox(LOGO_URL, 'WEBZAD logo'); } }),
            React.createElement('div', null, React.createElement('div', { className: 'brand-name' }, COMPANY_NAME), React.createElement('div', { className: 'brand-sub' }, 'NYC freelance dev & design'))
          ),
          React.createElement('ul', { className: 'nav-links' }, ROUTES.map(r => React.createElement('li', { key: r.key }, React.createElement('a', { href: '#' + r.key, className: 'nav-link ' + (activeRoute === r.key ? 'active' : ''), onClick: (e) => { e.preventDefault(); navigate(r.key); } }, r.label.toUpperCase())))),
          React.createElement('a', { className: 'nav-cta', href: '#contact', onClick: (e) => { e.preventDefault(); navigate('contact'); } }, 'GET A QUOTE'),
          React.createElement('button', { className: 'hamburger', onClick: () => setMobileOpen(!isMobileOpen) }, isMobileOpen ? '✕' : '☰')
        ),
        React.createElement('div', { className: 'mobile-menu ' + (isMobileOpen ? 'open' : '') }, ROUTES.map(r => React.createElement('a', { key: r.key, href: '#' + r.key, className: 'nav-link', onClick: (e) => { e.preventDefault(); setMobileOpen(false); navigate(r.key); } }, r.label.toUpperCase())))
      )
    );
  };

  const HomePage = ({ navigate, openLightbox }) => {
    return React.createElement('div', { className: 'page' }, React.createElement('div', { className: 'container' },
      React.createElement('div', { className: 'hero-wrap' },
        React.createElement('div', null,
          React.createElement('div', { className: 'animate-on-scroll slide-left' },
            React.createElement('div', { className: 'kicker' }, '// Websites • Web Apps • Brand'),
            React.createElement('div', { className: 'hero-logo-container' }, React.createElement('img', { src: LOGO_URL, alt: 'WEBZAD', className: 'hero-image', onError: (e) => e.target.style.display = 'none' })),
            React.createElement('p', { className: 'hero-sub' }, 'I build websites of any type — business sites, landing pages, portfolios, e-commerce, booking pages, and web apps. Clean UI. Fast load. Mobile-first. Organized structure that feels premium.'),
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.9rem', marginTop: '1.2rem' } },
              React.createElement('a', { href: '#work', className: 'neon-btn', onClick: (e) => { e.preventDefault(); navigate('work'); } }, 'VIEW WORK'),
              React.createElement('a', { href: '#services', className: 'neon-btn neon-btn-magenta', onClick: (e) => { e.preventDefault(); navigate('services'); } }, 'SERVICES'),
              React.createElement('a', { href: '#contact', className: 'neon-btn', onClick: (e) => { e.preventDefault(); navigate('contact'); } }, 'CONTACT')
            )
          ),
          React.createElement('div', { className: 'trust-row animate-on-scroll', style: { transitionDelay: '0.1s' } },
            React.createElement('div', { className: 'trust' }, React.createElement('b', null, 'Mobile-first'), React.createElement('span', null, 'Looks right on every screen.')),
            React.createElement('div', { className: 'trust' }, React.createElement('b', null, 'Clean UI'), React.createElement('span', null, 'Modern layout + typography.')),
            React.createElement('div', { className: 'trust' }, React.createElement('b', null, 'Fast load'), React.createElement('span', null, 'Performance-minded builds.')),
            React.createElement('div', { className: 'trust' }, React.createElement('b', null, 'Organized'), React.createElement('span', null, 'Pages structured for clarity.'))
          )
        ),
        React.createElement(ZoomableMediaCard, { src: IMAGES.hero, alt: 'Modern workspace', badge: '⚡ NYC • Freelance • Custom Builds', title: 'Premium web presence', note: 'A structured site that converts customers and looks futuristic — without being messy.', openLightbox })
      ),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'animate-on-scroll' }, React.createElement('div', { className: 'kicker' }, '// What I deliver'), React.createElement('h2', { style: { color: 'var(--cyan)' } }, 'CAPABILITIES'), React.createElement('p', { className: 'muted', style: { maxWidth: '920px' } }, 'Everything is designed to be organized and professional: clear navigation, strong hierarchy, and modern UI patterns.')),
      React.createElement('div', { className: 'grid' }, capabilityCards.map((c, idx) => React.createElement('div', { key: c.title, className: 'card animate-on-scroll', style: { transitionDelay: (idx * 0.06) + 's' } }, React.createElement('div', { className: 'card-title' }, c.title), React.createElement('p', { className: 'muted' }, c.desc), React.createElement('div', { className: 'tag-row' }, c.tags.map(t => React.createElement('span', { key: t, className: 'tag' }, t)))))),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'split process-split' },
        React.createElement(ZoomableMediaCard, { src: IMAGES.laptops, alt: 'Team working', badge: '🔧 Build • Polish • Launch', title: 'Organized pages', note: 'Home → Services → Work → Pricing → Contact. Clean, necessary, and easy to navigate.', openLightbox }),
        React.createElement('div', null,
          React.createElement('div', { className: 'animate-on-scroll' }, React.createElement('div', { className: 'kicker' }, '// Quick process'), React.createElement('h2', { style: { color: 'var(--magenta)' } }, 'HOW IT WORKS'), React.createElement('p', { className: 'muted' }, 'A simple workflow that keeps your project moving.')),
          React.createElement('div', { className: 'grid', style: { marginTop: '1rem' } }, processSteps.slice(0, 3).map((s, idx) => React.createElement('div', { key: s.title, className: 'card animate-on-scroll', style: { transitionDelay: (idx * 0.06) + 's' } }, React.createElement('div', { className: 'card-title' }, s.title), React.createElement('p', { className: 'muted' }, s.desc)))),
          React.createElement('div', { className: 'animate-on-scroll', style: { marginTop: '1.1rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' } },
            React.createElement('a', { href: '#pricing', className: 'neon-btn', onClick: (e) => { e.preventDefault(); navigate('pricing'); } }, 'SEE PRICING'),
            React.createElement('a', { href: '#contact', className: 'neon-btn neon-btn-magenta', onClick: (e) => { e.preventDefault(); navigate('contact'); } }, 'START NOW')
          )
        )
      ),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'animate-on-scroll' }, React.createElement('div', { className: 'kicker' }, '// Proof of quality'), React.createElement('h2', { style: { color: 'var(--cyan)' } }, 'CLIENT NOTES'), React.createElement('p', { className: 'muted', style: { maxWidth: '920px' } }, 'Examples of the feedback you should expect when the site is organized, modern, and mobile-ready.')),
      React.createElement('div', { className: 'grid' }, testimonials.map((t, idx) => React.createElement('div', { key: t.who, className: 'quote animate-on-scroll', style: { transitionDelay: (idx * 0.06) + 's' } }, React.createElement('p', null, t.text), React.createElement('b', null, t.who)))),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'animate-on-scroll' }, React.createElement('div', { className: 'kicker' }, '// FAQ'), React.createElement('h2', { style: { color: 'var(--magenta)' } }, 'COMMON QUESTIONS')),
      React.createElement('div', { className: 'grid' }, faqs.map((f, idx) => React.createElement('div', { key: f.q, className: 'faq animate-on-scroll', style: { transitionDelay: (idx * 0.05) + 's' } }, React.createElement('q', null, f.q), React.createElement('p', null, f.a)))),
      React.createElement('div', { className: 'animate-on-scroll', style: { marginTop: '2.2rem', textAlign: 'center' } }, React.createElement('a', { href: '#contact', className: 'neon-btn neon-btn-magenta', onClick: (e) => { e.preventDefault(); navigate('contact'); } }, 'LET’S BUILD YOUR SITE'))
    ));
  };

  const WorkPage = ({ navigate, openLightbox }) => React.createElement('div', { className: 'page' }, React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'kicker' }, '// portfolio'), React.createElement('h2', null, 'WORK'), React.createElement('p', { className: 'muted' }, 'Examples of what I build.'),
    React.createElement('div', { className: 'grid' }, work.map((p, idx) => React.createElement('div', { key: p.title, className: 'card animate-on-scroll' }, React.createElement('div', { style: { fontSize: '2rem' } }, p.icon), React.createElement('div', { className: 'card-title' }, p.title), React.createElement('p', { className: 'muted' }, p.desc), React.createElement('div', { className: 'tag-row' }, p.tags.map(t => React.createElement('span', { key: t, className: 'tag' }, t)))))),
    React.createElement('div', { className: 'split' },
      React.createElement(ZoomableMediaCard, { src: IMAGES.ux, alt: 'UX board', badge: '🧠 UX + Structure', title: 'Clear navigation', note: 'Organized pages that guide users.', openLightbox }),
      React.createElement('div', { className: 'panel compact' }, React.createElement('h3', null, 'What your site should do'), React.createElement('ul', null, React.createElement('li', null, 'Explain what you offer in 10 seconds'), React.createElement('li', null, 'Build trust with clean visuals'), React.createElement('li', null, 'Convert visitors with clear CTAs'), React.createElement('li', null, 'Work on mobile and desktop'), React.createElement('li', null, 'Load fast and easy to update')))
    )
  ));

  const ServicesPage = ({ navigate, openLightbox }) => React.createElement('div', { className: 'page' }, React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'kicker' }, '// services'), React.createElement('h2', null, 'SERVICES'), React.createElement('p', { className: 'muted' }, 'Professional builds for NYC businesses.'),
    React.createElement('div', { className: 'grid' }, services.map((s, idx) => React.createElement('div', { key: s.name, className: 'service-card' }, React.createElement('h3', null, s.name), React.createElement('p', null, s.desc)))),
    React.createElement('div', { className: 'split' },
      React.createElement('div', { className: 'panel' }, React.createElement('h3', null, 'What you get'), React.createElement('ul', null, React.createElement('li', null, 'Home page that sells'), React.createElement('li', null, 'Services pages clear'), React.createElement('li', null, 'Work/portfolio layout'), React.createElement('li', null, 'Pricing section'), React.createElement('li', null, 'Contact section'))),
      React.createElement(ZoomableMediaCard, { src: IMAGES.city, alt: 'NYC view', badge: '🗽 NYC-ready', title: 'Premium presence', note: 'Designed to compete with agencies.', openLightbox })
    )
  ));

  const PricingPage = ({ navigate }) => React.createElement('div', { className: 'page' }, React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'kicker' }, '// pricing'), React.createElement('h2', null, 'PRICING'), React.createElement('p', { className: 'muted' }, 'Typical project ranges.'),
    React.createElement('table', { className: 'pricing-table' }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Service'), React.createElement('th', null, 'Typical Range'), React.createElement('th', null, 'Project Range'))), React.createElement('tbody', null, pricingRows.map((r, i) => React.createElement('tr', { key: i }, React.createElement('td', null, r.service), React.createElement('td', null, r.range), React.createElement('td', null, r.project))))),
    React.createElement('p', { className: 'note' }, 'If you want a precise quote, send your goal, website type, pages.'),
    React.createElement('div', { style: { marginTop: '1.35rem' } }, React.createElement('a', { href: '#contact', className: 'neon-btn neon-btn-magenta', onClick: (e) => { e.preventDefault(); navigate('contact'); } }, 'GET A QUOTE'))
  ));

  const ContactPage = () => React.createElement('div', { className: 'page' }, React.createElement('div', { className: 'container' },
    React.createElement('div', { className: 'kicker' }, '// contact'), React.createElement('h2', null, 'REACH OUT'), React.createElement('p', { className: 'muted' }, 'Tell me what type of website you need.'),
    React.createElement('div', { className: 'contact-block' },
      React.createElement('p', null, 'Let’s build something extraordinary together.'),
      React.createElement('a', { href: 'mailto:' + COMPANY_EMAIL, className: 'contact-email' }, COMPANY_EMAIL),
      React.createElement('div', { className: 'divider' }),
      React.createElement('div', { className: 'panel', style: { textAlign: 'left' } }, React.createElement('h3', null, 'Include this in your message'), React.createElement('ul', null, React.createElement('li', null, 'Type of website'), React.createElement('li', null, 'Goal'), React.createElement('li', null, 'Pages you want'), React.createElement('li', null, 'Examples you like'), React.createElement('li', null, 'Deadline + budget range')))
    )
  ));

  const NotFoundPage = ({ navigate }) => React.createElement('div', { className: 'page' }, React.createElement('div', { className: 'container' }, React.createElement('h2', null, 'NOT FOUND'), React.createElement('a', { href: '#home', className: 'neon-btn', onClick: (e) => { e.preventDefault(); navigate('home'); } }, 'GO HOME')));

  const App = () => {
    const [route, setRoute] = useState(getRouteFromHash());
    const [mobileOpen, setMobileOpen] = useState(false);
    const [lbOpen, setLbOpen] = useState(false);
    const [lbSrc, setLbSrc] = useState('');
    const [lbAlt, setLbAlt] = useState('');

    useEffect(() => { initLight(); }, []);

    useEffect(() => {
      const obs = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')), { threshold: 0.18 });
      document.querySelectorAll('.animate-on-scroll').forEach(el => obs.observe(el));
      return () => obs.disconnect();
    }, [route]);

    useEffect(() => {
      const onHash = () => setRoute(getRouteFromHash());
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const navigate = (key) => { window.location.hash = key; setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const openLightbox = (src, alt) => { setLbSrc(src); setLbAlt(alt || ''); setLbOpen(true); };

    const page = useMemo(() => {
      switch (route) {
        case 'home': return React.createElement(HomePage, { navigate, openLightbox });
        case 'work': return React.createElement(WorkPage, { navigate, openLightbox });
        case 'services': return React.createElement(ServicesPage, { navigate, openLightbox });
        case 'pricing': return React.createElement(PricingPage, { navigate });
        case 'contact': return React.createElement(ContactPage, null);
        default: return React.createElement(NotFoundPage, { navigate });
      }
    }, [route]);

    return React.createElement(React.Fragment, null,
      React.createElement(SmokyCursor, null),
      React.createElement(NavBar, { activeRoute: route, navigate, isMobileOpen: mobileOpen, setMobileOpen, openLightbox }),
      React.createElement('div', { className: 'page-shell' }, page, React.createElement('footer', { className: 'footer' }, '© 2026 WEBZAD — custom builds • modern UI • NYC-based.')),
      React.createElement(Lightbox, { open: lbOpen, src: lbSrc, alt: lbAlt, onClose: () => setLbOpen(false) })
    );
  };

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
})();