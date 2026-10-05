/**
 * deploy-prod.cjs - Stages only public files into .deploy/ and deploys to Cloudflare Pages.
 *
 * `wrangler pages deploy .` uploads EVERYTHING in the working directory — including
 * .env, .dev.vars, server source, tests, and internal docs (this leaked secrets once).
 * This script copies an explicit allowlist into .deploy/ and deploys that instead.
 *
 * Usage: node deploy-prod.cjs [--no-deploy]   (stage only)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const STAGE = path.join(ROOT, '.deploy');

/** Explicit public allowlist — anything not listed is never published. */
const INCLUDE = [
  'index.html', '404.html', 'CNAME', '.nojekyll',
  'robots.txt', 'sitemap.xml', 'site.webmanifest',
  '_headers', '_routes.json', '_redirects',
  'Background.mp4',
  'favicon.ico', 'favicon.png', 'favicon-32x32.png', 'favicon-48x48.png',
  'favicon-192x192.png', 'favicon-google.png', 'apple-touch-icon.png',
  'studio-hero-inset-preview.png',
  'assets', 'functions'
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

const staged = [];
for (const item of INCLUDE) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) continue;
  copyRecursive(src, path.join(STAGE, item));
  staged.push(item);
}
console.log(`Staged ${staged.length} top-level entries into .deploy/`);

// Guard: fail loudly if anything sensitive slipped into staging.
const FORBIDDEN = [/^\.(?!nojekyll$)/, /(^|[\\/])(docs|test|node_modules)([\\/]|$)/, /\.(cjs|ps1|cmd|toml|md|log|vars)$/i];
const offenders = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(STAGE, full);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (FORBIDDEN.some(re => re.test(rel))) offenders.push(rel);
  }
})(STAGE);
if (offenders.length) {
  console.error('Refusing to deploy — forbidden files staged:\n  ' + offenders.join('\n  '));
  process.exit(1);
}
console.log('Staging check passed: no dotfiles, dev, or doc files staged.');

if (process.argv.includes('--no-deploy')) {
  console.log('Stage-only mode — skipping deploy.');
  process.exit(0);
}

execFileSync('npx', ['wrangler', 'pages', 'deploy', STAGE, '--project-name', 'webzad', '--branch', 'main', '--commit-dirty=true'], {
  stdio: 'inherit',
  cwd: ROOT,
  shell: process.platform === 'win32'
});
