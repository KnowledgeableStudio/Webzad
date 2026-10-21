#!/usr/bin/env python3
"""Create optimized derivatives of original Webzad assets without modifying originals."""
import hashlib, json, subprocess
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parents[1]

def main():
    dest=ROOT/'assets/media';dest.mkdir(parents=True,exist_ok=True)
    evidence=ROOT/'evidence/media';evidence.mkdir(parents=True,exist_ok=True)
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'Background.mp4',ROOT/'assets/logo-inRUI44V.png',ROOT/'assets/zada-avatar.jpg',ROOT/'assets/zada.glb']}
    commands=[]
    def run(args):
        commands.append(args);subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    frame=evidence/'original-frame.png'
    run(['ffmpeg','-y','-hide_banner','-loglevel','error','-ss','3.0','-i',str(ROOT/'Background.mp4'),'-frames:v','1','-update','1',str(frame)])
    with Image.open(frame) as im:
        im.save(dest/'hero-poster.webp','WEBP',quality=90,method=6)
        im.resize((960,540),Image.Resampling.LANCZOS).save(dest/'hero-poster-mobile.webp','WEBP',quality=89,method=6)
        ImageOps.fit(im,(1200,630),method=Image.Resampling.LANCZOS).save(dest/'social-preview.jpg','JPEG',quality=90,optimize=True)
    for name,width,quality in [('hero-desktop.mp4',1600,'26'),('hero-mobile.mp4',960,'28')]:
        run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(ROOT/'Background.mp4'),'-an','-vf',f'scale={width}:-2','-c:v','libx264','-preset','medium','-crf',quality,'-pix_fmt','yuv420p','-movflags','+faststart',str(dest/name)])
    for source,name,width in [('assets/logo-inRUI44V.png','logo-192.webp',192),('assets/zada-avatar.jpg','zada-portrait.webp',480),('assets/work-professional-services-B68gLSwb.png','study-services.webp',960),('assets/work-hospitality-lifestyle-BOhuuqm2.png','study-hospitality.webp',960),('assets/work-growth-campaigns-CwnhtZED.png','study-growth.webp',960),('assets/automation-visual.jpg','automation.webp',1280)]:
        with Image.open(ROOT/source) as im:
            im.thumbnail((width,width),Image.Resampling.LANCZOS);im.save(dest/name,'WEBP',quality=89,method=6)
    for source,value in hashes.items():
        assert hashlib.sha256((ROOT/source).read_bytes()).hexdigest()==value,source+' changed unexpectedly'
    report={'immutableOriginalHashes':hashes,'commands':commands,'outputs':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(dest.iterdir())]}
    (evidence/'derivatives.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({p['path']:p['bytes'] for p in report['outputs']},indent=2))

if __name__=='__main__':main()
