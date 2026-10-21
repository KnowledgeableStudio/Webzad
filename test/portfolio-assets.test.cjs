'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');const zlib=require('node:zlib');
const modulePath=path.join(__dirname,'../tools/check-portfolio.cjs');
function validator(){assert.ok(fs.existsSync(modulePath),'portfolio validator is not implemented');return require(modulePath).validatePortfolio;}
const destinations={zaddy:'https://zaddy.art/','la-socieda':'https://www.lasociedarecord.com/','one-of-six':'https://1of6.productions/',brg:'https://www.brgofficial.com/'};
function png(width,height,color){
 const crc=b=>{let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(name,data)=>{const t=Buffer.from(name);const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),8+data.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 const raw=Buffer.alloc(height*(width*3+1),color);for(let y=0;y<height;y++)raw[y*(width*3+1)]=0;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-test-'));let c=1;const manifest={version:1,projects:[]};for(const [id,url] of Object.entries(destinations)){
 const captures=[];for(const view of ['desktop','secondary','mobile']){const width=view==='mobile'?390:1600,height=view==='mobile'?844:1000;const bytes=png(width,height,c++);const rel=`assets/portfolio/${id}/${view}.png`;fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),bytes);captures.push({view,status:'captured',sourceUrl:url,finalUrl:url,capturedAt:new Date().toISOString(),viewport:{width,height},deviceScale:1,path:rel,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),rawSha256:crypto.createHash('sha256').update(bytes).digest('hex'),alt:`Test fixture only: ${id} ${view}`,httpStatus:200,contentVerified:true});}
 manifest.projects.push({id,url,status:'captured',captures});}return {root,manifest};}
async function withFixture(action){const x=fixture();try{return await action(x);}finally{fs.rmSync(x.root,{recursive:true,force:true});}}
test('four distinct verified capture sets satisfy integrity checks',()=>withFixture(async x=>assert.deepEqual(await validator()(x.manifest,x.root),{ok:true,issues:[]})));
test('missing image fails release',()=>withFixture(async x=>{fs.rmSync(path.join(x.root,x.manifest.projects[0].captures[0].path));assert.equal((await validator()(x.manifest,x.root)).ok,false);}));
test('text renamed PNG is rejected even with matching hash',()=>withFixture(async x=>{const c=x.manifest.projects[0].captures[0];const b=Buffer.from('<html>not an image</html>');fs.writeFileSync(path.join(x.root,c.path),b);c.sha256=crypto.createHash('sha256').update(b).digest('hex');assert.equal((await validator()(x.manifest,x.root)).ok,false);}));
test('duplicate screenshot reuse is rejected',()=>withFixture(async x=>{x.manifest.projects[1].captures[0]={...x.manifest.projects[0].captures[0],sourceUrl:x.manifest.projects[1].url,finalUrl:x.manifest.projects[1].url};assert.equal((await validator()(x.manifest,x.root)).ok,false);}));
test('blocked page and incomplete provenance never pass',()=>withFixture(async x=>{const c=x.manifest.projects[0].captures[0];c.httpStatus=403;c.contentVerified=false;delete c.capturedAt;assert.equal((await validator()(x.manifest,x.root)).ok,false);}));
test('wrong destination, missing secondary and escaping path are rejected',()=>withFixture(async x=>{x.manifest.projects[0].url='https://example.com/';x.manifest.projects[1].captures=x.manifest.projects[1].captures.filter(c=>c.view!=='secondary');x.manifest.projects[2].captures[0].path='../private.png';assert.equal((await validator()(x.manifest,x.root)).ok,false);}));
test('pending screenshots cannot return ok true',async()=>{const validate=validator();assert.equal((await validate({version:1,projects:Object.entries(destinations).map(([id,url])=>({id,url,status:'pending-capture',captures:[]}))},__dirname)).ok,false);});

test('missing or inconsistent raw capture hash is rejected',()=>withFixture(async x=>{delete x.manifest.projects[0].captures[0].rawSha256;assert.equal((await validator()(x.manifest,x.root)).ok,false);x.manifest.projects[0].captures[0].rawSha256='0'.repeat(64);assert.equal((await validator()(x.manifest,x.root)).ok,false);}));
