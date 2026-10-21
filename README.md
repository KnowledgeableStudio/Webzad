# Webzad — implemented premium redesign / review build

This is the existing Webzad HTML/CSS/JavaScript website, original Zada companion, Node server and Cloudflare Pages Functions, redesigned in place. It is not a replacement chatbot or a disconnected visual demo.

**Release status:** implemented and locally testable, **not production-approved**. The four portfolio entries, details and live links work, but actual screenshots of those websites remain uncaptured because this environment blocked browser navigation. Missing captures are explicitly labeled, never replaced by stock/generated images. Live Gemini/email credentials were not supplied. Read `docs/REDESIGN-DELIVERY.md` for verified results and remaining gates.

## See the website on your Windows PC

1. Extract the entire ZIP to a **new folder**, keeping your existing project and private configuration safe.
2. Open the extracted folder containing `index.html` and `RUN-WEBZAD.cmd`.
3. Double-click `RUN-WEBZAD.cmd`. Keep its command window open.

Node.js **22.16.0 or newer** is required. There are no website runtime packages to install. The launcher opens your browser only after the server is listening. The default address is `http://127.0.0.1:4173/` **on your PC**, not the chat environment.

From a terminal in the extracted project folder:

```bat
npm start
```

`npm start` opens the browser. `npm run dev` starts the same server without opening it. A busy port is reported without killing another program. For another port in Command Prompt, run `set PORT=4174` before starting. Stop the server with Ctrl+C.

Do not double-click `index.html` for an AI/backend test: a `file://` page or a Python static server cannot execute these APIs. Do not overwrite your original folder or `.env` as an installation shortcut.

## Obtain the actual portfolio screenshots

The four exact destinations are configured in the supplied capture tools. They use an anonymous, temporary browser profile, preserve the actual website content, and do not log in, submit forms, purchase anything, or deploy Webzad.

**Windows / no additional Node packages:** double-click `CAPTURE-PORTFOLIO.cmd`. It uses an installed Chrome or Edge and Node 22.16+. This complete Windows workflow must still be tested on your PC; only its isolated logic and protocol transport were tested here.

CLI equivalent:

```bat
node tools\capture-portfolio.cjs
```

To refresh one site:

```bat
node tools\capture-portfolio.cjs --project zaddy
```

Valid project identifiers: `zaddy`, `la-socieda`, `one-of-six`, `brg`, or `all`. Set `WEBZAD_CAPTURE_BROWSER` to your browser executable when automatic discovery cannot find it. Existing browser/security policies are not changed.

The tool attempts desktop, an additional section, and mobile captures. It saves raw PNGs under `evidence/portfolio/raw/`, public PNG/WebP files under each `assets/portfolio/<id>/` directory, and provenance in `assets/portfolio/manifest.json`. The website reads that manifest and replaces the explicit pending notices only with accepted captures. Source URLs, viewport dimensions, timestamps and hashes are recorded. Inspect every image before publishing: a matching hash and successful page response do not prove that a cookie dialog or incomplete animation did not obscure content.

```bat
npm run check:portfolio
```

This command **currently fails intentionally** because captures are missing. It must pass after all four genuine capture sets exist. A manual refresh is supplied; no unattended refresh service or schedule has been installed.

Alternative Python capture tooling (development only):

```bat
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tools\capture_portfolio.py --project all --output evidence/portfolio/raw
```

These commands install development tooling on the machine where you run them. They are not required to run Webzad. Do not attempt to override organization browser restrictions.

## Preserve your backend configuration

For local use, configure a private `.env` beside `open-site-server.cjs` with your existing authorized settings:

- `GEMINI_API_KEY` and optional `GEMINI_MODEL` for Zada.
- `WEB3FORMS_ACCESS_KEY` for the existing contact/visitor provider.
- Optional production `TURNSTILE_SECRET_KEY` and `RATE_LIMITER` are not newly enabled. Do not enable Turnstile until its complete frontend token flow has been integrated and tested.

Only variable names are documented. Never paste secrets into chat, commit them, place them in browser code, or copy them into public staging. Keep production secrets in the existing hosting secret store. This handoff contains no provider keys or production database backup.

On `webzad.dev` and `www.webzad.dev`, the existing frontend continues to use `https://webzad.pages.dev` for APIs. Local use targets the local server. Missing credentials produce truthful availability/delivery errors; real chat answers and email delivery have not been verified in this environment.

## Tests, evidence and safe staging

```bat
npm test
npm run build
```

`npm test` runs original and new Node tests. `npm run build` creates an allowlisted `.deploy/` directory **only**, without publishing. Private configuration, Node server sources, tests, tools, docs, Git files, and raw evidence are not public stage assets. Cloudflare Function files are staged as server code for Cloudflare Pages; do not upload those files to a static-only host as public downloads.

Development checks:

```bat
python -m unittest discover -s test -p "test_*.py"
python tools\verify_browser.py --base-url http://127.0.0.1:4173 --output evidence/qa/browser
```

The browser harness intercepts provider writes with explicit test fixtures. It is not proof of real Gemini answers or delivered email. Its `--offline` mode renders the owned site document and tests layout/interactions without HTTP navigation; it uses fallback fonts and cannot verify deployed CSP, actual media playback, real WebGL rendering or network performance. The included desktop/tablet/mobile screenshots are labeled offline implementation renders for that reason.

Production deployment is separate and has **not** been authorized or performed. After the capture gate, provider checks, real browser review, function compilation and owner approval, an authorized operator with an already installed/authenticated Wrangler may use `node deploy-prod.cjs --deploy`. The command refuses missing capture sets. A passing capture check alone is not production approval.

## Handoff documents

`docs/REDESIGN-DELIVERY.md` records actual changes, preserved functionality, test results and limitations. `docs/SELF-REVIEW.md` records the author review; no independent reviewer was available. `evidence/qa/` contains machine-readable results, test outputs and layout captures. Original files and media remain in this project; the separate original-source backup restores the supplied baseline without its Git history. The original uploaded ZIP remains the authoritative archive with history.
