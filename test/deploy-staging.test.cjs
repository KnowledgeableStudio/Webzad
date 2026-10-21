'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
test('stage-only build includes public assets/functions but not nested private files or symlinks', () => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'webzad-stage-'));
  try {
    for (const file of ['deploy-prod.cjs','server-public-paths.cjs']) { const source=path.join(__dirname,'..',file); if (fs.existsSync(source)) fs.copyFileSync(source,path.join(tmp,file)); }
    for (const [file,content] of Object.entries({'index.html':'<!doctype html><title>test</title>', 'assets/js/main.js':'void 0;', 'assets/.env':'SECRET_SENTINEL', 'assets/internal/secret.md':'SECRET_SENTINEL', 'assets/.cache/key.js':'SECRET_SENTINEL','functions/api/chat.js':'export function onRequestPost() {}','functions/.env':'SECRET_SENTINEL','.env':'SECRET_SENTINEL','docs/private.md':'SECRET_SENTINEL','evidence/raw.png':'SECRET_SENTINEL'})) {
      const p=path.join(tmp,file); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,content);
    }
    try { fs.symlinkSync(path.join(tmp,'.env'),path.join(tmp,'assets','leak.js')); }
    catch { /* Windows requires Developer Mode/elevation for symlinks; the uncreated link cannot be staged either way. */ }
    const run=spawnSync(process.execPath,['deploy-prod.cjs','--no-deploy'],{cwd:tmp,encoding:'utf8'});
    assert.equal(run.status,0,run.stdout+run.stderr);
    assert.ok(fs.existsSync(path.join(tmp,'.deploy/index.html')));
    assert.ok(fs.existsSync(path.join(tmp,'.deploy/functions/api/chat.js')));
    const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
    for (const p of walk(path.join(tmp,'.deploy'))) assert.ok(!fs.readFileSync(p,'utf8').includes('SECRET_SENTINEL'),p);
    assert.ok(!fs.existsSync(path.join(tmp,'.deploy/assets/leak.js')));
  } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
});
test('npm build explicitly stages only and test command is shell-glob independent',()=>{
  const p=path.join(__dirname,'../package.json'); assert.ok(fs.existsSync(p),'package.json missing');
  const pkg=JSON.parse(fs.readFileSync(p)); assert.equal(pkg.scripts.build,'node deploy-prod.cjs --no-deploy'); assert.equal(pkg.scripts.test,'node tools/test.cjs'); assert.ok(!pkg.type || pkg.type==='commonjs');
});
