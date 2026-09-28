/**
 * ZadaActionDispatcher - Semantic Action Whitelist & Security Gate for Zada AI Companion.
 * Enforces strict enum whitelist validation so AI tool calls can never execute
 * arbitrary DOM selectors, JavaScript, CSS, HTML, file paths, or shell commands.
 */

/**
 * Whitelist of approved target sections for navigation.
 * @readonly
 * @type {ReadonlyArray<string>}
 */
const APPROVED_SECTIONS = Object.freeze(['hero', 'services', 'work', 'process', 'contact']);

/**
 * Whitelist of approved project preview identifiers.
 * @readonly
 * @type {ReadonlyArray<string>}
 */
const APPROVED_PROJECTS = Object.freeze(['growth', 'hospitality', 'services']);

/**
 * Whitelist of approved service tier identifiers for contact prefill.
 * @readonly
 * @type {ReadonlyArray<string>}
 */
const APPROVED_SERVICES = Object.freeze([
  'signature-website', 'landing-page', 'web-app', 'autonomous-business', 'custom-ai'
]);

/**
 * Validates scrollToSection parameters against approved section IDs.
 * @param {Object} [params] - Action parameters.
 * @returns {{ valid: boolean, reason?: string, name?: string, sanitized?: Object }}
 */
function validateScrollToSection(params) {
  const sectionId = String(params?.sectionId || '').toLowerCase().trim();
  if (!APPROVED_SECTIONS.includes(sectionId)) {
    return { valid: false, reason: `Unapproved section: ${sectionId}` };
  }
  return { valid: true, name: 'scrollToSection', sanitized: { sectionId } };
}

/**
 * Validates openProjectPreview parameters against approved project IDs.
 * @param {Object} [params] - Action parameters.
 * @returns {{ valid: boolean, reason?: string, name?: string, sanitized?: Object }}
 */
function validateOpenProjectPreview(params) {
  const projectId = String(params?.projectId || '').toLowerCase().trim();
  if (!APPROVED_PROJECTS.includes(projectId)) {
    return { valid: false, reason: `Unapproved project preview: ${projectId}` };
  }
  return { valid: true, name: 'openProjectPreview', sanitized: { projectId } };
}

/**
 * Validates prefillContactBrief parameters, strips HTML, and clamps message length.
 * Form submission is strictly never triggered here.
 * @param {Object} [params] - Action parameters.
 * @returns {{ valid: boolean, reason?: string, name?: string, sanitized?: Object }}
 */
function validatePrefillContactBrief(params) {
  const serviceType = String(params?.serviceType || '').toLowerCase().trim();
  if (serviceType && !APPROVED_SERVICES.includes(serviceType)) {
    return { valid: false, reason: `Unapproved service type: ${serviceType}` };
  }

  // Strip potential script or HTML tags and limit length to prevent prompt injection or UI overflow
  const rawDetails = String(params?.details || '');
  const sanitizedDetails = rawDetails.replace(/<[^>]*>?/gm, '').slice(0, 500);

  return {
    valid: true,
    name: 'prefillContactBrief',
    sanitized: {
      serviceType: serviceType || 'signature-website',
      details: sanitizedDetails
    }
  };
}

/**
 * Validates toggleAudioOutput boolean parameter.
 * @param {Object} [params] - Action parameters.
 * @returns {{ valid: boolean, name: string, sanitized: { enabled: boolean } }}
 */
function validateToggleAudioOutput(params) {
  return {
    valid: true,
    name: 'toggleAudioOutput',
    sanitized: { enabled: Boolean(params?.enabled) }
  };
}

/**
 * Validates openDevSettings parameters.
 * @returns {{ valid: boolean, name: string, sanitized: Object }}
 */
function validateOpenDevSettings() {
  return { valid: true, name: 'openDevSettings', sanitized: {} };
}

/**
 * Security Dispatcher for semantic AI actions.
 */
class ZadaActionDispatcher {
  /**
   * @param {Object<string, Function>} [handlers={}] - Action handler map.
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
  }

  /**
   * Validates and sanitizes an action call against the strict semantic whitelist.
   * @param {Object} call - Raw action call from AI tool invocation.
   * @returns {{ valid: boolean, reason?: string, name?: string, sanitized?: Object }}
   */
  validateAction(call) {
    if (!call || typeof call !== 'object' || typeof call.name !== 'string') {
      return { valid: false, reason: 'Malformed action object' };
    }

    const { name } = call;
    const params = (call.params && typeof call.params === 'object') ? call.params : {};

    switch (name) {
      case 'scrollToSection':
        return validateScrollToSection(params);
      case 'openProjectPreview':
        return validateOpenProjectPreview(params);
      case 'prefillContactBrief':
        return validatePrefillContactBrief(params);
      case 'toggleAudioOutput':
        return validateToggleAudioOutput(params);
      case 'openDevSettings':
        return validateOpenDevSettings();
      default:
        return { valid: false, reason: `Forbidden or unknown action: ${name}` };
    }
  }

  /**
   * Executes a whitelisted action through registered handlers after validation.
   * @param {Object} actionCall - Action invocation request.
   * @returns {Promise<*>} Handler result or default acknowledgment.
   * @throws {Error} If action fails validation.
   */
  async dispatch(actionCall) {
    const validated = this.validateAction(actionCall);
    if (!validated.valid) {
      throw new Error(`Action rejected by security gate: ${validated.reason}`);
    }

    const handler = this.handlers[validated.name];
    if (typeof handler === 'function') {
      return await handler(validated.sanitized);
    }

    return {
      status: 'acknowledged',
      action: validated.name,
      params: validated.sanitized
    };
  }
}

// Universal module export for CommonJS, Browser Window, and global environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ZadaActionDispatcher,
    APPROVED_SECTIONS,
    APPROVED_PROJECTS,
    APPROVED_SERVICES
  };
}
if (typeof window !== 'undefined') {
  window.ZadaActionDispatcher = ZadaActionDispatcher;
  window.APPROVED_SECTIONS = APPROVED_SECTIONS;
  window.APPROVED_PROJECTS = APPROVED_PROJECTS;
  window.APPROVED_SERVICES = APPROVED_SERVICES;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ZadaActionDispatcher = ZadaActionDispatcher;
  globalThis.APPROVED_SECTIONS = APPROVED_SECTIONS;
  globalThis.APPROVED_PROJECTS = APPROVED_PROJECTS;
  globalThis.APPROVED_SERVICES = APPROVED_SERVICES;
}
