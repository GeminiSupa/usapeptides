"""Original procedural microscopy artwork. 24s seamless H.264 loop, no audio.
Run: python scripts/render-biotech.py (Pillow, numpy, imageio-ffmpeg required).
"""
import sys, math, random, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/video'))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import imageio_ffmpeg

W, H, FPS, SECONDS = 1280, 720, 24, 24
OUT = ROOT / 'public/videos'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(52)

def sphere(radius, cell=False):
    n = radius * 2 + 8
    yy, xx = np.mgrid[:n, :n].astype(float)
    x, y = (xx-n/2)/radius, (yy-n/2)/radius
    r = np.sqrt(x*x+y*y)
    z = np.sqrt(np.maximum(0, 1-r*r))
    rim = np.exp(-((r-.92)/.045)**2)
    shine = np.exp(-((x+.35)**2+(y+.4)**2)/.07)
    light = .15 + .6*z + .85*shine
    a = np.zeros((n,n,4))
    for k, c in enumerate([45,155,165]):
        a[:,:,k] = np.clip(c*light + rim*50,0,255)
    a[:,:,3] = np.where(r<1, (35+rim*125+shine*75) if cell else 245,0)
    return Image.fromarray(a.astype('uint8')).filter(ImageFilter.GaussianBlur(.7 if cell else .35))

cells = [(rng.uniform(-80,W+80),rng.uniform(-60,H+60),rng.randint(35,115),rng.random()*6.28) for _ in range(15)]
sprites = {r:sphere(r,True) for _,_,r,_ in cells}
atoms = [(i*57, math.sin(i*1.2)*67, math.cos(i*.8)*30) for i in range(11)]
yy,xx=np.mgrid[:180,:320].astype(float)
x,y=xx/320,yy/180
proc = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'biotech-hero.mp4')],stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
for frame in range(FPS*SECONDS):
    t=2*math.pi*frame/(FPS*SECONDS)
    wave=np.sin(x*10+y*5+np.sin(t))*.5+np.sin(y*9-x*4+np.cos(t))*.5
    caustic=np.exp(-((np.sin(x*7+y*4+np.sin(t)*.4)+np.cos(y*8-x*3+np.cos(t)*.4))/.14)**2)
    b=np.zeros((180,320,3))
    for k,(base,amp) in enumerate([(5,3),(24,13),(29,18)]): b[:,:,k]=base+amp*(wave+1)+caustic*(4 if k==0 else 14)
    im=Image.fromarray(np.clip(b,0,255).astype('uint8')).resize((W,H),Image.Resampling.BICUBIC).convert('RGBA')
    for cx,cy,r,p in cells:
        im.alpha_composite(sprites[r],(int(cx+25*math.sin(t+p)-r),int(cy+18*math.cos(t+p)-r)))
    # Two oblique molecular chains, with shaded spheres and cylindrical bonds.
    for ox,oy,angle in [(-80,210,.62),(760,390,-.85)]:
        points=[]
        for ax,ay,az in atoms:
            ay=ay*math.cos(.22*math.sin(t))+az*math.sin(.22*math.sin(t))
            points.append((ox+ax*math.cos(angle)-ay*math.sin(angle)+15*math.sin(t),oy+ax*math.sin(angle)+ay*math.cos(angle)+12*math.cos(t)))
        d=ImageDraw.Draw(im)
        for a,bp in zip(points,points[1:]):
            d.line([a,bp],fill=(20,65,72),width=12)
            d.line([(a[0]-2,a[1]-2),(bp[0]-2,bp[1]-2)],fill=(62,125,132),width=4)
        for i,(px,py) in enumerate(points):
            r=17+(i%3)*4
            im.alpha_composite(sphere(r),(int(px-r-4),int(py-r-4)))
    im=im.convert('RGB')
    if frame==0: im.save(OUT/'biotech-poster.jpg',quality=88)
    proc.stdin.write(im.tobytes())
    if frame%144==0: print(f'Rendered {frame//FPS}s',flush=True)
proc.stdin.close()
if proc.wait()!=0: raise RuntimeError('Video encoding failed')
print('Created', OUT/'biotech-hero.mp4',flush=True)
