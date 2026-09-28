# Visitor Detection, Humanized AI Knowledge & Automation Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Webzad with privacy-respecting visitor detection & email notification, a natural humanized AI conversation persona, comprehensive grounded website knowledge, and an Automation Services section with custom visual media.

**Architecture:** A client-side non-PII telemetry beacon (`assets/js/zada-visitor.js`) connects to a deduplicating, IP-hashing server endpoint (`/api/notify-visitor` in `open-site-server.cjs`) that sends alerts to `knowledgablellc@gmail.com` via FormSubmit. The Gemini companion backend (`server-gemini-tools.cjs`) is upgraded with an audited Webzad knowledge graph and conversational guidelines. A new `#automation` section is integrated into `index.html` with responsive CSS and a custom futuristic sci-fi workflow graphic.

**Tech Stack:** Node.js, CommonJS/ESM, Three.js, Gemini API, FormSubmit API, HTML5/CSS3.

**Spec:** `docs/superpowers/specs/2026-09-28-visitor-detection-ai-knowledge-automation-design.md`

## Global Constraints
- Target recipient email: `knowledgablellc@gmail.com`.
- Email delivery via FormSubmit hash `f11c4df9cac5fcb3a134c796bf5ee19c`.
- Privacy: Never store or log raw IP addresses; hash with daily salt; respect `navigator.doNotTrack`.
- Deduplication: 1-hour cooldown window per visitor on server + `sessionStorage` token on client.
- Security: Action whitelist gate (`ZadaActionDispatcher`) remains enforced; `prefillContactBrief` must NEVER auto-submit.
- Existing site integrity: Zero regressions to navigation, hero video, 3D companion rendering, lightbox, contact form, or existing 155 unit tests.

---

### Task 1: Semantic Whitelist Update for Automation (`ZadaActionDispatcher` & Tools)

**Files:**
- Modify: `assets/js/zada-actions.js`
- Modify: `server-gemini-tools.cjs`
- Modify: `test/zada-actions.test.cjs`

**Interfaces:**
- Consumes: `ZadaActionDispatcher`
- Produces: Whitelisted section `'automation'` and service type `'ai-automation'`

- [x] **Step 1: Write test for new whitelist values in `test/zada-actions.test.cjs`**
- [x] **Step 2: Run test and verify it fails (RED)**
- [x] **Step 3: Update `assets/js/zada-actions.js` and `server-gemini-tools.cjs`**
- [x] **Step 4: Run tests and verify they pass (GREEN)**
- [x] **Step 5: Commit changes**

---

### Task 2: Backend Visitor Notification Endpoint (`/api/notify-visitor`)

**Files:**
- Modify: `open-site-server.cjs`
- Create: `test/server-visitor.test.cjs`

**Interfaces:**
- Consumes: HTTP POST request with client metadata
- Produces: `POST /api/notify-visitor` returning `{ success: true, notified: boolean }`

- [x] **Step 1: Write integration tests in `test/server-visitor.test.cjs`**
- [x] **Step 2: Run test and verify it fails (RED)**
- [x] **Step 3: Implement IP hashing, deduplication store, and FormSubmit dispatcher in `open-site-server.cjs`**
- [x] **Step 4: Run tests and verify they pass (GREEN)**
- [x] **Step 5: Commit changes**

---

### Task 3: Client-Side Visitor Tracker (`assets/js/zada-visitor.js` & `index.html`)

**Files:**
- Create: `assets/js/zada-visitor.js`
- Create: `test/zada-visitor.test.cjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: Browser DOM, `window.navigator`, `sessionStorage`
- Produces: `ZadaVisitorTracker.init()` auto-detecting and reporting new visits

- [x] **Step 1: Write unit tests in `test/zada-visitor.test.cjs`**
- [x] **Step 2: Run test and verify it fails (RED)**
- [x] **Step 3: Implement `assets/js/zada-visitor.js`**
- [x] **Step 4: Run tests and verify they pass (GREEN)**
- [x] **Step 5: Include script in `index.html`**
- [x] **Step 6: Commit changes**

---

### Task 4: Conversational AI Persona & Website Knowledge Base

**Files:**
- Modify: `server-gemini-tools.cjs`
- Create: `test/server-knowledge.test.cjs`

**Interfaces:**
- Consumes: Gemini API chat messages
- Produces: Natural, warm, conversational system instruction loaded with comprehensive Webzad knowledge

- [x] **Step 1: Write tests for knowledge coverage and prompt format in `test/server-knowledge.test.cjs`**
- [x] **Step 2: Run test and verify it fails (RED)**
- [x] **Step 3: Update `server-gemini-tools.cjs` with natural persona guidelines and complete Webzad service/process knowledge**
- [x] **Step 4: Run tests and verify they pass (GREEN)**
- [x] **Step 5: Commit changes**

---

### Task 5: Automation Services Section & Visual Media

**Files:**
- Create: `assets/automation-visual.jpg`
- Modify: `index.html`

**Interfaces:**
- Consumes: Webzad CSS theme (`--bg`, `--cyan`, `--magenta`, `--surface`)
- Produces: Responsive `#automation` section and updated navigation links

- [x] **Step 1: Generate or author `assets/automation-visual.jpg`**
- [x] **Step 2: Add `#automation` section to `index.html` with responsive styles and copy**
- [x] **Step 3: Add `Automation` nav links to desktop header and mobile drawer**
- [x] **Step 4: Update `SECTION_PROMPTS` in `assets/js/zada.js` with automation quick-prompts**
- [x] **Step 5: Commit changes**

---

### Task 6: Full Suite Verification & Quality Gate

**Files:**
- Test: All `test/*.test.cjs` files

- [x] **Step 1: Run full test suite (`node --test test/*.test.cjs`)**
- [x] **Step 2: Verify server response and check for regressions**
- [x] **Step 3: Commit and summarize completed deliverables**
