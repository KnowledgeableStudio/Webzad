/**
 * server-gemini-tools.cjs - Declarations, system prompt, and formatting for Gemini AI tools.
 */

/** Helper to construct a Gemini function declaration schema object. */
const decl = (name, description, properties = {}, required) => ({
  name, description, parameters: { type: 'object', properties, ...(required ? { required } : {}) }
});

/** Whitelisted tool definitions for Zada website interaction. */
const TOOL_DEFINITIONS = [{ functionDeclarations: [
  decl('scrollToSection', 'Scroll to website section', { sectionId: { type: 'string', enum: ['hero', 'services', 'work', 'process', 'contact'] } }, ['sectionId']),
  decl('openProjectPreview', 'Open project preview lightbox', { projectId: { type: 'string', enum: ['growth', 'hospitality', 'services'] } }, ['projectId']),
  decl('prefillContactBrief', 'Prefill contact brief form', { serviceType: { type: 'string', enum: ['signature-website', 'landing-page', 'web-app', 'autonomous-business', 'custom-ai'] }, details: { type: 'string' } }),
  decl('toggleAudioOutput', 'Toggle audio voice output', { enabled: { type: 'boolean', description: 'Mute or enable voice' } }, ['enabled']),
  decl('openDevSettings', 'Open developer settings modal')
] }];

/** Authoritative system instruction persona for Zada companion. */
const SYSTEM_INSTRUCTION = 'You are Zada, an intelligent sci-fi 3D AI companion for Webzad (webzad.dev). Voice: Friendly, professional, concise, family-friendly. Services: Signature Websites, Landing Pages, Web Apps, Autonomous Business, Custom AI. Sections: hero, services, work, process, contact. Projects: growth, hospitality, services. Use tools when navigating, previewing projects, prefilling contact details, or toggling audio. Never auto-submit forms.';

/** Formats chat history into Gemini contents schema clamped to maxTurns. */
function formatGeminiContents(rawMessages, maxTurns = 20) {
  const list = Array.isArray(rawMessages) ? rawMessages : [{ role: 'user', content: String(rawMessages || '') }];
  return list.slice(-maxTurns).map(m => ({
    role: (m.role === 'model' || m.sender === 'zada' || m.role === 'assistant') ? 'model' : 'user',
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
  formatGeminiContents,
  extractGeminiResponse
};
