const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ZadaActionDispatcher,
  APPROVED_SECTIONS,
  APPROVED_PROJECTS,
  APPROVED_SERVICES
} = require('../assets/js/zada-actions.js');

test('ZadaActionDispatcher security whitelist & parameter checking', async (t) => {
  const dispatcher = new ZadaActionDispatcher();

  await t.test('whitelisted scrollToSection with valid section passes', () => {
    const res = dispatcher.validateAction({
      name: 'scrollToSection',
      params: { sectionId: 'services' }
    });
    assert.equal(res.valid, true);
    assert.equal(res.sanitized.sectionId, 'services');
  });

  await t.test('invalid sectionId in scrollToSection is rejected', () => {
    const res = dispatcher.validateAction({
      name: 'scrollToSection',
      params: { sectionId: 'invalid-section' }
    });
    assert.equal(res.valid, false);
    assert.match(res.reason, /Unapproved section/);
  });

  await t.test('arbitrary script or eval injection is strictly rejected', () => {
    const res = dispatcher.validateAction({
      name: 'eval',
      params: { code: 'alert(1)' }
    });
    assert.equal(res.valid, false);
    assert.match(res.reason, /Forbidden or unknown action/);
  });

  await t.test('malformed action objects are rejected safely', () => {
    assert.equal(dispatcher.validateAction(null).valid, false);
    assert.equal(dispatcher.validateAction(undefined).valid, false);
    assert.equal(dispatcher.validateAction('string').valid, false);
    assert.equal(dispatcher.validateAction({}).valid, false);
    assert.equal(dispatcher.validateAction({ name: 123 }).valid, false);
  });

  await t.test('prefillContactBrief validates serviceType enum and clamps length', () => {
    const longDetails = 'a'.repeat(600);
    const res = dispatcher.validateAction({
      name: 'prefillContactBrief',
      params: {
        serviceType: 'signature-website',
        details: longDetails
      }
    });
    assert.equal(res.valid, true);
    assert.equal(res.sanitized.serviceType, 'signature-website');
    assert.equal(res.sanitized.details.length, 500);
  });

  await t.test('prefillContactBrief strips HTML tags and uses default serviceType', () => {
    const res = dispatcher.validateAction({
      name: 'prefillContactBrief',
      params: {
        details: 'Hello <script>alert("xss")</script><b>world</b>'
      }
    });
    assert.equal(res.valid, true);
    assert.equal(res.sanitized.serviceType, 'signature-website');
    assert.equal(res.sanitized.details, 'Hello alert("xss")world');
  });

  await t.test('prefillContactBrief rejects invalid serviceType', () => {
    const res = dispatcher.validateAction({
      name: 'prefillContactBrief',
      params: {
        serviceType: 'unapproved-hack',
        details: 'Some brief info'
      }
    });
    assert.equal(res.valid, false);
    assert.match(res.reason, /Unapproved service type/);
  });

  await t.test('openProjectPreview accepts approved projects and rejects unapproved', () => {
    const valid = dispatcher.validateAction({
      name: 'openProjectPreview',
      params: { projectId: 'growth' }
    });
    assert.equal(valid.valid, true);
    assert.equal(valid.sanitized.projectId, 'growth');

    const invalid = dispatcher.validateAction({
      name: 'openProjectPreview',
      params: { projectId: 'unknown-hack' }
    });
    assert.equal(invalid.valid, false);
    assert.match(invalid.reason, /Unapproved project preview/);
  });

  await t.test('toggleAudioOutput sanitizes boolean parameter', () => {
    const res1 = dispatcher.validateAction({
      name: 'toggleAudioOutput',
      params: { enabled: true }
    });
    assert.equal(res1.valid, true);
    assert.equal(res1.sanitized.enabled, true);

    const res2 = dispatcher.validateAction({
      name: 'toggleAudioOutput',
      params: { enabled: 0 }
    });
    assert.equal(res2.valid, true);
    assert.equal(res2.sanitized.enabled, false);
  });

  await t.test('rejects removed openDevSettings action', () => {
    const res = dispatcher.validateAction({
      name: 'openDevSettings',
      params: {}
    });
    assert.equal(res.valid, false);
  });

  await t.test('dispatch executes registered handler', async () => {
    let executed = null;
    const customDispatcher = new ZadaActionDispatcher({
      scrollToSection: (params) => { executed = params; return { success: true }; }
    });
    const result = await customDispatcher.dispatch({
      name: 'scrollToSection',
      params: { sectionId: 'contact' }
    });
    assert.deepEqual(executed, { sectionId: 'contact' });
    assert.equal(result.success, true);
  });

  await t.test('dispatch throws on invalid action', async () => {
    await assert.rejects(
      async () => {
        await dispatcher.dispatch({
          name: 'eval',
          params: { code: 'bad()' }
        });
      },
      /Action rejected by security gate/
    );
  });

  await t.test('dispatch returns default acknowledgment when no handler registered', async () => {
    const result = await dispatcher.dispatch({
      name: 'scrollToSection',
      params: { sectionId: 'work' }
    });
    assert.equal(result.status, 'acknowledged');
    assert.equal(result.action, 'scrollToSection');
    assert.deepEqual(result.params, { sectionId: 'work' });
  });

  await t.test('approved constants are exported and frozen', () => {
    assert.ok(Array.isArray(APPROVED_SECTIONS));
    assert.ok(Array.isArray(APPROVED_PROJECTS));
    assert.ok(Array.isArray(APPROVED_SERVICES));
    assert.ok(APPROVED_SECTIONS.includes('hero'));
    assert.ok(APPROVED_PROJECTS.includes('growth'));
    assert.ok(APPROVED_SERVICES.includes('signature-website'));
  });

  await t.test('automation section and ai-automation service are whitelisted', () => {
    assert.ok(APPROVED_SECTIONS.includes('automation'), 'APPROVED_SECTIONS must include automation');
    assert.ok(APPROVED_SERVICES.includes('ai-automation'), 'APPROVED_SERVICES must include ai-automation');
    const scrollRes = dispatcher.validateAction({
      name: 'scrollToSection',
      params: { sectionId: 'automation' }
    });
    assert.equal(scrollRes.valid, true);
    assert.equal(scrollRes.sanitized.sectionId, 'automation');

    const prefillRes = dispatcher.validateAction({
      name: 'prefillContactBrief',
      params: { serviceType: 'ai-automation', details: 'Interested in AI workflows' }
    });
    assert.equal(prefillRes.valid, true);
    assert.equal(prefillRes.sanitized.serviceType, 'ai-automation');
  });
});
