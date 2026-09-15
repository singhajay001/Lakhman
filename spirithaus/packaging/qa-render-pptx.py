"""Render a .pptx to PNG by reading the packaged XML -- independent QA of what
actually shipped (positions, sizes, fills, images, text), not of the generator."""
import zipfile, re, sys, os, io
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p':'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
EMU=914400.0
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def load(p): return ImageFont.truetype(p, 10)

def render(path, outdir, scale=150/72.0):
    z=zipfile.ZipFile(path)
    pres=ET.fromstring(z.read('ppt/presentation.xml'))
    sz=pres.find('p:sldSz',NS)
    PW,PH=int(sz.get('cx')),int(sz.get('cy'))
    W,H=int(PW/EMU*72*scale),int(PH/EMU*72*scale)
    slides=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)],
                  key=lambda s:int(re.search(r'(\d+)',s.split('/')[-1]).group(1)))
    out=[]
    for si,sn in enumerate(slides,1):
        rels={}
        rp='ppt/slides/_rels/'+sn.split('/')[-1]+'.rels'
        if rp in z.namelist():
            for r in ET.fromstring(z.read(rp)):
                rels[r.get('Id')]=r.get('Target').replace('../','ppt/')
        root=ET.fromstring(z.read(sn))
        # slide background
        bg=(255,255,255)
        b=root.find('.//p:bg//a:srgbClr',NS)
        if b is not None: bg=tuple(int(b.get('val')[i:i+2],16) for i in (0,2,4))
        im=Image.new('RGB',(W,H),bg); dr=ImageDraw.Draw(im,'RGBA')
        tree=root.find('.//p:cSld/p:spTree',NS)
        for el in tree:
            tag=el.tag.split('}')[1]
            if tag not in ('sp','pic'): continue
            xfrm=el.find('.//a:xfrm',NS)
            if xfrm is None: continue
            off,ext=xfrm.find('a:off',NS),xfrm.find('a:ext',NS)
            if off is None or ext is None: continue
            x=int(off.get('x'))/EMU*72*scale; y=int(off.get('y'))/EMU*72*scale
            w=int(ext.get('cx'))/EMU*72*scale; h=int(ext.get('cy'))/EMU*72*scale
            if tag=='pic':
                emb=el.find('.//a:blip',NS)
                rid=emb.get('{%s}embed'%NS['r']) if emb is not None else None
                tgt=rels.get(rid)
                if tgt and tgt in z.namelist():
                    pic=Image.open(io.BytesIO(z.read(tgt))).convert('RGBA')
                    pic=pic.resize((max(1,int(w)),max(1,int(h))),Image.LANCZOS)
                    alpha=el.find('.//a:alphaModFix',NS)
                    if alpha is not None:
                        a=int(alpha.get('amt'))/100000.0
                        ch=pic.split()[3].point(lambda v:int(v*a)); pic.putalpha(ch)
                    im.paste(pic,(int(x),int(y)),pic)
                continue
            geom=el.find('.//a:prstGeom',NS)
            gt=geom.get('prst') if geom is not None else 'rect'
            fill=el.find('.//p:spPr/a:solidFill/a:srgbClr',NS)
            ln=el.find('.//p:spPr/a:ln',NS)
            lnc=ln.find('.//a:srgbClr',NS) if ln is not None else None
            fc=tuple(int(fill.get('val')[i:i+2],16) for i in (0,2,4)) if fill is not None else None
            lc=tuple(int(lnc.get('val')[i:i+2],16) for i in (0,2,4)) if lnc is not None else None
            lwpx=max(1,int(int(ln.get('w','12700'))/12700*scale)) if ln is not None else 1
            if gt=='line':
                dr.line([x,y,x+w,y+h], fill=lc or (0,0,0), width=lwpx)
            elif gt=='ellipse':
                dr.ellipse([x,y,x+w,y+h], fill=fc, outline=lc, width=lwpx)
            else:
                if fc: dr.rectangle([x,y,x+w,y+h], fill=fc)
                if lc: dr.rectangle([x,y,x+w,y+h], outline=lc, width=lwpx)
            # text
            ty=y
            for para in el.findall('.//a:p',NS):
                runs=para.findall('a:r',NS)
                if not runs: continue
                txt=''.join((r.find('a:t',NS).text or '') for r in runs)
                rPr=runs[0].find('a:rPr',NS)
                pts=int(rPr.get('sz','1800'))/100.0 if rPr is not None else 18.0
                bold=(rPr is not None and rPr.get('b')=='1')
                cl=runs[0].find('.//a:srgbClr',NS)
                col=tuple(int(cl.get('val')[i:i+2],16) for i in (0,2,4)) if cl is not None else (0,0,0)
                spc=int(rPr.get('spc','0'))/100.0 if rPr is not None else 0
                f=ImageFont.truetype(FONTB if bold else FONT, max(6,int(pts*scale)))
                algn=para.find('a:pPr',NS)
                al=algn.get('algn') if algn is not None else None
                adv=lambda t: dr.textlength(t,font=f)+spc*scale*max(0,len(t)-1)
                lines,cur=[],''                      # wrap to the shape width
                for word in txt.split(' '):
                    t=(cur+' '+word).strip()
                    if cur and adv(t)>w: lines.append(cur); cur=word
                    else: cur=t
                if cur: lines.append(cur)
                for ln_ in lines:
                    tw=adv(ln_)
                    tx=x+(w-tw)/2 if al=='ctr' else (x+w-tw if al=='r' else x)
                    cx=tx
                    for ch in ln_:                   # manual tracking
                        dr.text((cx,ty),ch,font=f,fill=col); cx+=dr.textlength(ch,font=f)+spc*scale
                    ty+=pts*scale*1.35
        p=os.path.join(outdir,'deck-%d.png'%si); im.save(p); out.append(p)
    return out

if __name__=='__main__':
    for p in render(sys.argv[1], sys.argv[2]): print(p)
