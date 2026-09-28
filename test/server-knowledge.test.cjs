const test = require('node:test');
const assert = require('node:assert/strict');
const { SYSTEM_INSTRUCTION, TOOL_DEFINITIONS, formatGeminiContents } = require('../server-gemini-tools.cjs');

test('Zada Humanized AI Persona & Website Knowledge Base', async (t) => {
  await t.test('SYSTEM_INSTRUCTION contains audited Webzad philosophy and identity', () => {
    assert.ok(SYSTEM_INSTRUCTION.includes('Webzad'));
    assert.ok(SYSTEM_INSTRUCTION.includes('NYC') || SYSTEM_INSTRUCTION.includes('New York'));
    assert.ok(SYSTEM_INSTRUCTION.includes('feels as serious as you are') || SYSTEM_INSTRUCTION.includes('trust you'));
  });

  await t.test('SYSTEM_INSTRUCTION contains all core services including automation', () => {
    const services = [
      'Signature Websites',
      'Landing Pages',
      'E-Commerce',
      'Custom Web Apps',
      'Branding & Graphics',
      'Website Redesigns',
      'Automation'
    ];
    for (const service of services) {
      assert.ok(
        SYSTEM_INSTRUCTION.toLowerCase().includes(service.toLowerCase()),
        `Knowledge base must cover service: ${service}`
      );
    }
  });

  await t.test('SYSTEM_INSTRUCTION details the 4-step process and client next steps', () => {
    assert.ok(SYSTEM_INSTRUCTION.includes('Discovery'));
    assert.ok(SYSTEM_INSTRUCTION.includes('Strategy'));
    assert.ok(SYSTEM_INSTRUCTION.includes('Design & Build') || SYSTEM_INSTRUCTION.includes('Design'));
    assert.ok(SYSTEM_INSTRUCTION.includes('Launch'));
    assert.ok(SYSTEM_INSTRUCTION.includes('knowledgablellc@gmail.com'));
    assert.ok(SYSTEM_INSTRUCTION.includes('one business day') || SYSTEM_INSTRUCTION.includes('1 business day'));
  });

  await t.test('SYSTEM_INSTRUCTION enforces human conversational style and AI identity rules', () => {
    const lower = SYSTEM_INSTRUCTION.toLowerCase();
    assert.ok(lower.includes('never pretend to be a human') || lower.includes('never claim to be human'));
    assert.ok(lower.includes('conversational') || lower.includes('natural'));
    assert.ok(lower.includes('concise'));
  });

  await t.test('formatGeminiContents formats multi-turn dialogue maintaining conversation context', () => {
    const history = [
      { role: 'user', content: 'What services do you offer?' },
      { role: 'model', content: 'We offer Signature Websites, Custom Web Apps, and AI Automations.' },
      { role: 'user', content: 'How does the automation work?' }
    ];
    const formatted = formatGeminiContents(history);
    assert.equal(formatted.length, 3);
    assert.equal(formatted[0].role, 'user');
    assert.equal(formatted[0].parts[0].text, 'What services do you offer?');
    assert.equal(formatted[1].role, 'model');
    assert.equal(formatted[2].role, 'user');
    assert.equal(formatted[2].parts[0].text, 'How does the automation work?');
  });
});
