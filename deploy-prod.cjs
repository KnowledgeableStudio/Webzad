'use strict';
/** Safe, explicit staging. Deployment requires a separate --deploy flag. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PUBLIC_ROOT, isPublicRelativePath } = require('./server-public-paths.cjs');
const ROOT=__dirname, STAGE=path.join(ROOT,'.deploy');
const HOST_FILES=new Set(['CNAME','.nojekyll','_headers','_routes.json','_redirects']);
function canStage(relative) {
  if (isPublicRelativePath(relative) || HOST_FILES.has(relative)) return true;
  const parts=relative.split('/');
  return parts[0]==='functions' && parts.every(p=>p && !p.startsWith('.') && !['node_modules','test','tests','docs','evidence'].includes(p)) && relative.endsWith('.js');
}
function stage() {
  fs.rmSync(STAGE,{recursive:true,force:true}); fs.mkdirSync(STAGE,{recursive:true});
  let copied=0;
  const walk=(src,relative)=>{
    const info=fs.lstatSync(src);
    if (info.isSymbolicLink()) return;
    if (info.isDirectory()) {
      for (const name of fs.readdirSync(src)) {
        if (name.startsWith('.')) continue;
        walk(path.join(src,name), relative+'/'+name);
      }
    } else if (info.isFile() && canStage(relative)) {
      const dest=path.join(STAGE,relative); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(src,dest); copied++;
    }
  };
  for (const entry of [...PUBLIC_ROOT,...HOST_FILES,'assets','functions']) {
    const src=path.join(ROOT,entry); if (fs.existsSync(src)) walk(src,entry);
  }
  console.log(`Staged ${copied} allowlisted files into .deploy/`);
  return STAGE;
}
async function checkRelease(root=ROOT) {
  const {validatePortfolio}=require('./tools/check-portfolio.cjs');
  let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/portfolio/manifest.json'),'utf8'));}catch{return {ok:false,issues:['Capture manifest unavailable']};}
  return validatePortfolio(manifest,root);
}
if (require.main===module) {
  (async()=>{
    const wantsDeploy=process.argv.includes('--deploy')&&!process.argv.includes('--no-deploy');
    if(wantsDeploy){const gate=await checkRelease();if(!gate.ok)throw new Error('Deployment blocked: real portfolio capture requirements are incomplete.\n- '+gate.issues.join('\n- '));}
    stage();
    if(!wantsDeploy)console.log('Stage-only mode — nothing deployed. Run check:portfolio and browser acceptance before release.');
    else execFileSync('npx',['--no-install','wrangler','pages','deploy',STAGE,'--project-name','webzad','--branch','main','--commit-dirty=true'],{stdio:'inherit',cwd:ROOT,shell:process.platform==='win32'});
  })().catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={stage,canStage,checkRelease};
