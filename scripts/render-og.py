"""Generate the checked-in social preview using the real Detroit geometry (no logos/assets)."""
from pathlib import Path
import math, json, random
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
S=2
im=Image.new('RGB',(1200*S,630*S),'#f7f5ef');d=ImageDraw.Draw(im)
font='/System/Library/Fonts/Helvetica.ttc'
def txt(x,y,t,size,color):d.text((x*S,y*S),t,font=ImageFont.truetype(font,size*S),fill=color)
def pt(x,y,z):return ((640+(x*.76-z*.9)*5)*S,(420+(x*.35+z*.3)*5-y*5)*S)
poly=[pt(-60,0,-26.65),pt(60,0,-26.65),pt(60,0,26.65),pt(-60,0,26.65)]
d.polygon(poly,fill='#e8ece4',outline='#bcc7b7')
for x in range(-50,51,5):d.line([pt(x,0,-26.65),pt(x,0,26.65)],fill='#c4cec0',width=1*S)
plays=json.loads((root/'public/data/2025/DET.json').read_text())['touchdowns']
for p in plays:
 r=random.Random(p['id']);x=p['geometry']['losX'];start=(r.random()-.5)*12;end={'left':-17,'middle':0,'right':17}.get(p['location'],0)+(r.random()-.5)*10
 catch=p['geometry']['catchX'];finish=catch if catch is not None else 50
 points=[]
 for i in range(65):
  t=i/64;h=(2.1+8.4*(1-math.exp(-max(0,finish-x)/27)))*2.3*t*(1-t) if p['type']=='pass' else .2
  points.append(pt(x+(finish-x)*t,h,start+(end-start)*t))
 d.line(points,fill='#247eac' if p['type']=='pass' else '#839484',width=1*S)
 if catch is not None and catch!=50:d.line([pt(catch,.2,end),pt(50,.2,end+2)],fill='#598e89',width=S)
txt(58,38,'EVERY TOUCHDOWN',16,'#344536')
txt(58,112,'DETROIT LIONS',30,'#252d29');txt(58,153,'2025',58,'#252d29')
txt(60,563,'32 TEAMS. 10 SEASONS. EVERY TOUCHDOWN.',14,'#68785f')
im.resize((1200,630),Image.Resampling.LANCZOS).save(root/'public/og-preview.png')
