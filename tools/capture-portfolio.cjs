'use strict';
/** Read-only capture using an already installed Chrome/Edge and Node 22.
 * Uses a disposable, signed-out browser profile. Does not change browser policy,
 * install software, send forms, make purchases, or fabricate missing screenshots.
 * Protocol: https://chromedevtools.github.io/devtools-protocol/ */
const fs=require('node:fs/promises'),fsSync=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {DESTINATIONS,pngDimensions,validatePortfolio}=require('./check-portfolio.cjs');
const ROOT=path.resolve(__dirname,'..');
const INFO={zaddy:{name:'ZADDY.ART',keywords:['izad','zaddy']},'la-socieda':{name:'LA SOCIEDA RECORD',keywords:['socieda']},'one-of-six':{name:'1 OF 6 PRODUCTIONS',keywords:['1 of 6','production']},brg:{name:'BRG OFFICIAL',keywords:['brg']}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function browserCandidates(platform=process.platform,env=process.env){
 const paths=[];if(env.WEBZAD_CAPTURE_BROWSER)paths.push(env.WEBZAD_CAPTURE_BROWSER);
 if(platform==='win32'){for(const base of [env.ProgramFiles,env['PROGRAMFILES(X86)'],env.LOCALAPPDATA].filter(Boolean))for(const tail of ['Microsoft/Edge/Application/msedge.exe','Google/Chrome/Application/chrome.exe'])paths.push(path.win32.join(base,tail));}
 else if(platform==='darwin')paths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
 else paths.push('/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser');
 return [...new Set(paths)];
}
function verifyPage(info,id){
 try{const wanted=new URL(DESTINATIONS[id]),actual=new URL(info.url),text=String(info.text||'').trim().toLowerCase();
  return actual.protocol==='https:'&&actual.hostname.replace(/^www\./,'')===wanted.hostname.replace(/^www\./,'')&&info.status===200&&text.length>=40&&INFO[id].keywords.some(w=>text.includes(w))&&!/(access denied|err_blocked|checking your browser|just a moment|verify you are human|site can.t be reached)/i.test(text.slice(0,600));
 }catch{return false;}
}
class CDP{
 constructor(socket){this.socket=socket;this.next=0;this.pending=new Map();this.listeners=new Set();socket.addEventListener('message',event=>{let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.id){const request=this.pending.get(msg.id);if(!request)return;this.pending.delete(msg.id);clearTimeout(request.timer);if(msg.error)request.reject(new Error(msg.error.message));else request.resolve(msg.result||{});}else for(const fn of this.listeners)fn(msg);});socket.addEventListener('close',()=>{for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Browser connection closed'));}this.pending.clear();});}
 static async connect(url,Socket=globalThis.WebSocket){const parsed=new URL(url);if(parsed.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname))throw new Error('Browser debugging endpoint must be loopback');if(!Socket)throw new Error('Node 22.16 or newer is required');const socket=new Socket(url);const client=new CDP(socket);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.close();reject(new Error('Browser connection timed out'));},10000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Could not connect to browser'));},{once:true});});return client;}
 call(method,params={},sessionId,timeout=30000){return new Promise((resolve,reject)=>{const id=++this.next;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`${method} timed out`));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});}
 on(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 close(){this.socket.close();}
}
async function target(cdp){const {targetId}=await cdp.call('Target.createTarget',{url:'about:blank'});const {sessionId}=await cdp.call('Target.attachToTarget',{targetId,flatten:true});await cdp.call('Page.enable',{},sessionId);await cdp.call('Runtime.enable',{},sessionId);return {targetId,sessionId};}
async function evaluate(cdp,session,expression){const result=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,timeout:10000},session);if(result.exceptionDetails)throw new Error('Browser evaluation failed');return result.result?.value;}
async function derivatives(cdp,session,base64,widths){
 // A separate blank local browser target decodes a captured PNG into WebP.
 // No styles or content on the public website are edited.
 const script=`(async()=>{const image=new Image();image.src='data:image/png;base64,${base64}';await image.decode();return ${JSON.stringify(widths)}.map(width=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(image.height*width/image.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return {width,height:canvas.height,data:canvas.toDataURL('image/webp',.9)};});})()`;
 return evaluate(cdp,session,script);
}
async function captureOne(cdp,derivativeSession,id){
 const info=INFO[id],url=DESTINATIONS[id],{targetId,sessionId}=await target(cdp);let status=0,frameId='';
 const off=cdp.on(event=>{if(event.sessionId!==sessionId)return;
  if(event.method==='Network.responseReceived'&&event.params.type==='Document'&&(!frameId||event.params.frameId===frameId))status=event.params.response.status;
  if(event.method==='Fetch.requestPaused'){const request=event.params;const safe=['GET','HEAD','OPTIONS'].includes(request.request.method);cdp.call(safe?'Fetch.continueRequest':'Fetch.failRequest',{requestId:request.requestId,...(!safe?{errorReason:'Aborted'}:{})},sessionId).catch(()=>{});}
 });
 try{
  await cdp.call('Network.enable',{},sessionId);await cdp.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sessionId);
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
  const navigation=await cdp.call('Page.navigate',{url},sessionId);frameId=navigation.frameId;if(navigation.errorText)throw new Error(navigation.errorText);
  let ready=false;for(let i=0;i<60;i++){await sleep(500);try{const value=await evaluate(cdp,sessionId,'({url:location.href,text:document.body?.innerText||"",ready:document.readyState})');if(value.ready==='complete'&&verifyPage({...value,status},id)){ready=true;break;}if(/chrome-error:/.test(value.url))throw new Error('Browser policy or network prevented navigation');}catch(error){if(/policy|prevented/.test(error.message))throw error;}}
  if(!ready)throw new Error('Live page could not be verified. No error-page screenshot accepted.');
  await evaluate(cdp,sessionId,'Promise.race([Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode().catch(()=>{}))]),new Promise(r=>setTimeout(r,5000))]).then(()=>true)');await sleep(1800);
  const finalUrl=await evaluate(cdp,sessionId,'location.href'),captures=[],stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const rawDir=path.join(ROOT,'evidence/portfolio/raw',id,stamp),publicDir=path.join(ROOT,'assets/portfolio',id);await fs.mkdir(rawDir,{recursive:true});await fs.mkdir(publicDir,{recursive:true});
  for(const view of ['desktop','secondary','mobile']){
   const viewport=view==='mobile'?{width:390,height:844}:{width:1600,height:1000};
   if(view==='secondary')await evaluate(cdp,sessionId,'(()=>{const candidates=[...document.querySelectorAll("main section,section[id]")];const next=candidates.find(e=>e.getBoundingClientRect().top+scrollY>innerHeight*.65);window.scrollTo({top:next?next.getBoundingClientRect().top+scrollY:Math.min(950,document.documentElement.scrollHeight-innerHeight),behavior:"instant"});return true;})()');
   if(view==='mobile'){await cdp.call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:true},sessionId);await evaluate(cdp,sessionId,'window.scrollTo({top:0,behavior:"instant"});true');}
   await sleep(1700);
   const {data}=await cdp.call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sessionId);const bytes=Buffer.from(data,'base64'),dimensions=pngDimensions(bytes);
   if(dimensions.width!==viewport.width||dimensions.height!==viewport.height)throw new Error('Capture dimensions do not match viewport');
   const raw=path.join(rawDir,view+'.png'),publicPath=`assets/portfolio/${id}/${view}.png`;await fs.writeFile(raw,bytes);await fs.writeFile(path.join(ROOT,publicPath),bytes);
   const widths=[640,960,1600].filter(w=>w<=viewport.width);if(!widths.length)widths.push(viewport.width);
   const resized=await derivatives(cdp,derivativeSession,data,widths),variants=[];
   for(const image of resized){if(!image.data.startsWith('data:image/webp;base64,'))throw new Error('Browser did not produce WebP');const variantBytes=Buffer.from(image.data.split(',')[1],'base64'),name=`assets/portfolio/${id}/${view}-${image.width}.webp`;await fs.writeFile(path.join(ROOT,name),variantBytes);variants.push({path:name,width:image.width,height:image.height,sha256:sha(variantBytes)});}
   captures.push({view,status:'captured',sourceUrl:url,finalUrl,capturedAt:new Date().toISOString(),viewport,deviceScale:1,path:publicPath,sha256:sha(bytes),rawSha256:sha(bytes),alt:`${info.name} — actual ${view} website capture`,httpStatus:status,contentVerified:true,method:'Installed Chrome/Edge CDP Page.captureScreenshot',variants});
  }
  return {id,name:info.name,url,status:'captured',captures};
 }finally{off();await cdp.call('Target.closeTarget',{targetId}).catch(()=>{});}
}
async function main(args=process.argv.slice(2)){
 if(args.includes('--help')){console.log('Usage: node tools/capture-portfolio.cjs [--project all|zaddy|la-socieda|one-of-six|brg]\nUses installed Chrome/Edge and Node 22.16+. Creates real PNG/WebP captures with provenance. No login, purchases, policy changes or dependencies.');return 0;}
 const index=args.indexOf('--project'),selected=index<0?'all':args[index+1];if(selected!=='all'&&!Object.hasOwn(DESTINATIONS,selected))throw new Error('Unknown project');
 if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node 22.16 or newer is required');
 const executable=browserCandidates().find(p=>fsSync.existsSync(p));if(!executable)throw new Error('No installed Chrome/Edge found. Set WEBZAD_CAPTURE_BROWSER to its executable path, or use the documented Python capture tool.');
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'webzad-capture-'));let child,cdp;const attempts=[];
 const manifestPath=path.join(ROOT,'assets/portfolio/manifest.json');const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 try{
  child=spawn(executable,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--mute-audio','about:blank'],{stdio:['ignore','ignore','pipe'],windowsHide:true});let launchError='';child.on('error',e=>launchError=e.message);child.stderr.on('data',chunk=>{launchError=(launchError+chunk.toString()).slice(-3000);});
  let endpoint;for(let i=0;i<60;i++){await sleep(250);try{const lines=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);endpoint=`ws://127.0.0.1:${Number(lines[0])}${lines[1]}`;break;}catch{}if(child.exitCode!==null)break;}
  if(!endpoint)throw new Error('Browser did not start with a local debugging endpoint. Existing browser/security policies were not changed. '+launchError.slice(-400));
  cdp=await CDP.connect(endpoint);const derivativeTarget=await target(cdp);
  for(const id of selected==='all'?Object.keys(DESTINATIONS):[selected]){
   try{console.log(`Capturing ${INFO[id].name} from its real public website…`);const result=await captureOne(cdp,derivativeTarget.sessionId,id);const at=manifest.projects.findIndex(p=>p.id===id);if(at>=0)manifest.projects[at]=result;else manifest.projects.push(result);attempts.push({project:id,success:true,at:new Date().toISOString()});console.log('Saved desktop, additional-section and mobile captures. Review these images before publishing.');}
   catch(error){attempts.push({project:id,success:false,at:new Date().toISOString(),error:error.message});console.error(`${id}: NOT CAPTURED — ${error.message}`);if(/BLOCKED_BY_ADMINISTRATOR|policy/.test(error.message))break;}
  }
  manifest.updatedAt=new Date().toISOString();await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  const results=await validatePortfolio(manifest,ROOT);console.log(results.ok?'Capture integrity gate passed. Visual review remains required.':'Capture gate still blocked:\n- '+results.issues.join('\n- '));return results.ok?0:1;
 }finally{
  await fs.mkdir(path.join(ROOT,'evidence/portfolio'),{recursive:true});await fs.writeFile(path.join(ROOT,'evidence/portfolio/node-capture-attempts.json'),JSON.stringify(attempts,null,2)+'\n');
  if(cdp){await cdp.call('Browser.close',{},undefined,3000).catch(()=>{});cdp.close();}
  if(child&&child.exitCode===null){await sleep(800);if(child.exitCode===null)child.kill();}
  await fs.rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:500}).catch(()=>{});
 }
}
if(require.main===module)main().then(code=>process.exitCode=code).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={browserCandidates,verifyPage,CDP,main};
