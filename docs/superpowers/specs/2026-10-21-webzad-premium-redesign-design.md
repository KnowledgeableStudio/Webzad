# WEBZAD — premium redesign design specification

**Date:** 21 October 2026  
**Status:** Proposed design for owner review; not implemented.  
**Project:** Webzad only. This specification does not include any NXUS project.  
**Baseline:** The original uploaded Webzad source, not a replacement demo.

## 1. Intended outcome

Make Webzad immediately credible as a premium web, software, and AI automation studio. The site should communicate what can be built, demonstrate four real launched websites, and turn interest into an inquiry or a useful Zada conversation. The supplied references establish cinematic black/navy environments, precise cyan/violet light, bold readable typography, an orbiting-globe identity, and confident desktop/mobile composition.

The owner has authorized a substantial presentation redesign, while requiring preservation of the original Webzad logo, cinematic background concept, AI functionality/configuration/data, legitimate website content, and working backend. Production deployment and production-data changes are not authorized.

**Assumption for review:** retain a coherent, editorial single-page homepage with existing section anchors and accessible project-detail presentations. The multi-page reference images guide styling and content hierarchy; they do not require a framework or route migration.

## 2. Architecture options

**Recommended — preservation-first redesign in place.** Rebuild presentation in the existing HTML/CSS/JavaScript architecture. Keep the Node development server and Cloudflare APIs; keep Zada modules and their interfaces. Introduce focused presentation modules only where necessary. This reduces migration risk and makes before/after verification straightforward.

**Alternative — componentized static build.** A lightweight static generator could reduce future markup duplication if separate service pages become necessary. It adds a build tool, dependency maintenance, and deployment changes without currently solving a demonstrated requirement.

**Not recommended for this scope — React/Next.js rebuild.** A full migration would require rebinding the existing DOM-driven assistant, contact flow and production deployment. It is not necessary for the requested visuals and creates avoidable preservation risks.

The proposed direction is the first option. Do not install a library collection or replace working server services merely to modernize the stack.

## 3. Art direction: cinematic precision

Use an ink-black/navy base with luminous cyan and restrained electric violet. Maintain large areas of quiet space and sharp white typography. Accent lighting should establish depth, not surround every item with glow. Fine dividers, controlled glass surfaces and editorial numbering replace repetitive dashboard cards.

Keep the actual Webzad logo asset. Existing typography can be refined before adding new fonts. Large headings use tight but readable spacing; body copy remains comfortably sized. Never bake essential text into imagery.

Maintain the original branded cinematic video. Use a matching optimized still as its initial/reduced-motion state. Compose the hero so its globe and brand mark do not compete with the headline. Atmospheric lighting can extend through section transitions without multiple full-screen renderers.

Desktop content width: roughly 1280–1440 CSS pixels, with generous outer gutters. Mobile: 20–24 pixel gutters, content-led height, no viewport-locked text, and no horizontal page scrolling. Responsive breakpoints are chosen from actual content failures rather than device names alone.

The references' invented numerical claims, testimonials, and partner logos are not approved site content.

## 4. Homepage composition

### Header

Original logo and Webzad wordmark, primary links for Services, AI Automation, Selected Work, Process and Contact, plus one prominent Start a Project action. A visible but quiet motion toggle controls cinematic/procedural movement. Mobile navigation is a keyboard-accessible disclosure, not a decorative hamburger.

### Hero

Proposed headline:

**We don't just build websites. We build digital experiences.**

Supporting copy:

**Premium websites, intelligent AI automation, and custom software engineered to elevate ambitious brands.**

Use an asymmetric desktop composition: strong left-aligned typography and a spacious right-side view of the original globe environment. Add only subtle responsive depth to the visual; the hero must remain compelling without WebGL.

Primary action: **Explore My Work** → `#work`.  
Secondary action: **Start a Project** → `#contact`.  
Text action: **Explore AI Solutions** → `#automation`.

On narrow screens, lead with readable copy and full-width calls to action, followed by a proportioned visual rather than cropping an entire desktop screenshot. A restrained studio descriptor can state NYC-based / working worldwide, consistent with existing site content. No unverified “100+ projects” or revenue metrics.

### Selected work

Place the four actual websites early enough to substantiate the hero claim. Use an oversized editorial gallery, not four equal generic cards. Alternate image/copy alignment and scale, with generous breathing room and distinct project identities.

Each project includes a large real screenshot in a subtle browser frame, project number/name, verified industry description, a concise description, **View Project**, and **Visit Live Website ↗**. Perspective tilt is restrained, pointer-only, disabled for reduced motion and touch; text and screenshots remain readable.

Preserve the three legacy visual studies in a clearly labeled **Design studies** presentation, separate from launched work. Keep their existing AI-openable identifiers available for backward compatibility.

### Services

Present a concise visual capability system: custom websites/landing pages, e-commerce, web applications, AI automation, branding/graphics, and website redesigns. Preserve the original service offerings and backend-select values. Use purposeful diagrams, interface studies and existing suitable imagery as service illustrations; do not pass them off as real portfolio captures.

Each service action either opens meaningful details, navigates to the inquiry form with that service selected, or starts a relevant Zada conversation. No decorative buttons.

### AI automation

Make this section a controlled, dimensional composition with a clearly labeled workflow illustration and an integrated invitation to speak with Zada. Distinguish demonstrated website capabilities—conversation, navigation, project-preview actions, form prefill and voice—from bespoke integrations that must be scoped for each client.

Do not show a simulated live network, fabricated activity, guaranteed savings, or unconfigured CRM/payment integrations as operational facts.

### Process

Four connected stages—Discovery, Strategy, Design & Build, Launch—on a horizontal editorial timeline at wide sizes and a vertical sequence on mobile. Scroll reveals should clarify the sequence, not force visitors through excessive pinned scrolling.

### Contact

A premium split composition: concise invitation/direct contact and Zada access on one side; a clear, accessible project brief on the other. Preserve the existing form contract and real email address `knowledgablellc@gmail.com`. Retain explicit validation, honeypot, loading/error/success feedback, and server-side delivery.

Do not add a pretend scheduling button without a real booking destination. Do not promise customer confirmation email unless verified. Never submit a form automatically from an AI action.

### Footer

Original branding, useful navigation, legitimate contact details, Zada entry point and an accurate copyright display. Avoid unverified social links, partner marks and filler columns.

## 5. Real portfolio content and image provenance

Approved URLs and descriptions are limited to observed website content and the owner's statement that these are their projects:

1. **ZADDY.ART** — https://zaddy.art/ — Artist / music / merchandise. Showcase iZad Casanova's artist identity, music, story and Zaddy Collection.
2. **LA SOCIEDA RECORD** — https://www.lasociedarecord.com/ — Record label / entertainment. Showcase the label's artist roster, music catalog, videos and branding.
3. **1 OF 6 PRODUCTIONS** — https://1of6.productions/ — Video production / live events. Showcase the production company's event, concert and studio presentation.
4. **BRG OFFICIAL** — https://www.brgofficial.com/ — E-commerce / collectibles. Showcase the BRG plush collection's product-led presentation and shopping interface. Do not claim independently tested payments.

### Capture contract

Capture each actual public website in a real browser: a desktop homepage at approximately 1600×1000, a relevant secondary section, and a mobile view around 390×844 where reachable. Wait for actual fonts and visual assets, dismiss only ordinary overlays, and do not alter the site's content or inject fictitious screenshots.

Keep raw captures separately from optimized site assets. Record source URL, final URL, UTC capture time, viewport, device scale, image hash and any limitations in a provenance manifest. Store distinct project directories under `assets/portfolio/`. Produce responsive WebP/AVIF derivatives only when they preserve legibility. CSS can compose browser/device frames without distorting the screenshot.

The public site must not ship an empty, fabricated or mislabeled capture as completed work. A capture failure is a release blocker for that showcase, reported to the owner. Refreshed previews require a fresh browser capture and provenance update; do not silently scrape indefinitely or pretend a scheduled refresh service exists.

### Project details

Use accessible project-detail dialogs or equivalent navigable presentations. Include verified descriptions, multiple real captures, readable image captions, secure external links, a contact action, keyboard navigation, Escape-to-close, focus containment/restoration and mobile-safe internal scrolling. External links use `target="_blank"` with `rel="noopener noreferrer"`.

## 6. Zada preservation and integration contract

Keep the existing identity, model asset, state machine, voice behavior, model/provider interface, server-side instructions and knowledge, semantic action security, visitor notification workflow and all legitimate existing data/configuration. No replacement chatbot or canned success responses.

Mount the usable chat interface before heavyweight 3D work. Load the original 3D companion as a recoverable enhancement. Preserve its procedural motion, visibility handling, capped resolution and context-recovery behavior. Opening chat must not depend on downloading the full model.

Use the existing greeting, assistant portrait and recognizable styling, refined to match the site. Desktop presentation can be a compact dock/dialog; mobile should use an appropriately sized sheet with safe-area support, keyboard clearance and no clipped controls.

Add only validated new portfolio identifiers to the existing whitelist and both server tool schemas. Keep `growth`, `hospitality` and `services` working for legacy design studies. Preserve section IDs and contact field names. Any changes to knowledge are additive, based on verified project information, and accompanied by a reviewed diff and regression tests.

In-flight messages must not be lost when the user opens a project or moves between sections. Do not invent persistent chat storage: the baseline implementation uses in-memory chat state. Do not delete provider records or existing storage keys. Never expose server instructions or provider credentials to the browser.

A failed/missing AI provider should produce a truthful availability message, while navigation and contact still work. An online badge must not imply a verified provider connection when none has been established.

## 7. Performance and accessibility contract

Use progressive enhancement. Important content and links remain readable without animation or optional 3D. Keep the original media source files and introduce optimized derivatives with explicit image dimensions and responsive sources.

Animate mostly opacity and transforms. Avoid always-running offscreen loops, large animated shadows, duplicated renderers and full-page pointer-capture layers. Pause eligible visuals when offscreen or hidden. Cap drawing-buffer pixel count in addition to existing DPR rules. Support reduced motion and a user motion preference without erasing AI availability.

Performance goals, to be measured rather than claimed: no sustained horizontal overflow at 320/390/768/834/1440/1920 CSS pixels; no major image/layout shifts; no unnecessary 24 MB model download on first paint; no blocking visual effects on low-end phones. Target Core Web Vitals thresholds as release goals only after a suitable measurement setup exists.

All interactive controls must have semantic elements, accessible names, visible focus, clear state feedback, keyboard operation and adequate touch area. Native scrolling remains intact; no scroll hijacking. Screen-reader order follows the visible content hierarchy.

## 8. Security, deployment and error boundaries

Preserve server-side secrets, the production staging allowlist and Cloudflare middleware. Repair the development server's exposed internal paths before sharing a preview through any tunnel. Add boundary-safe path checks and tests for private files. Do not weaken CSP to accommodate new inline effects; use external modules and style files.

Keep the current API payloads compatible. Maintain validation/rate limits and add tests for both local and Cloudflare runtime behavior where practical. Optional Turnstile must remain disabled until the frontend challenge/token flow is actually integrated and verified. Production provider credentials remain in the hosting secret store, not in chat or source control.

A minimal `package.json` may expose `dev`, `test`, and stage-only `build` commands without introducing a framework. Preserve Windows launch convenience. Do not allow an ordinary build command to deploy. Document that Python/static preview cannot execute the existing AI/contact endpoints.

Production release remains a separate owner-approved action. The final handoff must include the updated project, recoverable original baseline, change/dependency record, configuration instructions, run/stage/deploy instructions, actual browser screenshots, test results and remaining limitations.

## 9. Acceptance gates

The finished implementation must demonstrate all of the following, not merely list them:

- Original logo/background sources retained, with verified derivatives and a coherent desktop/mobile result.
- Four distinct real-site showcases, provenance records, correct live URLs and working detail interactions.
- All original legitimate services, contact fields, direct contact and important navigation remain available.
- Zada chat, voice controls, streaming parsing, safe actions, visitor handling and model fallback remain connected to the original backend architecture.
- No AI/configuration/data reset, fabricated answers, invented project metrics or fake testimonials.
- Existing 163-test baseline remains passing; new tests cover the redesign's actual contracts and identified regressions.
- Browser testing covers navigation, dialogs, every CTA, contact states, keyboard operation, reduced motion, responsive overflow and console errors.
- Provider-dependent tests are clearly distinguished from mocks; real production requests/data changes are not performed without authorization.
- Staging excludes private files; no deployment occurs automatically.

## 10. Outstanding inputs and review

Real-browser access for screenshot capture and visual verification remains blocked in this session. TinyFish was offered for that capability. The current environment also lacks authorized Gemini/contact provider test credentials; production values must not be pasted into chat.

Review decision requested: approve the **preservation-first, cinematic editorial direction** and the single-page/anchor architecture described above. Implementation planning follows that review; this document is not a claim that the redesign has been built.
