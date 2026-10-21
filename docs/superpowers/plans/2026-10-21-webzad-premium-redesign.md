# Webzad Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task after owner review. Steps use checkbox (`- [ ]`) syntax for tracking. No subagent execution or independent review capability is assumed in this session.

**Goal:** Redesign the existing Webzad website into a cinematic, responsive creative-technology portfolio while preserving the original brand, Zada system, valid data, contact contract, and backend.

**Architecture:** Keep semantic HTML/CSS and the existing browser JavaScript/Node/Cloudflare structure. Add narrowly scoped presentation, portfolio, and motion modules; do not migrate to React or replace Zada. Existing APIs retain their payload contracts, with additive project identifiers in both server tool definitions.

**Tech Stack:** Existing static frontend, vendored Three.js r168, Node.js built-in HTTP/test APIs; baseline tested on Node v22.16.0. Read-only browser/media tooling available in this environment: Python Playwright 1.57.0, Pillow 12.3.0. These are development tools, not new website runtime dependencies; no product dependency installation is planned.

**Spec:** `docs/superpowers/specs/2026-10-21-webzad-premium-redesign-design.md` (owner approved its preservation-first direction in the conversation on 21 October 2026). The original specification remains unchanged as a historical artifact.

## Global Constraints

The following lines are copied from the approved specification and apply to every task:

- “Production deployment and production-data changes are not authorized.”
- “Keep the actual Webzad logo asset.”
- “Maintain the original branded cinematic video.”
- “The references' invented numerical claims, testimonials, and partner logos are not approved site content.”
- “Preserve the original service offerings and backend-select values.”
- “Never submit a form automatically from an AI action.”
- “The public site must not ship an empty, fabricated or mislabeled capture as completed work.”
- “Keep `growth`, `hospitality` and `services` working for legacy design studies.”
- “Preserve section IDs and contact field names.”
- “Do not invent persistent chat storage: the baseline implementation uses in-memory chat state.”
- “Do not weaken CSP to accommodate new inline effects; use external modules and style files.”
- “No deployment occurs automatically.”

Additional implementation decisions: work only on Webzad; do not touch an NXUS project. Use `top`, `services`, `automation`, `work`, `process`, `contact` as existing DOM section IDs and retain the `hero` AI alias for `top`. Keep form fields `name`, `email`, `company`, `service`, `timeline`, `goals`, `website`, and the direct address `knowledgablellc@gmail.com`. Do not request secret values in chat.

## Review Focus

Five high-risk conditions are explicitly covered below:

1. Slow/failed WebGL, a missing model, and a user opening Zada immediately: chat opens and remains usable, without waiting for or duplicating 3D initialization (Task 6).
2. Missing, stale, mislabeled, or descriptive-only “screenshots”: verification refuses release; real raw image bytes and provenance are required (Tasks 2 and 5).
3. Keyboard use with multiple overlays, a software keyboard, or 200% text zoom: focus remains in the intended interface and returns to the invoking control without another Escape listener stealing it (Tasks 4, 5, 6 and 9).
4. Disabled animation, background tabs, unavailable storage, or a data-saving connection: content and chat remain accessible; video, depth and procedural effects stop without restarting against the preference (Task 3).
5. Encoded paths, symlink escapes, unknown asset requests, or a hanging contact provider: private files remain unavailable, missing assets do not masquerade as HTML, and forms recover honestly without duplicate delivery (Tasks 1 and 8).

---

## Execution boundary and current evidence

The source of truth is `/mnt/data/Webzad.zip`, SHA-256 `923de12b47494d29749cde7325e3c3d6f9f65aaae187be78d86d16d74a5b9210`. The read-only extracted inspection copy is `/mnt/data/Webzad-source-review/Webzad`. All 73 non-Git source files match the original audit manifest. A fresh `node --test test/*.test.cjs` run passed 163 tests, zero failures; see `planning-evidence/baseline-recheck.tap`.

No application implementation has begun. This plan does not claim access to or changes in `F:\WEBZAD\Webzad`, nor to production data.

The TinyFish run `89a822a4-57c9-44bd-9c9e-09a070e81fc6` finished on 21 October 2026. It inspected ZADDY.ART but did not provide screenshot bytes, exportable artifact identifiers, or download links. Its narrative capture times conflict with the run metadata and must not be used as image provenance. Its inability to resize is a tool limitation, not evidence that the website is unresponsive. No further paid capture runs were started with the same unusable export path. All four real capture deliverables remain open.

A blocked capture or browser gate must be reported, not bypassed. Independent implementation tasks may continue, but an incomplete gallery or unverified browser result must not be called production-ready.

## File boundaries and implementation contracts

Paths below are relative to the future isolated Webzad working tree.

| File / group | Responsibility |
| --- | --- |
| `index.html`, `assets/css/main.css`, `assets/css/zada.css` | Original entry point, full visual redesign, assistant styling |
| `assets/js/main.js` | Small page initializer; navigation, section state, service actions |
| `assets/js/site-motion.js` | One motion/visibility policy, shared with video, portfolio and companion |
| `assets/js/portfolio.js` | Four-project registry, details/lightbox interactions, verified links |
| `assets/js/contact-form.js` | Existing contact payload and accessible submission states |
| `assets/js/zada.js`, `zada-holo-ui.js`, `zada-renderer.js` | Early chat availability, additive project actions, recoverable 3D |
| `assets/js/zada-actions.js` | Existing semantic action whitelist, additive project IDs |
| `server-public-paths.cjs` | Testable static-path allowlist and real-path containment |
| `open-site-server.cjs` | Existing local routes with safe static serving and contact timeout |
| `server-gemini-tools.cjs`, `functions/_shared/gemini.js` | Matching server-side project knowledge and tool enums |
| `functions/api/contact.js`, `functions/_middleware.js` | Production-target behavior/parity fixes only where demonstrated by tests |
| `assets/portfolio/<id>/`, `assets/portfolio/manifest.json` | Optimized real captures and non-sensitive provenance metadata |
| `assets/media/` | Derivatives of original video/logo/portrait; originals retained |
| `evidence/portfolio/raw/<id>/`, `evidence/qa/` | Raw captures and test reports, outside deployment allowlist |
| `tools/capture_portfolio.py`, `tools/prepare_media.py`, `tools/verify_browser.py` | Explicit development capture/media/browser checks |
| `tools/check-portfolio.cjs`, `tools/test.cjs` | Asset/provenance gate and cross-platform Node test runner |
| `package.json`, `requirements-dev.txt`, Windows launchers, `README.md` | Reproducible local use; stage-only build; no implicit deployment |
| `test/*.test.cjs`, `test/test_capture_portfolio.py` | Original plus new regression coverage |
| `404.html`, `assets/js/not-found.js`, `sitemap.xml`, `_headers` | CSP-compatible fallback, metadata and headers |

Browser modules follow the repository's existing browser-global/CommonJS-compatible pattern; do not set `package.json` to `type: module` and break its `require()` tests. Define `window.WebzadPortfolio`, `window.WebzadMotion`, and `window.WebzadContact` only for the interfaces described below; do not expose provider instructions or secrets.

## Task 1 — Recoverable workspace and safe local development

**Files:** Create `server-public-paths.cjs`, `package.json`, `tools/test.cjs`, `test/server-static.test.cjs`, `test/deploy-staging.test.cjs`; modify `open-site-server.cjs`, `deploy-prod.cjs`, `.gitignore`, `start-open-site-server.cmd`, `README.md`. Integrate the supplied `RUN-WEBZAD.cmd` only after inspection.

**Interfaces:** `resolvePublicPath(root: string, pathname: string): Promise<string|null>` returns an existing, allowlisted, real filesystem path or `null`. Existing `handleRequest(req,res)` and exported API handlers retain their signatures. `npm run dev` starts the existing Node server; `npm test` runs every `.test.cjs`; `npm run build` runs `node deploy-prod.cjs --no-deploy` only.

- [ ] **1.1 Establish isolation.** Use the worktree skill after plan approval. Recover the original Git history from the archive into an isolated directory; inspect tracked state and do not execute hooks or configure a remote. Record baseline hashes, archive checksum and starting commit before changes. Do not use force-reset, clean, or delete original files.
- [ ] **1.2 Write the failing static regression tests.** Test real requests to a temporary local server for all endpoints below; include a symlink under `assets/` resolving outside the public tree and another pointing at an internal source file. Assert no private response body is returned.

```js
for (const p of ['/.git/config', '/server-gemini-tools.cjs', '/.env',
  '/functions/_shared/gemini.js', '/docs/private.md', '/package.json',
  '/%2e%2e/private.txt', '/assets/../open-site-server.cjs']) {
  assert.ok([400, 403, 404].includes((await requestRaw(p)).status));
}
assert.equal((await requestRaw('/assets/missing.png')).status, 404);
assert.equal((await requestRaw('/')).status, 200);
assert.equal((await requestRaw('/assets/js/zada.js')).status, 200);
```

`requestRaw(pathname)` in this test is a `node:http` request to the ephemeral test server, preserving encoded paths rather than normalizing them in a URL constructor.

- [ ] **1.3 Run red:** `node --test test/server-static.test.cjs`; the old server exposes internal paths.
- [ ] **1.4 Implement the boundary.** Allow only explicit public root entries and approved media/script/style extensions under `assets/`. Resolve real paths and recheck both containment and public eligibility after symlink resolution. Reject malformed encoding, NUL and backslash traversal. Missing assets return 404, not the homepage. Keep APIs routed before static handling; preserve correct content types and CSP/security headers. Verify the fallback policy with tests.
- [ ] **1.5 Add running/staging commands.** Keep Node 22.16.0 as the tested minimum; add no framework or runtime package. Implement `tools/test.cjs` using `readdirSync` plus `spawnSync(process.execPath, ['--test', ...files])` so Windows does not depend on shell glob expansion. Launcher uses its extracted project directory, checks Node and opens the actual listening address; it must not open this session's inaccessible localhost for the user. Document port conflicts without killing unrelated processes.
- [ ] **1.6 Verify green and stage isolation.** Run both new test files and the entire original suite. Staging tests use a temporary copy and assert no secrets, source tools, tests, docs, raw evidence or nested private files are staged. No CLI deployment invocation is executed.
- [ ] **1.7 Commit:** `fix: secure Webzad development server and run commands` after reviewing the diff.

## Task 2 — Real screenshot capture and provenance pipeline

**Files:** Create `tools/capture_portfolio.py`, `tools/check-portfolio.cjs`, `test/test_capture_portfolio.py`, `test/portfolio-assets.test.cjs`, `assets/portfolio/manifest.json`, raw evidence and optimized per-project directories. Record development-only Python versions in `requirements-dev.txt`.

**Interfaces:** Project IDs are exactly `zaddy`, `la-socieda`, `one-of-six`, `brg`. `validatePortfolio(manifest, projectRoot): Promise<{ok:boolean, issues:string[]}>` is exported from `tools/check-portfolio.cjs`. Capture CLI: `python tools/capture_portfolio.py --project all --output evidence/portfolio/raw`.

| ID | Exact live destination | Capture targets |
| --- | --- | --- |
| `zaddy` | `https://zaddy.art/` | Homepage; visible music/merchandise section; mobile homepage |
| `la-socieda` | `https://www.lasociedarecord.com/` | Homepage; roster/catalog section; mobile homepage |
| `one-of-six` | `https://1of6.productions/` | Homepage; event/production section; mobile homepage |
| `brg` | `https://www.brgofficial.com/` | Homepage; collection/product section; mobile homepage |

- [ ] **2.1 Write failing integrity tests.** Require four distinct desktop image hashes, all four exact destinations, and decodable image files. Reject a missing image, text/HTML renamed to PNG, duplicate screenshot reuse, an error/blocked page, and a manifest row without capture time, final URL, viewport, device scale, hash, alt text and status. Manifests with unresolved screenshots cannot return `ok:true`.
- [ ] **2.2 Run red:** `node --test test/portfolio-assets.test.cjs`; raw captures and the manifest are absent.
- [ ] **2.3 Implement read-only capture.** Use a real browser viewport of 1600×1000 for desktop and 390×844 for mobile, device scale 1, and an anonymous context. Wait for fonts/assets and visible content with a bounded timeout; scroll ordinarily to a secondary section after inspecting the real page. Do not inject content, change styles, make purchases, fill forms, or circumvent access controls. Call Playwright `page.screenshot(path=...)`; derive timestamps from the capture process, not agent prose. Record failures instead of saving an error page as a successful capture.
- [ ] **2.4 Obtain and inspect the actual image bytes.** First verify that the permitted browser can export one usable capture before repeating work. If blocked, keep the failure record and leave the release gate open; preserve the script for execution in an authorized environment. Do not treat the TinyFish text-only result as an image. Inspect every obtained raw image visually before accepting it.
- [ ] **2.5 Generate derivatives.** Preserve raw PNGs outside public assets. Create WebP variants at 640/960/1600 widths without upscaling; mobile stays at its captured aspect ratio. Preserve readable text, record derivative and raw SHA-256 values, and store each project separately. An unavailable mobile/secondary view must be explicitly recorded, never fabricated.
- [ ] **2.6 Verify:** `python -m unittest discover -s test -p 'test_capture_portfolio.py'` and `node tools/check-portfolio.cjs`; accepted desktop captures must be 4/4. Secondary/mobile omissions remain visible in the final report, and every detail presentation needs at least two actual captures to satisfy the approved design.
- [ ] **2.7 Commit only real accepted assets and tooling:** `feat: add verified live-project capture pipeline`. Do not commit a placeholder manifest as completed portfolio content.

## Task 3 — Cinematic assets and shared motion policy

**Files:** Create `assets/js/site-motion.js`, `tools/prepare_media.py`, `test/site-motion.test.cjs`, derivatives under `assets/media/`; modify video markup/CSS and `assets/js/main.js`.

**Interfaces:** `createMotionPolicy({mediaQuery, storage, document}): {enabled:boolean, setUserPaused(paused:boolean):void, subscribe(listener):()=>void, destroy():void}`; expose the initialized policy as `window.WebzadMotion`. Store only `webzad-motion-paused` with `1` or `0`, catching storage errors. `enabled` is false when reduced motion is requested, the user pauses, or the document is hidden.

- [ ] **3.1 Write failing tests:** reduced-motion startup never calls `video.play`; a user pause survives reload; throwing storage does not crash; hiding/restoring the document does not override an explicit pause; unsubscribed/destroyed listeners stop firing.
- [ ] **3.2 Run red:** `node --test test/site-motion.test.cjs`.
- [ ] **3.3 Prepare original-derived media.** Extract an attractive matching globe still from `Background.mp4`; create desktop/mobile WebP posters and optimized muted video derivatives. Preserve `Background.mp4`, the logo, portrait and model byte-for-byte. Record encoder command, dimensions, file sizes and hashes; do not invent compression/speed improvements before measuring them.
- [ ] **3.4 Implement motion policy and visible control.** Use an accessible toggle with truthful `aria-pressed` and label. Video is a progressive enhancement, muted and inline; load it only under the allowed motion/data policy. Use a static poster for reduced-motion/data-saving states. Remove the unconditional touchstart replay and existing unrestricted parallax. Use one throttled animation path, stop offscreen video, and retain native scrolling.
- [ ] **3.5 Verify green:** tests plus hash comparison for original assets. Check live policy changes, background-tab resume and rejected autoplay in the browser harness (Task 9).
- [ ] **3.6 Commit:** `feat: optimize cinematic media with shared motion controls`.

## Task 4 — Full editorial homepage and functional navigation

**Files:** Modify `index.html`, `assets/css/main.css`, `assets/js/main.js`, `assets/css/zada.css`; create `test/page-contract.test.cjs`; add browser cases to `tools/verify_browser.py`.

**Interfaces:** Preserve all original section/form/assistant trigger IDs. A service CTA uses `data-service-value` containing an exact existing form option; selecting a service scrolls to the form and updates its select, without submitting. New Zada CTAs use `data-open-zada` and route through the same initialized companion.

- [ ] **4.1 Write red DOM-contract tests:** exactly one H1; all six section anchors and original form names; original logo; no duplicate IDs; three hero actions target `#work`, `#contact`, `#automation`; a visible motion button; no `href="#"` pretending to be an action; service buttons have valid select values.
- [ ] **4.2 Run red:** `node --test test/page-contract.test.cjs`.
- [ ] **4.3 Recompose the entire page.** Header → asymmetric cinematic hero → editorial selected work → visual services → AI automation → process → split contact → footer. Use the approved hero headline and supporting sentence exactly. Keep the globe visible to the right at wide widths; on mobile place copy/actions before a proportioned cinematic region. Use 1280–1440px maximum content width, 20–24px mobile gutters, cyan/violet accents and sharp text. Do not place a desktop mockup image over the page and call it a redesign.
- [ ] **4.4 Implement services/process/footer.** Retain all six existing services, with AI automation additionally reachable in its existing section. Reuse and optimize suitable illustrations as labeled service/design imagery; keep them separate from actual project screenshots. Provide four process stages, real direct email and meaningful footer links. Remove unsupported metrics, testimonials, guarantees and booking/social controls without real destinations.
- [ ] **4.5 Repair navigation/focus.** Mobile disclosure updates `aria-expanded`, closes only when open, and does not steal focus from a dialog. Skip link targets meaningful main content. Content stays visible when JavaScript or IntersectionObserver is unavailable; no reveal class may hide the page permanently. Active anchors use `aria-current` and scroll offsets that clear the header.
- [ ] **4.6 Verify:** Node DOM contracts and browser checks at 320/390/768/834/1440/1920px, 200% text zoom, keyboard-only navigation, disabled scripts and denied fonts. Confirm no clipped headings, forced landscape layout or horizontal page overflow.
- [ ] **4.7 Commit:** `feat: redesign Webzad homepage in cinematic editorial style`.

## Task 5 — Four distinct portfolio presentations and accessible details

**Files:** Create `assets/js/portfolio.js`, `test/portfolio.test.cjs`; integrate markup/CSS and actual assets in `index.html` and `assets/css/main.css`. Keep all three legacy work assets.

**Interfaces:** Frozen `PROJECTS` entries contain `{id,name,url,category,description,captures}` with Task 2 IDs. `createPortfolio({document, projects, motionPolicy}): {openProject(id:string, trigger?:HTMLElement):boolean, closeTopOverlay():boolean, destroy():void}`; expose instance as `window.WebzadPortfolio`. Unknown IDs return `false` and never open a default unrelated image.

- [ ] **5.1 Write failing tests:** only the four allowed IDs resolve to their exact HTTPS URLs; every live link has `target="_blank" rel="noopener noreferrer"`; unknown project IDs return false; image paths map to accepted capture entries; old study IDs remain separately addressable.
- [ ] **5.2 Run red:** `node --test test/portfolio.test.cjs`.
- [ ] **5.3 Build editorial showcases.** Alternate wide screenshot/copy compositions with project numbers, verified concise descriptions, distinct typography/accent treatment and subtle browser frames. Use normal images with fixed dimensions and responsive sources; apply shallow perspective only to a visual wrapper, never distort screenshot pixels or essential text. Touch/reduced-motion disables tilt. All live links remain in static HTML without JS.
- [ ] **5.4 Build native dialog details.** Each has a labeled heading, real homepage plus secondary capture, meaningful captions, mobile view when available, live-site link and contact action. Use native modal behavior, a real close button, Escape, contained scrolling and return focus. Preserve in-flight Zada messages. A CTA from a dialog closes it before focusing the contact section. Add a clearly labeled Design studies presentation for `growth`, `hospitality`, `services` with an accessible legacy-image lightbox.
- [ ] **5.5 Verify:** all Node tests plus keyboard Tab/Shift+Tab/Escape, pointer and touch, resize while open, long captions and stacked chat/detail interactions. An absent capture must fail the release check, not show a generic stock image. Inspect all four visuals individually.
- [ ] **5.6 Commit:** `feat: add real four-project portfolio and detail dialogs` only when real accepted assets are connected; otherwise mark this task blocked, not complete.

## Task 6 — Immediate Zada chat and recoverable original 3D

**Files:** Modify `assets/js/zada.js`, `zada-holo-ui.js`, `zada-renderer.js`, `assets/css/zada.css`; extend existing orchestration/UI/renderer tests and add `test/zada-startup.test.cjs`.

**Interfaces:** Keep `ZadaCompanion.init(containerEl,config)` and current public methods. Add idempotent `ensure3D(): Promise<boolean>`; a failure resolves false without destroying chat. Mount UI, controls, greeting and `window.zadaCompanion` before awaiting vendor/model work. Keep `config.skipModelLoad` for tests. `ZadaRenderer.calculateRenderSize(width,height,isMobile,dpr)` returns `{width,height,pixelRatio}` within desktop 1.75/mobile 1.25 DPR caps plus a 1,500,000-pixel drawing-buffer ceiling.

- [ ] **6.1 Write red tests:** renderer/vendor/model failures do not prevent `holoUI.open`; two simultaneous `ensure3D` calls produce one initialization/model fetch; initial page load does not fetch `zada.glb`; closing/reopening does not erase messages; destroying during initialization cannot attach a late canvas.
- [ ] **6.2 Run red:** `node --test test/zada-startup.test.cjs` and existing orchestration tests.
- [ ] **6.3 Separate chat from 3D.** Keep state/audio/action/visitor modules and original greeting. Make all site triggers immediately usable after page initialization. On first user opening of chat, request the original 3D enhancement only when policy permits; offer an explicit enable-3D action under data-saving/reduced-motion conditions without forcing animation. Catch renderer creation and model failures independently. Do not replace the system with canned answers or a new chatbot.
- [ ] **6.4 Refine chat accessibility and layout.** Use a labeled dialog/sheet with clear input focus, visible close/mic/speech buttons and mobile safe-area/keyboard clearance. Preserve current speech-recognition behavior and mic permission prompts. Only the top active overlay handles Escape. Keep streamed message DOM/state alive when a project opens. Availability text must not imply a verified live provider connection.
- [ ] **6.5 Apply render budgets.** Preserve procedural motion, context recovery and existing visibility handling. Use Task 3's policy, a single renderer, bounded drawing-buffer pixels and appropriate offscreen sleep. An optional 3D failure leaves the portrait/chat controls available. Keep original `zada.glb`, audio, motion and aura assets; do not silently remove existing capability.
- [ ] **6.6 Verify:** extended old/new tests, 4K/high-DPR sizing, WebGL unavailable, throttled model request, denied mic, repeated open/close and resize/context loss. Record actual browser observations separately from mocks.
- [ ] **6.7 Commit:** `fix: make Zada chat independent of optional 3D loading`.

## Task 7 — Add real projects to Zada without removing existing knowledge

**Files:** Modify `assets/js/zada-actions.js`, `assets/js/zada.js`, `server-gemini-tools.cjs`, `functions/_shared/gemini.js`; extend `test/zada-actions.test.cjs`, `test/zada-orchestration.test.cjs`, `test/server-knowledge.test.cjs`; create `test/portfolio-schema-parity.test.cjs`.

**Interfaces:** Approved projects become the original `growth`, `hospitality`, `services` plus `zaddy`, `la-socieda`, `one-of-six`, `brg`. Keep `openProjectPreview({projectId})` payload shape. Its new-project handler calls `WebzadPortfolio.openProject`; legacy handlers use the preserved study presentation. `dismissOverlay` uses the shared actual close/focus pathways, not raw CSS removal.

- [ ] **7.1 Write failing parity tests:** every old and new identifier validates in the frontend and appears in both server tool schemas; arbitrary selectors, HTML, JS URLs and unknown identifiers remain rejected. A missing UI target returns a truthful failure, not an unconditional success. Prefill must never call `submit` or `requestSubmit`.
- [ ] **7.2 Run red:** `node --test test/portfolio-schema-parity.test.cjs test/zada-actions.test.cjs`.
- [ ] **7.3 Make additive knowledge changes.** Describe the four real sites using only approved source facts. Label the original work as design studies, update work chips and hero/action labels, and retain all unrelated valid persona/instructions/security rules. Do not claim verified payments, business results, persistent chat history or operational custom integrations. Review both knowledge diffs side-by-side; preserve provider configuration and API request/stream formats.
- [ ] **7.4 Wire actions and motion.** Retain `hero`→`top`, service-prefill mapping and safe scroll behavior. New project actions open the correct presentation; dismissal updates menu/dialog state and restores focus properly. Honor reduced motion for AI navigation too.
- [ ] **7.5 Verify:** full tests; stream fixtures with valid and rejected tool calls; node/Cloudflare enum parity; chat context after navigating to every section; no browser payload contains server instructions or credentials.
- [ ] **7.6 Commit:** `feat: connect Zada to verified portfolio projects`.

## Task 8 — Contact reliability and honest delivery states

**Files:** Create `assets/js/contact-form.js`, `test/contact-form.test.cjs`, `test/server-contact.test.cjs`, `test/cloudflare-contact.test.cjs`; modify `assets/js/main.js`, `index.html`, `open-site-server.cjs`; change `functions/api/contact.js` only for an observed parity defect.

**Interfaces:** `mountContactForm({document,fetchFn,apiBase}): {destroy():void}`; exposes no secret. POST fields and endpoint stay unchanged. Keep original DOM hooks `contactForm`, `submitBtn`, `formSuccess`, `formError`; Node `handleContactRequest(req,res,{fetchFn})` remains injectable. Mirror the existing Cloudflare 10,000ms provider timeout locally.

- [ ] **8.1 Write failing tests:** valid brief/provider success; missing fields; invalid email/service; CRLF input; excessive body; honeypot with zero upstream calls; missing key; JSON and non-JSON provider failures; timeout/network loss; duplicate click while pending; retry after failure. In browser UI, a failure retains entered text and restores the button. A successful relay does not promise a visitor confirmation email.
- [ ] **8.2 Run red:** `node --test test/contact-form.test.cjs test/server-contact.test.cjs test/cloudflare-contact.test.cjs`.
- [ ] **8.3 Implement focused improvements.** Preserve validation, rate limiting, provider destination and email contract. Catch timeout and malformed provider responses with safe errors. Use `aria-busy`, status announcements and actionable direct-email fallback. Success says the project brief was received, not that a separate confirmation email was sent. Do not enable optional Turnstile without a complete tested frontend flow.
- [ ] **8.4 Verify:** all new tests and existing chat/visitor tests. Cloudflare tests use a local harness with `Request`/`Response` and scoped upstream fetch fixtures; no real emails, production visitor beacons or paid AI calls. Explicitly distinguish fixture tests from provider delivery verification.
- [ ] **8.5 Commit:** `fix: preserve contact workflow and reliable submission feedback`.

## Task 9 — Metadata, browser acceptance, staging and delivery

**Files:** Modify `404.html`, `sitemap.xml`, `robots.txt`, `_headers`, homepage metadata, `README.md`; create `assets/js/not-found.js`, social-image derivative, `tools/verify_browser.py`, `test/release-contract.test.cjs`, `docs/REDESIGN-DELIVERY.md`, evidence reports and screenshots.

**Interfaces:** `python tools/verify_browser.py --base-url http://127.0.0.1:4173 --output evidence/qa` writes structured pass/fail/unverified results and actual screenshots. Default target must be loopback; reject production targets without an explicit testing-mode override. Contact/chat/visitor writes are intercepted by clearly named test fixtures, never silently forwarded to production.

- [ ] **9.1 Write release tests before fixes.** Require no trailing markup after the document, a single valid canonical homepage, no fragment-only sitemap entries, CSP-compatible fallback, correct original branding/contact details and stage exclusion rules. Assert `npm run build` cannot deploy.
- [ ] **9.2 Run red:** `node --test test/release-contract.test.cjs`.
- [ ] **9.3 Repair metadata/fallback.** Use an appropriately sized social image derived from actual approved site assets, real text metadata and current copyright logic. Keep canonical `https://webzad.dev/`. Move fallback inline behavior to an external script, validate allowed anchor mappings and avoid open redirects. Preserve production CORS/domain rules; do not assume `_headers` automatically governs Function responses.
- [ ] **9.4 Run the browser matrix.** At 320/390/768/834/1440/1920px, visit and scroll through the entire page, open every project, verify all live links, test every CTA/service/menu/motion/chat control, and exercise success/error contact states through fixtures. Check keyboard-only paths, Tab/Shift+Tab/Escape, 200% text zoom, touch, reduced motion, missing fonts/WebGL, image/video failures and slow networks. Test Chromium plus Firefox/WebKit when available; label unavailable engines/real-device checks unverified, never passed.
- [ ] **9.5 Record visual/performance evidence.** Save real desktop 1440px, tablet 834px and mobile 390px full-page screenshots plus open chat/project views. Inspect them against the supplied references. Record console/page errors, failing network requests, horizontal overflow and actual layout-shift/resource observations. Verify no initial model request. Do not infer Core Web Vitals, real GPU frame rates or all-device performance from unit tests.
- [ ] **9.6 Run complete acceptance:** `npm test`, `node tools/check-portfolio.cjs`, `npm run build`, and the browser harness. Attempt a stage-only Cloudflare function compilation with an already authorized CLI (`npx --no-install wrangler pages functions build functions --outdir evidence/qa/functions-build`); a missing tool is an unmet compilation gate, not a reason to install/deploy silently. Compare the final source and original preservation manifest, explaining intentional changes and verifying immutable assets.
- [ ] **9.7 Package and document.** Deliver updated source ZIP, original-baseline reference/checksum, tested Windows launcher, real desktop/mobile screenshots, audit/change/dependency log, capture provenance, test outputs and remaining issues. Exclude secrets, local caches, Git internals and generated `.deploy` from the normal handoff ZIP. Document local API secrets by name only and separate run/stage commands from owner-approved deployment commands. A static HTML-only preview is not described as a working AI/backend preview.
- [ ] **9.8 Final review and commit:** `feat: complete verified Webzad redesign delivery`. Use the verification and code-review skills; absent an independent reviewer, disclose self-review rather than inventing independent approval. Do not label the release complete while any required real capture or browser/backend gate is unresolved.

## Task dependencies and stop conditions

Task 1 precedes implementation that exposes any preview. Task 2 can run alongside independent media, layout, Zada-startup and contact work; it must finish before the four-project release claim. Task 3 informs motion in Tasks 4–7. Task 5 supplies the portfolio API used in Task 7. Task 9 requires the preceding completed deliverables and records unmet provider/real-device gates explicitly.

Stop and report destructive source conflicts, an unexpected credential/data migration, environment-policy blocks, or unsupported live-site claims. Do not silently substitute a different architecture, another project, generated screenshots, fake provider success, or production deployment.

## Plan self-review / requirement coverage

| Approved-spec requirement | Owning tasks |
| --- | --- |
| Original source, data, backend and asset preservation | 1, 3, 6, 7, 8, 9 |
| Original logo and cinematic black/navy/cyan/violet direction | 3, 4, 9 |
| Hero, services, automation, process, contact and footer redesign | 3, 4, 8 |
| Four real sites, distinct screenshots, details and secure live links | 2, 5, 7 |
| Original design studies kept and not mislabeled as real launches | 4, 5, 7 |
| Zada chat, voice, model, prompts, safe actions and visitor behavior | 6, 7, 8, 9 |
| No invented claims, credentials or simulated production responses | 2, 4, 7, 8, 9 |
| Reduced motion, native scrolling, responsiveness, focus and fallback | 3, 4, 5, 6, 9 |
| Safe static hosting, CSP, staging and deployment boundaries | 1, 8, 9 |
| Tests, real screenshots, run instructions and truthful limitations | 1, 2, 9 |

All five Review Focus conditions have task-owned tests. Project IDs, field names and shared module interfaces are consistent across tasks. No portfolio screenshot export is currently accepted; no live Gemini/email test credentials are available. These are explicit verification gates, not placeholders for fabricated results.

## Technical references checked during planning

- Playwright screenshot file/buffer API: https://playwright.dev/python/docs/screenshots
- Native HTML dialog behavior and accessibility: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- Cloudflare Pages Functions routing: https://developers.cloudflare.com/pages/functions/routing/

These sources inform implementation mechanisms; the original source and approved specification define this project's requirements.

## Owner review and execution handoff

Recommended execution: direct implementation in this session, one tested task at a time, because the existing DOM contracts, assistant actions and dual server schemas are closely coupled. No subagent capability is assumed. This plan is ready for owner review; implementation starts after that review confirms the plan and execution method.
