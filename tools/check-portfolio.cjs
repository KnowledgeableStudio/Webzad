'use strict';
/** Integrity gate, not a substitute for visually reviewing each real capture. */
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');const zlib=require('node:zlib');
const DESTINATIONS=Object.freeze({zaddy:'https://zaddy.art/','la-socieda':'https://www.lasociedarecord.com/','one-of-six':'https://1of6.productions/',brg:'https://www.brgofficial.com/'});
function pngDimensions(buffer){
  if(buffer.length<33 || buffer.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('not a PNG capture');
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
  if(width<1||height<1||width*height>40000000)throw new Error('invalid image size');
  const chunks=[];let position=8,ended=false;
  while(position+12<=buffer.length){const n=buffer.readUInt32BE(position);if(position+n+12>buffer.length)throw new Error('truncated PNG');const kind=buffer.toString('ascii',position+4,position+8);if(kind==='IDAT')chunks.push(buffer.subarray(position+8,position+8+n));if(kind==='IEND'){ended=true;break;}position+=n+12;}
  if(!ended||!chunks.length)throw new Error('incomplete PNG');
  const raw=zlib.inflateSync(Buffer.concat(chunks),{maxOutputLength:200000000});
  if(raw.length<height)throw new Error('undecodable PNG');
  return {width,height};
}
function hostname(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '';}}
async function validatePortfolio(manifest,projectRoot){
  const issues=[],seen=new Set(),projects=Array.isArray(manifest?.projects)?manifest.projects:[];
  if(projects.length!==4)issues.push('Exactly four approved projects are required.');
  for(const [id,url] of Object.entries(DESTINATIONS)){
    const rows=projects.filter(p=>p.id===id);const p=rows[0];
    if(rows.length!==1||!p||p.url!==url){issues.push(`${id}: missing, duplicated, or incorrect destination`);continue;}
    if(p.status!=='captured')issues.push(`${id}: live screenshots are not captured`);
    for(const view of ['desktop','secondary','mobile']){
      const captures=(p.captures||[]).filter(c=>c.view===view);const c=captures[0];
      if(captures.length!==1||!c){issues.push(`${id}/${view}: capture missing`);continue;}
      if(c.status!=='captured'||c.httpStatus!==200||c.contentVerified!==true)issues.push(`${id}/${view}: page was not successfully verified`);
      if(c.sourceUrl!==url||hostname(c.finalUrl)!==hostname(url)||!String(c.finalUrl).startsWith('https://'))issues.push(`${id}/${view}: source/final URL invalid`);
      const time=Date.parse(c.capturedAt);
      if(!Number.isFinite(time)||time>Date.now()+300000||Date.now()-time>90*86400000)issues.push(`${id}/${view}: missing, future, or older-than-90-days capture time`);
      const v=c.viewport;
      if(!v||!Number.isInteger(v.width)||!Number.isInteger(v.height)||c.deviceScale!==1||!c.alt?.trim())issues.push(`${id}/${view}: dimensions, scale or alt text missing`);
      if(typeof c.path!=='string'||!c.path.startsWith(`assets/portfolio/${id}/`)||c.path.includes('..')||c.path.includes('\\')){issues.push(`${id}/${view}: unsafe image path`);continue;}
      try{
        const root=await fs.realpath(projectRoot);const full=await fs.realpath(path.join(root,c.path));
        if(!full.startsWith(root+path.sep))throw new Error('image escapes project');
        const bytes=await fs.readFile(full),hash=crypto.createHash('sha256').update(bytes).digest('hex');
        if(hash!==c.sha256)issues.push(`${id}/${view}: screenshot hash mismatch`);
        if(!/^[a-f0-9]{64}$/.test(c.rawSha256||'')||c.rawSha256!==hash)issues.push(`${id}/${view}: raw capture hash missing or inconsistent`);
        const dimensions=pngDimensions(bytes);
        if(v&&(dimensions.width!==v.width||dimensions.height!==v.height))issues.push(`${id}/${view}: actual dimensions do not match viewport`);
        if(view==='desktop'){if(seen.has(hash))issues.push(`${id}: duplicate homepage screenshot`);seen.add(hash);}
      }catch(e){issues.push(`${id}/${view}: ${e.code==='ENOENT'?'image file missing':e.message}`);}
    }
  }
  return {ok:issues.length===0,issues};
}
if(require.main===module){const root=path.resolve(__dirname,'..');(async()=>{let manifest;try{manifest=JSON.parse(await fs.readFile(path.join(root,'assets/portfolio/manifest.json'),'utf8'));}catch{manifest={projects:[]};}const result=await validatePortfolio(manifest,root);console.log(result.ok?'Portfolio image integrity: PASS (4 projects / 12 real captures)':'Portfolio release BLOCKED:\n- '+result.issues.join('\n- '));process.exitCode=result.ok?0:1;})();}
module.exports={validatePortfolio,DESTINATIONS,pngDimensions};
