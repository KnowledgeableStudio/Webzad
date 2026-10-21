# Webzad implementation self-review

Date: 21 October 2026. Reviewer: implementation author; **no independent code review was available**. Review covered the approved preservation-first specification, plan, changed source, original-source hashes, original/new tests and actual offline Chromium renders. The plugin's supplementary reviewer template was not exposed; no reviewer agent or independent sign-off is claimed.

## Required review focus and evidence

| Risk | Review result |
| --- | --- |
| Slow/failed WebGL blocks Zada | UI mounts before vendor/model loading; startup regression tests cover renderer failure, single initialization, cancellation and message retention. Offline browser opens the actual chat dialog without an initial model. Real GLTF rendering still requires HTTP/browser validation. |
| Missing or mislabeled screenshots | Four exact projects and separate legacy studies; the public manifest remains pending. PNG/hash/provenance gate rejects missing captures. Deployment gate remains blocked. No actual capture image is claimed. |
| Multiple overlays and keyboard access | Native project/chat dialogs retain messages and respect top-overlay Escape/focus restoration in Chromium owned-document tests. Mobile menu and form feedback tested. Actual browser/text zoom and mobile keyboard geometry remain unverified. |
| Motion/storage/device restrictions | Shared policy handles reduced motion, user pause, hidden page and data saving. A throwing sessionStorage getter found by browser QA was fixed and regression tested. Original visitor key and behavior retained. |
| Private static files and hanging providers | Public allowlist/real-path/symlink checks tested over real local HTTP. Missing assets give 404. Local contact provider receives a bounded timeout; Cloudflare bodies enforce streamed byte count. Real provider delivery remains unverified. |

## Findings addressed during final review

1. **Important — denied session storage crashed visitor initialization.** A getter can throw even in a `typeof` expression. Access is now guarded and falls back to no storage. Red/green regression logs retained.
2. **Important — raw capture provenance was insufficiently enforced.** Added a red/green regression and equality validation for the original PNG SHA-256. Integrity verification still does not replace human review of image content.
3. **Test-maintenance defect — release test assumed the current gallery always remains incomplete.** It now uses an isolated missing-capture fixture, so genuine future captures do not make the test suite fail.
4. **Presentation integration — gallery capture caption selector and image cache refresh.** Corrected the caption target and added hash-based image URL versioning. Canonical and www forms of the same approved project host are accepted consistently.
5. **QA method defect — full-page screenshots did not trigger below-fold lazy images.** The harness now scrolls normally through the document, verifies loaded illustrations, and returns to the hero before capturing. Production lazy loading was not removed.
6. **QA method defect — CSS `zoom:2` was treated as browser zoom.** It does not change CSS media-query viewport dimensions in the way browser zoom does. That misleading proxy was removed; a real 720-CSS-pixel / DPR-2 layout check passes. Actual browser zoom and text-only scaling remain explicit open checks.

## Outstanding release risks / no sign-off

Real portfolio captures, live-provider testing, actual HTTP browser/CSP/media/WebGL checks, Cloudflare compilation, physical-device/other-engine testing and the full Windows capture/launcher workflow remain open. No production-readiness, universal security, GPU smoothness, Core Web Vitals or independent-review claim is made. Keep the branch and source package as a review build; do not merge or deploy automatically.
