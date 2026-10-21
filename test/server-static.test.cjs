'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleRequest } = require('../open-site-server.cjs');
let server, port, symlinksReady = false;
const root = path.resolve(__dirname, '..');
const links = [path.join(root, 'assets', 'private-link.js'), path.join(root, 'assets', 'outside-link.js')];
before(async () => {
  try {
    fs.symlinkSync(path.join(root, 'server-gemini-tools.cjs'), links[0]);
    fs.symlinkSync('/etc/hostname', links[1]);
    symlinksReady = true;
  } catch {
    // Windows requires Developer Mode or elevation to create symlinks; the
    // linked paths then 404 like any missing file, which still satisfies the
    // denial assertions below.
  }
  server = http.createServer(handleRequest);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(async () => { links.forEach(p => fs.rmSync(p, { force: true })); await new Promise(r => server.close(r)); });
function requestRaw(p, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', s => { body += s; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }); req.on('error', reject); req.end();
  });
}
for (const p of ['/.git/config', '/server-gemini-tools.cjs', '/.env', '/functions/_shared/gemini.js', '/docs/private.md', '/package.json', '/%2e%2e/private.txt', '/assets/../open-site-server.cjs', '/assets/private-link.js', '/assets/outside-link.js', '/assets/%2e%2e/open-site-server.cjs', '/assets/%255c..%255c.env', '/assets/a%00.js', '/assets/..%5copen-site-server.cjs']) {
  test(`static server denies ${p}`, async (t) => {
    if (!symlinksReady && (p === '/assets/private-link.js' || p === '/assets/outside-link.js')) {
      t.diagnostic('symlink fixtures unavailable on this platform — asserting 404 for the absent path');
    }
    const r = await requestRaw(p);
    assert.ok([400, 403, 404].includes(r.status), `${p} returned ${r.status}`);
    assert.ok(!r.body.includes('SYSTEM_INSTRUCTION'));
  });
}
test('missing asset is a real 404 rather than HTML', async () => { const r = await requestRaw('/assets/missing.png'); assert.equal(r.status, 404); assert.ok(!r.body.includes('<!doctype')); });
test('homepage and public assistant module are served', async () => { assert.equal((await requestRaw('/')).status, 200); assert.equal((await requestRaw('/assets/js/zada.js')).status, 200); });
test('static response has CSP and nosniff headers', async () => { const r=await requestRaw('/'); assert.match(r.headers['content-security-policy'] || '', /script-src 'self'/); assert.equal(r.headers['x-content-type-options'], 'nosniff'); });
test('HEAD does not return a body', async () => { const r=await requestRaw('/', 'HEAD'); assert.equal(r.status,200); assert.equal(r.body,''); });
test('POST cannot read static resources', async () => assert.equal((await requestRaw('/index.html','POST')).status,405));
test('malformed URL cannot crash the server', async () => { assert.equal((await requestRaw('/%ZZ')).status,400); assert.equal((await requestRaw('/')).status,200); });
