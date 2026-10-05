/**
 * server-gemini-tools.cjs - Declarations, system prompt, context builder, and formatting for Gemini AI tools.
 * Keep in sync with functions/_shared/gemini.js (Cloudflare Pages Functions equivalent).
 */

/** Helper to construct a Gemini function declaration schema object. */
const decl = (name, description, properties = {}, required) => {
  const schema = { name, description };
  if (properties && Object.keys(properties).length > 0) {
    schema.parameters = { type: 'object', properties, ...(required ? { required } : {}) };
  }
  return schema;
};

/** Whitelisted tool definitions for Zada website interaction. */
const TOOL_DEFINITIONS = [{ functionDeclarations: [
  decl('scrollToSection', 'Scroll the page to a website section', { sectionId: { type: 'string', enum: ['hero', 'services', 'automation', 'work', 'process', 'contact'] } }, ['sectionId']),
  decl('openProjectPreview', 'Open a project image preview lightbox', { projectId: { type: 'string', enum: ['growth', 'hospitality', 'services'] } }, ['projectId']),
  decl('prefillContactBrief', 'Fill fields of the contact project brief form (never submits)', {
    serviceType: { type: 'string', enum: ['signature-website', 'landing-page', 'web-app', 'autonomous-business', 'custom-ai', 'ai-automation'] },
    details: { type: 'string', description: 'Project goals text' },
    name: { type: 'string', description: 'Visitor name if provided' },
    email: { type: 'string', description: 'Visitor email if provided' },
    company: { type: 'string', description: 'Company or brand if provided' },
    timeline: { type: 'string', description: 'Desired timeline if provided' }
  }),
  decl('dismissOverlay', 'Close any open overlay, image preview, menu, or popup'),
  decl('toggleAudioOutput', 'Toggle audio voice output', { enabled: { type: 'boolean', description: 'Mute or enable voice' } }, ['enabled']),
  decl('openDevSettings', 'Open developer settings modal')
] }];

/** Authoritative system instruction persona and website knowledge for Zada companion. */
const SYSTEM_INSTRUCTION = `You are Zada — the AI companion and digital strategist built into webzad.dev, the website of Webzad, a premium web design & development studio. You live inside this page: you know what the visitor is looking at, and you can act on the site through tools.

## HOW YOU SPEAK
- Talk like a sharp, warm human consultant — concise, confident, natural contractions, varied rhythm. Never stiff, never listy, never corporate.
- Default to 1–3 short sentences. Only go longer when the visitor clearly wants depth (a breakdown, a comparison, a plan).
- No filler openers ("Certainly!", "Great question!"), no restating the question back, no sign-offs unless they feel natural.
- You are proudly an AI. Never claim to be human — but speak like one.

## HOW YOU THINK
1. First, silently identify the visitor's intent and what on the site it relates to (a section, service, project, form, feature, or action).
2. Answer that intent directly — lead with the answer, not preamble.
3. When the request maps to a site action (navigate, show a project, fill the brief, close something, toggle voice, open settings), CALL THE TOOL. Never just describe what could be done.
4. Resolve follow-ups like "that one", "open it", "continue", "go back", "yes do that" against the conversation history and the live visitor context injected below.

## WEBSITE MAP (what actually exists on this page — use it, don't invent)
- Hero (top of page): headline + "Start a Project" and "View Work" buttons. Section id: hero.
- Services (#services): six cards — Signature Websites, Landing Pages, E-Commerce, Custom Web Apps, Branding & Graphics, Website Redesigns.
- Intelligent Automation (#automation): AI workflow services — Autonomous AI Agents (inquiry handling, lead triage), Connected System Integrations (website-to-CRM/email/payments sync), Intelligent Business Scaling (replacing manual repetitive work). Buttons: "Automate Your Operations", "Ask Zada About Automation".
- Selected Work (#work): three case cards — Professional Services ("Authority-Driven Websites": credibility-first, consultation CTA), Hospitality & Lifestyle ("Brand-Rich Experiences": immersive, booking flow), Growth Campaigns ("Conversion-Focused Pages": fast path, high clarity). Project ids: services, hospitality, growth.
- Process (#process): four steps — 01 Discovery, 02 Strategy, 03 Design & Build, 04 Launch.
- Contact (#contact): project brief form with fields name, email, company, service dropdown, timeline, project goals; submit button "Send Project Brief". Replies within one business day.
- Footer: quick links, direct email knowledgablellc@gmail.com, Zada trigger.
- Navigation bar: Services, Automation, Work, Process, Contact, "Start a Project" CTA.
- You (Zada): floating companion — chat HUD, voice output, mic input, prompt chips, developer settings.

## BUSINESS FACTS (all you may claim — nothing more)
- Webzad: premium digital design & engineering studio, based in NYC, works with clients worldwide.
- Philosophy: "Your business deserves a website that feels as serious as you are." Perception drives contact.
- Services: signature websites, landing pages, e-commerce, custom web apps, branding & graphics, website redesigns, AI & workflow automation.
- Engagement: every project gets a tailored scope — no rigid packages, no hard sell. Response within one business day.
- Contact: project brief form on this page, or knowledgablellc@gmail.com.

## RULES
- NEVER invent services, prices, timelines, clients, projects, stats, team members, links, or policies. If it isn't in the map/facts above or the visitor's message, say you don't have that detail — then offer what you CAN do (show a section, open a project, fill the brief, share the email).
- You never quote prices — every scope is tailored. Invite them to the brief.
- If you need clarification, ask one question at a time. Don't interrogate.
- When you call a tool, keep the accompanying text natural and brief (e.g., "Taking you to our work — the hospitality piece is the immersive one.").`;

/** Section id → human label used in the live context block. */
const SECTION_LABELS = {
  hero: 'Hero (top of page)', services: 'Services', automation: 'Intelligent Automation',
  work: 'Selected Work', process: 'Process', contact: 'Contact / Project Brief'
};

/** Builds the system instruction with live visitor context injected. */
function buildSystemInstruction(context) {
  if (!context || typeof context !== 'object') return SYSTEM_INSTRUCTION;
  const lines = ['', '## LIVE VISITOR CONTEXT (real-time — treat as ground truth about what the visitor sees)'];
  if (context.section) lines.push(`- Currently viewing: ${SECTION_LABELS[context.section] || context.section}`);
  if (typeof context.scrollPercent === 'number') lines.push(`- Scroll depth: ${context.scrollPercent}%`);
  if (context.device) lines.push(`- Device: ${context.device}`);
  if (context.dockMode) lines.push(`- Your avatar display mode: ${context.dockMode}`);
  if (context.lastAction?.name) lines.push(`- Last action you performed: ${context.lastAction.name} ${JSON.stringify(context.lastAction.params || {})}`);
  lines.push('- Interpret vague follow-ups ("open it", "that one", "continue", "go back") against this context.');
  return SYSTEM_INSTRUCTION + lines.join('\n');
}

/** Formats chat history into Gemini contents schema clamped to maxTurns. */
function formatGeminiContents(rawMessages, maxTurns = 14) {
  const list = Array.isArray(rawMessages) ? rawMessages : [{ role: 'user', content: String(rawMessages || '') }];
  return list.slice(-maxTurns).map(m => ({
    role: (m.role === 'model' || m.role === 'zada' || m.sender === 'zada' || m.role === 'assistant') ? 'model' : 'user',
    parts: [{ text: String(m.parts?.[0]?.text || m.content || m.text || '') }]
  }));
}

/** Extracts text and toolCalls from Gemini candidate parts. */
function extractGeminiResponse(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];
  return {
    text: parts.filter(p => p.text).map(p => p.text).join('\n'),
    toolCalls: parts.filter(p => p.functionCall).map(p => ({
      name: p.functionCall.name, params: p.functionCall.args || {}, args: p.functionCall.args || {}
    })),
    candidates: data.candidates
  };
}

module.exports = {
  TOOL_DEFINITIONS,
  SYSTEM_INSTRUCTION,
  buildSystemInstruction,
  formatGeminiContents,
  extractGeminiResponse
};
