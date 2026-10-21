#!/usr/bin/env python3
"""Webzad browser checks. Default: loopback HTTP. --offline: owned HTML/CSS/JS,
inline owned media, explicit provider fixtures. Offline mode does not validate
HTTP navigation, deployed CSP, remote fonts, video playback or WebGL."""
import argparse,base64,json,mimetypes,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
VIEWPORTS=[320,390,768,834,1440,1920]
def uri(value):
 p=(ROOT/str(value).split('?')[0].lstrip('/')).resolve()
 if not p.is_file() or not p.is_relative_to(ROOT):return str(value)
 return 'data:'+(mimetypes.guess_type(p)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
def owned_html():
 from bs4 import BeautifulSoup
 soup=BeautifulSoup((ROOT/'index.html').read_text(encoding='utf-8'),'html.parser')
 scripts=[(e.get('src'),e.get('type')=='module') for e in soup.select('script[src]')]
 for e in soup.select('script,meta[http-equiv]'):e.decompose()
 for link in list(soup.select('link')):
  href=link.get('href','')
  if 'stylesheet' in link.get('rel',[]) and not href.startswith('http'):
   style=soup.new_tag('style');style.string=(ROOT/href).read_text(encoding='utf-8');link.replace_with(style)
  else:link.decompose()
 for el in soup.select('img,source,video'):
  for attr in ['src','poster']:
   if el.get(attr) and not el[attr].startswith(('https:','http:','data:')):el[attr]=uri(el[attr])
  if el.get('srcset'):el['srcset']=uri(el['srcset'].split(',')[0].split()[0])
 return str(soup),scripts

def fixture_script():
 files=['assets/media/zada-portrait.webp','assets/zada-avatar.jpg',*[str(p.relative_to(ROOT)) for p in (ROOT/'assets').glob('work-*.png')]]
 images={name:uri(name) for name in files};manifest=json.loads((ROOT/'assets/portfolio/manifest.json').read_text(encoding='utf-8'))
 return '''window.__qaFetches=[];window.__qaContactMode='error';
const ownedImages='''+json.dumps(images)+''';
const resolveOwned=value=>ownedImages[String(value).split('?')[0]]||value;
const imageDescriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{get(){return imageDescriptor.get.call(this);},set(value){imageDescriptor.set.call(this,resolveOwned(value));},configurable:true});
new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes){if(node.nodeType!==1)continue;const images=[...(node.matches?.('img')?[node]:[]),...node.querySelectorAll('img')];for(const img of images){const value=img.getAttribute('src');if(ownedImages[value])img.src=ownedImages[value];}}}).observe(document.documentElement,{childList:true,subtree:true});
window.fetch=async(url,options={})=>{
 window.__qaFetches.push({url:String(url),method:options.method||'GET',body:options.body||null});
 if(String(url).includes('assets/portfolio/manifest.json'))return new Response(JSON.stringify('''+json.dumps(manifest)+'''),{headers:{'content-type':'application/json'}});
 if(String(url).endsWith('/api/notify-visitor'))return new Response(JSON.stringify({success:true,delivered:false}),{headers:{'content-type':'application/json'}});
 if(String(url).endsWith('/api/contact'))return new Response(JSON.stringify(window.__qaContactMode==='success'?{success:true}:{error:'QA fixture: contact delivery unavailable'}),{status:window.__qaContactMode==='success'?200:503,headers:{'content-type':'application/json'}});
 if(String(url).endsWith('/api/chat'))return new Response(JSON.stringify({error:'QA fixture: provider not configured'}),{status:503,headers:{'content-type':'application/json'}});
 throw new Error('Offline fixture cannot fetch '+url);
};'''

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--base-url',default='http://127.0.0.1:4173');parser.add_argument('--offline',action='store_true')
 parser.add_argument('--output',type=Path,default=ROOT/'evidence/qa/browser');parser.add_argument('--executable',default='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 args=parser.parse_args()
 if urlparse(args.base_url).hostname not in ('127.0.0.1','localhost','::1'):parser.error('Only loopback targets are permitted; production tests are not authorized.')
 args.output.mkdir(parents=True,exist_ok=True)
 report={'mode':'offline-owned-document' if args.offline else 'loopback-http','apiMode':'intercepted test fixtures; no live provider writes','fontMode':'system fallback' if args.offline else 'normal page fonts','checks':[],'viewports':[],'screenshots':[],'pageErrors':[],'consoleErrors':[],'unverified':['real-device browsers','Firefox/WebKit','live Gemini responses','actual email delivery','real portfolio screenshots','WebGL model rendering/frame rates']}
 if args.offline:report['unverified']+=['HTTP browser navigation','deployed CSP enforcement','remote font metrics','actual video playback','Core Web Vitals','actual browser-level zoom and text-only scaling']
 def check(name,condition,detail=None):
  report['checks'].append({'name':name,'passed':bool(condition),'detail':detail});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
 try:
  html,scripts=owned_html()
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,**({'executable_path':args.executable} if args.executable else {}))
   def load(width,scale=1):
    page=browser.new_page(viewport={'width':width,'height':960 if width>=768 else 844},device_scale_factor=scale,reduced_motion='reduce')
    page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
    page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None)
    if args.offline:
     page.route('**/*',lambda route:route.abort());page.set_content(html,wait_until='load');page.add_script_tag(content=fixture_script())
     for src,module in scripts:
      content=(ROOT/src).read_text(encoding='utf-8');page.add_script_tag(content='(function(){\n'+content+'\n})();' if module else content)
    else:
     page.route('**/api/*',lambda route:route.fulfill(status=503,content_type='application/json',body='{"error":"QA fixture: provider disabled"}'))
     page.goto(args.base_url,wait_until='domcontentloaded',timeout=20000)
    page.wait_for_function('!!window.zadaCompanion?.isInitialized',timeout=6000);page.wait_for_timeout(80)
    return page
   for width in VIEWPORTS:
    page=load(width);dimensions=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})')
    check(f'No horizontal page overflow at {width}px',dimensions['scrollWidth']==width,dimensions);report['viewports'].append(dimensions)
    check(f'Zada ready without initial model at {width}px',page.evaluate('window.zadaCompanion.isInitialized && !window.zadaCompanion.renderer.isInitialized'))
    check(f'Reduced motion respected at {width}px',page.evaluate('!window.WebzadMotion.enabled && !document.getElementById("heroVideo").getAttribute("src")'))
    # Exercise native lazy loading by normal scrolling before a full-page capture.
    # Do not change production loading attributes merely to make a screenshot.
    page.evaluate('window.scrollTo(0,0)')
    for y in range(0,dimensions['height'],600):
     page.evaluate('(y)=>window.scrollTo(0,y)',y);page.wait_for_timeout(60)
    page.wait_for_function("Array.from(document.querySelectorAll('.service-art img,.automation-image img')).every(img=>img.complete && img.naturalWidth>0)",timeout=5000)
    page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(150)
    check(f'Illustration images have loaded at {width}px',page.locator('.service-art img,.automation-image img').evaluate_all('(images)=>images.every(img=>img.complete && img.naturalWidth>0)'))
    page.evaluate('window.zadaCompanion.hideGreetingBubble()');page.wait_for_timeout(320)
    name=f'webzad-{width}.png';page.screenshot(path=str(args.output/name),full_page=True);report['screenshots'].append(name)
    if width==1440:
     page.screenshot(path=str(args.output/'webzad-desktop-hero.png'));report['screenshots'].append('webzad-desktop-hero.png')
     page.locator('[data-open-zada]').first.click()
     check('Zada uses a focused native dialog',page.locator('dialog.zada-hud[open]').count()==1 and page.locator('.zada-input-field').evaluate('(el)=>el===document.activeElement'))
     page.screenshot(path=str(args.output/'webzad-chat.png'));report['screenshots'].append('webzad-chat.png')
     page.evaluate('WebzadPortfolio.openProject("zaddy",document.activeElement)')
     check('Project stacks above Zada without deleting messages',page.locator('dialog[open]').count()==2 and page.evaluate('zadaCompanion.holoUI.messages.length>0'))
     page.keyboard.press('Escape');check('Escape closes only the top project',page.locator('dialog[open]').count()==1 and page.evaluate('zadaCompanion.holoUI.isOpen'))
     page.keyboard.press('Escape');check('Second Escape closes Zada',page.locator('dialog[open]').count()==0)
     for id in ['zaddy','la-socieda','one-of-six','brg']:
      trigger=page.locator(f'[data-project-open="{id}"]');trigger.click()
      check(f'{id} details and secure real link',page.locator('dialog.project-dialog[open]').count()==1 and page.locator('dialog.project-dialog a[target="_blank"]').get_attribute('rel')=='noopener noreferrer')
      page.keyboard.press('Escape');check(f'{id} restores trigger focus',trigger.evaluate('(el)=>el===document.activeElement'))
     for id in ['services','hospitality','growth']:
      page.evaluate('(id)=>WebzadPortfolio.openStudy(id)',id);check(f'Legacy {id} study retained',page.locator('dialog .study-full').count()==1);page.keyboard.press('Escape')
     for button in page.locator('[data-service-value]').all():
      value=button.get_attribute('data-service-value');button.click();check('Service selects '+value,page.locator('select[name="service"]').input_value()==value)
     page.locator('input[name="name"]').fill('Fixture Person');page.locator('input[name="email"]').fill('fixture@example.invalid');page.locator('textarea[name="goals"]').fill('Local QA fixture, not a real inquiry.')
     if args.offline:
      page.locator('#submitBtn').click();page.locator('#formError').wait_for(state='visible');check('Contact failure retains the brief and enables retry',page.locator('textarea[name="goals"]').input_value().startswith('Local QA') and not page.locator('#submitBtn').is_disabled())
      page.evaluate('window.__qaContactMode="success"');page.locator('#submitBtn').click();page.locator('#formSuccess').wait_for(state='visible');check('Contact success makes no confirmation-email promise','confirmation' not in page.locator('#formSuccess').inner_text().lower())
     page.locator('#zadaFooterTrigger').click();page.locator('.zada-input-field').fill('QA provider availability check');page.locator('.zada-input-form').evaluate('(form)=>form.requestSubmit()');page.wait_for_function('zadaCompanion.stateManager.getState()==="ERROR"')
     reply=page.locator('.zada-msg').last.inner_text().lower();check('Unavailable AI service is reported honestly','unavailable' in reply or 'trouble' in reply);page.keyboard.press('Escape')
     scaled=load(720,2);check('High-DPR scaled layout at 720 CSS px stays within the viewport',scaled.evaluate('devicePixelRatio===2 && document.documentElement.scrollWidth<=innerWidth'));scaled.close()
    if width==390:
     page.locator('#navToggle').click();check('Mobile menu disclosure opens',page.locator('#navToggle').get_attribute('aria-expanded')=='true' and page.locator('#mobileMenu').is_visible());page.keyboard.press('Escape');check('Mobile menu Escape restores focus',page.locator('#mobileMenu').is_hidden() and page.locator('#navToggle').evaluate('(el)=>el===document.activeElement'))
    page.close()
   check('No unexpected page exceptions',not report['pageErrors'],report['pageErrors']);browser.close()
 except Exception as e:
  report['runError']=str(e);report['checks'].append({'name':'Browser harness completed','passed':False,'detail':str(e)});print(str(e),file=sys.stderr,flush=True)
 report['passed']=sum(c['passed'] for c in report['checks']);report['failed']=sum(not c['passed'] for c in report['checks']);report['productionReady']=False
 (args.output/'results.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':report['passed'],'failed':report['failed'],'mode':report['mode']}))
 return 0 if report['failed']==0 else 1
if __name__=='__main__':sys.exit(main())
