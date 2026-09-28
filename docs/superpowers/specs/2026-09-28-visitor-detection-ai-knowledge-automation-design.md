# Design Specification: Visitor Detection, Humanized AI Knowledge & Automation Services

- **Date:** 2026-09-28
- **Author:** Antigravity & Webzad Engineering
- **Status:** Approved by User

## 1. Overview & Business Objectives
Upgrade Webzad (webzad.dev) with four strategic enhancements:
1. **Visitor Detection & Email Notification Subsystem**: Detects incoming visitors on page load, captures client-side device/location telemetry while respecting privacy and Do Not Track, deduplicates sessions to prevent spamming, and dispatches an instant email notification to `knowledgablellc@gmail.com` via FormSubmit API.
2. **Humanized Conversational AI Engine**: Enhances Zada's speech and conversational intelligence to sound natural, intelligent, warm, and poised. Eliminates robotic cadence while maintaining clear transparency that Zada is an AI companion.
3. **Comprehensive Grounded Website Knowledge**: Integrates complete, audited business and service data across all Webzad offerings, workflow processes, case studies, and tailored scoping into the backend proxy and companion context.
4. **Automation Services Section & Visual Media**: Introduces a polished, compact section (`#automation`) in `index.html` detailing AI-powered automations, intelligent workflows, and custom integrations, accompanied by a custom sci-fi visual graphic.

---

## 2. Architecture & Subsystems

### 2.1 Visitor Detection & Email Notification
- **Client Module (`assets/js/zada-visitor.js`)**:
  - Automatically initializes when the page loads.
  - Checks `sessionStorage` (`webzad_visit_notified`) to ensure single notification per browsing session.
  - Checks `navigator.doNotTrack` (`1` or `'yes'`) to honor user privacy preferences.
  - Gathers non-PII environment metadata:
    - Device category: `Desktop`, `Mobile`, or `Tablet` (via screen width, userAgent hints, touch support).
    - Browser & OS: Friendly string (e.g. `Chrome on Windows 11`, `Safari on iOS`).
    - Screen resolution & viewport dimensions.
    - Referral source: `document.referrer` or URL search params (`utm_source`, `utm_medium`, etc.).
    - Visit timestamp and client timezone name.
    - Initial landing path / section.
  - Sends asynchronous non-blocking beacon to `/api/notify-visitor`.
- **Server Endpoint (`open-site-server.cjs` -> `/api/notify-visitor`)**:
  - Extracts IP from proxy headers (`x-forwarded-for`, `cf-connecting-ip`, or `socket.remoteAddress`).
  - Hashing: Hashes the client IP with a daily salt (e.g., `SHA-256(ip + salt)`). Raw IP is never logged or stored.
  - Deduplication: In-memory sliding-window cache with a 1-hour cooldown window per hashed visitor.
  - Geo-location: Extracts approximate location from standard proxy headers (`cf-ipcountry`, `cf-ipcity`, `cf-region`, `x-vercel-ip-country`, or local fallback).
  - Email Dispatch: Posts formatted alert to FormSubmit endpoint (`https://formsubmit.co/ajax/f11c4df9cac5fcb3a134c796bf5ee19c`) addressed to `knowledgablellc@gmail.com`.
  - Content formatted with readable subject: `🚀 New Webzad Visitor Alert [Device: Mobile/Desktop | Location: City, Country]`.

### 2.2 Conversational AI Persona & Multi-Turn Intelligence
- **Prompt Architecture (`server-gemini-tools.cjs`)**:
  - Persona: Zada, Webzad's advanced 3D AI companion and digital strategist.
  - Tone: Articulate, warm, conversational, professional, concise, family-friendly.
  - Natural sentence structure: Varied phrasing, thoughtful transition sentences, conversational pauses.
  - Multi-turn follow-up comprehension: Uses conversation history to maintain context for ambiguous pronouns ("that one", "how long does that take?", "what's the next step?").
  - Identity Rule: Never pretend to be a human, but act as an attentive and knowledgeable advisor for the studio.

### 2.3 Grounded Website Knowledge Base
- **Knowledge Core (`server-gemini-tools.cjs` & `assets/js/webzad-knowledge.js`)**:
  - **Philosophy & Positioning**: High-end boutique digital studio based in NYC serving clients worldwide. Philosophy: "Your business deserves a website that feels as serious as you are." Focus on credibility, differentiation, high conversion.
  - **7 Core Services**:
    1. Signature Websites: Custom marketing sites built to command industry authority.
    2. Landing Pages: High-conversion campaign/launch pages focused on single high-value action.
    3. E-Commerce: Elevated storefronts with streamlined checkout flows.
    4. Custom Web Apps: Bespoke portals, dashboards, and internal software tools.
    5. Branding & Graphics: Logos, typographic guidelines, digital asset systems.
    6. Website Redesigns: Transforming legacy websites into modern authority platforms.
    7. **Automation Services**: Intelligent workflows, AI agents, API integrations, repetitive task elimination, lead routing, autonomous operations.
  - **4-Step Process**: 01 Discovery -> 02 Strategy -> 03 Design & Build -> 04 Launch.
  - **Selected Work**: Professional Services (authority-driven), Hospitality & Lifestyle (immersive brand experience), Growth Campaigns (conversion-focused).
  - **Engagement & Next Steps**: Tailored scoping, 1 business day response time, direct email `knowledgablellc@gmail.com`, consultation form.
- **Tool Whitelist Expansion (`ZadaActionDispatcher`)**:
  - `scrollToSection`: adds `'automation'` to approved section list.
  - `prefillContactBrief`: adds `'ai-automation'` to approved service type list.

### 2.4 Automation Services Section & Visual Media
- **DOM Integration (`index.html`)**:
  - Position: Direct section `#automation` located between `#services` and `#work`.
  - Visual Card / Layout: 2-column split with responsive grid:
    - Left column: Eyebrow "Automation & AI", heading "Intelligent workflows that scale your business.", description explaining AI-powered automations, custom integrations, eliminating repetitive administrative toil, and autonomous business workflows. Feature pills: "AI-Powered Agents", "Workflow Automations", "System Integrations". Call to action: "Explore Automation" or "Start Project Brief".
    - Right column: Custom visual asset (`assets/automation-visual.png`) showcasing interconnected glowing data pipelines and circuit nodes in Webzad's cyan/purple aesthetic.
  - CSS in `assets/css/styles.css` / `index.html`: Responsive breakpoints for desktop, tablet, and mobile.
  - Nav update: `#automation` link added to desktop navigation and mobile drawer menu.

---

## 3. Global Constraints & Invariants
1. **Zero Regressions**: Existing navigation, hero video, 3D model rendering, lightbox, contact form submission, and tests remain 100% operational.
2. **Privacy First**: Respect `navigator.doNotTrack`; never log or leak raw IP addresses; no intrusive tracking cookies.
3. **Spam Prevention**: Strict 1-hour server-side cooldown per visitor + `sessionStorage` guard.
4. **Security Whitelist**: All actions mediated through `ZadaActionDispatcher` semantic enums. Form prefill NEVER auto-submits.
5. **Universal Compatibility**: Works across CommonJS, ES modules, and browser window environments.
