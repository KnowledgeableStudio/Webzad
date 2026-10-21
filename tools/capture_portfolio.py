#!/usr/bin/env python3
"""Read-only real-browser portfolio captures. Never substitutes imagery for a failed capture.
Run in an environment permitted to browse the four public websites.
"""
import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

PROJECTS = {
    'zaddy': {'name': 'ZADDY.ART', 'url': 'https://zaddy.art/', 'keywords': ['izad', 'zaddy'], 'secondary': 'Music and merchandise'},
    'la-socieda': {'name': 'LA SOCIEDA RECORD', 'url': 'https://www.lasociedarecord.com/', 'keywords': ['socieda'], 'secondary': 'Artist and music presentation'},
    'one-of-six': {'name': '1 OF 6 PRODUCTIONS', 'url': 'https://1of6.productions/', 'keywords': ['1 of 6', 'production'], 'secondary': 'Live-event production presentation'},
    'brg': {'name': 'BRG OFFICIAL', 'url': 'https://www.brgofficial.com/', 'keywords': ['brg'], 'secondary': 'Collection and product presentation'},
}
ROOT = Path(__file__).resolve().parents[1]


def valid_page(text, status, keywords):
    text = (text or '').strip().lower()
    rejected = ('access denied', 'err_blocked', 'checking your browser', 'just a moment', 'verify you are human', 'site can’t be reached', 'site cannot be reached')
    return status == 200 and len(text) >= 40 and not any(x in text[:500] for x in rejected) and any(k.lower() in text for k in keywords)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def prepare_derivatives(raw, destination, view):
    from PIL import Image
    destination.mkdir(parents=True, exist_ok=True)
    result = []
    with Image.open(raw) as image:
        image.load()
        widths = [w for w in (640, 960, 1600) if w <= image.width] or [image.width]
        for width in widths:
            target = destination / f'{view}-{width}.webp'
            height = round(image.height * width / image.width)
            image.convert('RGB').resize((width, height), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=90, method=6)
            result.append({'path': str(target), 'width': width, 'height': height, 'sha256': sha(target)})
    return result


def timestamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def capture(project_ids, output, executable=None):
    from playwright.sync_api import sync_playwright
    from PIL import Image
    manifest_path = ROOT / 'assets/portfolio/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'version': 1, 'projects': []}
    records = {p['id']: p for p in manifest['projects']}
    attempt_log = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
        try:
            for project_id in project_ids:
                info = PROJECTS[project_id]; captures = []; error = None
                context = browser.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
                # Capture never submits forms or sends modifying API requests.
                context.route('**/*', lambda route: route.continue_() if route.request.method in ('GET', 'HEAD', 'OPTIONS') else route.abort())
                page = context.new_page()
                try:
                    response = page.goto(info['url'], wait_until='domcontentloaded', timeout=30000)
                    status = response.status if response else 0
                    page.wait_for_timeout(3500)
                    page.evaluate('Promise.race([document.fonts.ready, new Promise(r=>setTimeout(r,5000))])')
                    page.evaluate('Promise.race([Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,5000))])')
                    if not valid_page(page.locator('body').inner_text(), status, info['keywords']):
                        raise RuntimeError('The live page could not be verified; no screenshot accepted.')
                    if urlparse(page.url).hostname.removeprefix('www.') != urlparse(info['url']).hostname.removeprefix('www.'):
                        raise RuntimeError('Unexpected destination; no screenshot accepted.')
                    for view in ('desktop', 'secondary', 'mobile'):
                        viewport = {'width': 390, 'height': 844} if view == 'mobile' else {'width': 1600, 'height': 1000}
                        if view == 'secondary':
                            height = page.evaluate('document.documentElement.scrollHeight')
                            page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', min(950, max(0, height - 1000)))
                        elif view == 'mobile':
                            page.set_viewport_size(viewport)
                            page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
                        page.wait_for_timeout(1800)
                        raw = output / project_id / f'{view}.png'; raw.parent.mkdir(parents=True, exist_ok=True)
                        page.screenshot(path=str(raw), full_page=False)
                        with Image.open(raw) as image:
                            image.load()
                            if image.size != (viewport['width'], viewport['height']): raise RuntimeError('Unexpected capture dimensions')
                        dest = ROOT / 'assets/portfolio' / project_id; dest.mkdir(parents=True, exist_ok=True)
                        public = dest / f'{view}.png'; shutil.copy2(raw, public)
                        derivatives = prepare_derivatives(raw, dest, view)
                        for variant in derivatives: variant['path'] = Path(variant['path']).relative_to(ROOT).as_posix()
                        captures.append({'view': view, 'status': 'captured', 'sourceUrl': info['url'], 'finalUrl': page.url, 'capturedAt': timestamp(), 'viewport': viewport, 'deviceScale': 1, 'path': public.relative_to(ROOT).as_posix(), 'sha256': sha(public), 'rawSha256': sha(raw), 'alt': f"{info['name']} — real {view} website capture", 'httpStatus': status, 'contentVerified': True, 'method': 'Playwright Chromium page.screenshot', 'variants': derivatives})
                    records[project_id] = {'id': project_id, 'name': info['name'], 'url': info['url'], 'status': 'captured', 'captures': captures}
                    print(f'{project_id}: saved 3 actual captures. Inspect them before publishing.')
                except Exception as exc:
                    error = str(exc).splitlines()[0]
                    previous = records.get(project_id)
                    if not previous or previous.get('status') != 'captured': records[project_id] = {'id': project_id, 'name': info['name'], 'url': info['url'], 'status': 'pending-capture', 'captures': [], 'limitation': 'Browser capture was not available. Run the local capture tool in an authorized environment.'}
                    print(f'{project_id}: NOT CAPTURED — {error}', file=sys.stderr)
                finally:
                    attempt_log.append({'project': project_id, 'attemptedAt': timestamp(), 'success': error is None, 'error': error})
                    context.close()
                if error and 'ERR_BLOCKED_BY_ADMINISTRATOR' in error:
                    print('Browser policy blocks navigation. Stopping; no attempt to bypass it.', file=sys.stderr)
                    break
        finally:
            browser.close()
    manifest['projects'] = [records.get(i, {'id': i, **{k:v for k,v in info.items() if k in ('name','url')}, 'status':'pending-capture', 'captures':[]}) for i,info in PROJECTS.items()]
    manifest['updatedAt'] = timestamp()
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'attempts.json').write_text(json.dumps(attempt_log, indent=2) + '\n')
    return all(p.get('status') == 'captured' for p in manifest['projects'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', choices=['all', *PROJECTS], default='all')
    parser.add_argument('--output', type=Path, default=ROOT/'evidence/portfolio/raw')
    parser.add_argument('--executable', help='Optional existing Chrome/Chromium executable; no browser security policy is changed')
    args = parser.parse_args()
    try: ok = capture(list(PROJECTS) if args.project == 'all' else [args.project], args.output.resolve(), args.executable)
    except Exception as error:
        print(f'Capture unavailable: {error}\nInstall requirements-dev.txt and an authorized Playwright Chromium browser. No screenshots were fabricated.', file=sys.stderr); return 1
    return 0 if ok else 1

if __name__ == '__main__': sys.exit(main())
