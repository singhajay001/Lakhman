/* SPIRITHAUS — A4 editable deck (PowerPoint / Google Slides)
   Bands, rules and every line of copy are native objects; only the wordmark,
   handling icons and the U mark are images, as a logo should be. */
const pptxgen = require('pptxgenjs');
const path = require('path');
const A = f => path.join(__dirname, 'assets', f);

const INK='111110', BONE='F2EFE9', RED='CF1C29';
const M  = mm => mm/25.4;                 // mm -> inches
const PT = mm => +(mm*2.8346).toFixed(1); // mm -> points
const PAD = 14, W = 210, H = 297, RIGHT = W-PAD, CW = W-PAD*2;

// alpha blends, precomputed (pptxgenjs hex cannot carry alpha)
const mix=(fg,bg,a)=>{const h=s=>[0,2,4].map(i=>parseInt(s.substr(i,2),16));
  const f=h(fg),b=h(bg);return f.map((v,i)=>Math.round(v*a+b[i]*(1-a)))
  .map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();};

const pres = new pptxgen();
pres.defineLayout({ name:'A4P', width:M(W), height:M(H) });
pres.layout = 'A4P';                       // must precede addSlide
pres.author='SPIRITHAUS'; pres.title='SPIRITHAUS — Box Label & Artwork';

const TX = { isTextBox:true, margin:0, fontFace:'Archivo' };
const MONO = { isTextBox:true, margin:0, fontFace:'Space Mono' };

function label(variant){
  const bone = variant==='bone';
  const sheet = bone?BONE:INK, body = bone?INK:BONE;
  const bandBg = bone?INK:BONE, bandFg = bone?BONE:INK;   // header inverts
  const wm   = bone?'wordmark-white.png':'wordmark-ink.png';
  const icon = c => A(c + (bone?'-ink.png':'-white.png'));
  const uMark= bone?'mark-ink.png':'mark-white.png';
  const rule = mix(body,sheet,.22), ruleS = mix(body,sheet,.55), mute = mix(body,sheet,.52);

  const s = pres.addSlide();
  s.background = { color: sheet };
  s.addNotes(`SPIRITHAUS A4 box label — ${variant} variant. 210 x 297mm.
Every band, rule and line of copy is editable. The wordmark, handling icons and U
mark are placed images. Replace [STREET ADDRESS] / [POSTCODE] / [PHONE] / [EMAIL],
and confirm the Liquor Act wording with your licensing advisor before printing.`);

  /* header band */
  s.addShape('rect',{x:0,y:0,w:M(W),h:M(50),fill:{color:bandBg},line:{width:0}});
  s.addImage({path:A(wm), x:M(PAD), y:M(16), w:M(98.9), h:M(10)});
  s.addText('SPIRITS  ·  WINE  ·  COCKTAILS',{...MONO,x:M(PAD),y:M(29),w:M(110),h:M(5),
    fontSize:PT(2.55),charSpacing:PT(1.28),color:mix(bandFg,bandBg,.62),valign:'top'});
  // carton counter
  s.addShape('rect',{x:M(RIGHT-34),y:M(15),w:M(34),h:M(20),fill:{type:'none'},
    line:{color:mix(bandFg,bandBg,.38),width:1.3}});
  s.addText('CARTON',{...MONO,x:M(RIGHT-34),y:M(18),w:M(34),h:M(4),align:'center',
    fontSize:PT(2.3),charSpacing:PT(.55),color:mix(bandFg,bandBg,.6)});
  s.addText('/',{...TX,x:M(RIGHT-34),y:M(23.5),w:M(34),h:M(8),align:'center',
    fontSize:PT(7),color:mix(bandFg,bandBg,.4)});
  [RIGHT-31, RIGHT-13].forEach(x=>s.addShape('line',{x:M(x),y:M(31),w:M(9),h:0,
    line:{color:mix(bandFg,bandBg,.5),width:1.3}}));

  /* handling row */
  const third = CW/3, cells=[
    ['fragile','FRAGILE','Handle with care'],
    ['up','THIS WAY UP','Do not invert'],
    ['dry','KEEP DRY','Upright · away from heat']];
  const ICON_R={fragile:.565,up:.813,dry:.980};
  cells.forEach(([ic,strong,em],i)=>{
    const cx = PAD + third*i;
    const ih = 9, iw = ih*ICON_R[ic];
    s.addImage({path:icon(ic), x:M(cx+3+(9.4-iw)/2), y:M(57.5), w:M(iw), h:M(ih)});
    s.addText(strong,{...TX,x:M(cx+16),y:M(58.4),w:M(third-18),h:M(5),
      fontSize:PT(4),bold:true,charSpacing:PT(.16),color:body});
    s.addText(em.toUpperCase(),{...MONO,x:M(cx+16),y:M(64),w:M(third-17),h:M(4),
      fontSize:PT(2.15),charSpacing:PT(.28),color:mute});
    if(i) s.addShape('line',{x:M(cx),y:M(50),w:0,h:M(26),line:{color:rule,width:.8}});
  });
  s.addShape('line',{x:0,y:M(76),w:M(W),h:0,line:{color:rule,width:1.1}});

  /* age / ID band */
  s.addShape('rect',{x:0,y:M(76),w:M(W),h:M(18),fill:{color:RED},line:{width:0}});
  s.addShape('ellipse',{x:M(22.5),y:M(78.5),w:M(13),h:M(13),fill:{type:'none'},
    line:{color:'FFFFFF',width:1.9}});
  s.addText('18',{...TX,x:M(22.5),y:M(81.4),w:M(13),h:M(7),align:'center',
    fontSize:PT(8.4),bold:true,color:'FFFFFF'});
  s.addText('CONTAINS ALCOHOL · ID REQUIRED ON DELIVERY',{...TX,x:M(40),y:M(79.5),
    w:M(150),h:M(6),fontSize:PT(4.5),bold:true,charSpacing:PT(.34),color:'FFFFFF'});
  s.addText('MUST NOT BE LEFT UNATTENDED · DO NOT SUPPLY TO A MINOR OR AN INTOXICATED PERSON',
    {...MONO,x:M(40),y:M(86.5),w:M(160),h:M(5),fontSize:PT(2.4),charSpacing:PT(.34),
     color:'F3C6CA'});

  /* deliver to */
  s.addText([{text:'DELIVER TO ',options:{color:mute}},
             {text:'— ',options:{color:RED}},
             {text:'SIGNATURE REQUIRED',options:{color:mute}}],
    {...MONO,x:M(PAD),y:M(101),w:M(CW),h:M(5),fontSize:PT(2.95),bold:true,charSpacing:PT(1)});
  for(let k=1;k<=5;k++){
    const y = 110.2 + (67.8/5)*k;
    s.addShape('line',{x:M(PAD),y:M(y),w:M(CW),h:0,line:{color:ruleS,width:.9}});
  }

  /* meta row */
  s.addShape('line',{x:0,y:M(185),w:M(W),h:0,line:{color:rule,width:1.1}});
  s.addShape('line',{x:0,y:M(215),w:M(W),h:0,line:{color:rule,width:1.1}});
  const mw = CW/4;
  ['ORDER No.','DESPATCH DATE','ITEMS IN CARTON','PACKED BY'].forEach((t,i)=>{
    const cx = PAD + mw*i + (i?5:0);
    s.addText(t,{...MONO,x:M(cx),y:M(190),w:M(mw-6),h:M(4),fontSize:PT(2.4),
      charSpacing:PT(.68),color:mute});
    s.addShape('line',{x:M(cx),y:M(209),w:M(mw-11),h:0,line:{color:ruleS,width:.9}});
    if(i) s.addShape('line',{x:M(PAD+mw*i),y:M(185),w:0,h:M(30),line:{color:rule,width:.8}});
  });

  /* return address */
  s.addText('RETURN TO SENDER',{...MONO,x:M(PAD),y:M(220),w:M(90),h:M(4),
    fontSize:PT(2.6),bold:true,charSpacing:PT(.88),color:mute});
  s.addText('SPIRITHAUS',{...TX,x:M(PAD),y:M(226.5),w:M(90),h:M(5),
    fontSize:PT(3.5),bold:true,charSpacing:PT(.1),color:body});
  s.addText('[STREET ADDRESS]\nSYDNEY NSW [POSTCODE] AUSTRALIA\n[PHONE]  ·  [EMAIL]',
    {...MONO,x:M(PAD),y:M(232.5),w:M(110),h:M(16),fontSize:PT(2.5),lineSpacingMultiple:1.55,
     charSpacing:PT(.25),color:mute});
  s.addImage({path:A(uMark),x:M(RIGHT-23),y:M(219),w:M(22.7),h:M(23),transparency:86});

  /* footer */
  const fBg = bone?INK:BONE, fFg = bone?BONE:INK;
  s.addShape('rect',{x:0,y:M(259),w:M(W),h:M(38),fill:{color:fBg},line:{width:0}});
  s.addText('LIQUOR ACT 2007 (NSW)',{...MONO,x:M(PAD),y:M(264.5),w:M(90),h:M(4),
    fontSize:PT(2.35),bold:true,charSpacing:PT(.4),color:fFg});
  s.addText('It is against the law to sell or supply alcohol to, or to obtain alcohol on behalf of, a person under the age of 18 years.\nPhoto ID must be sighted on delivery. If no person aged 18 or over is present to receive and sign for this consignment, it must not be left — return to depot.',
    {...MONO,x:M(PAD),y:M(269),w:M(104),h:M(23),fontSize:PT(2.3),lineSpacingMultiple:1.7,
     charSpacing:PT(.13),color:mix(fFg,fBg,.74)});
  ['LICENCE No.','ABN','CONSIGNMENT'].forEach((t,i)=>{
    const y = 264.5 + i*6.2;
    s.addText(t,{...MONO,x:M(120),y:M(y),w:M(32),h:M(4),align:'right',
      fontSize:PT(2.3),charSpacing:PT(.28),color:mix(fFg,fBg,.74)});
    s.addShape('line',{x:M(155),y:M(y+3.6),w:M(41),h:0,
      line:{color:mix(fFg,fBg,.45),width:.9}});
  });
}

function artwork(variant){
  const bone = variant==='bone';
  const sheet = bone?BONE:INK, body = bone?INK:BONE;
  const s = pres.addSlide();
  s.background = { color: sheet };
  s.addNotes(`SPIRITHAUS A4 box artwork — ${variant} variant. 210 x 297mm.
The oversized U bleeds off the top and right edges as a quiet texture. No address
or despatch fields: this is the premium outer face, not the despatch label.`);

  s.addImage({path:A(bone?'mark-ink.png':'mark-white.png'),
    x:M(W-165), y:M(-20), w:M(260), h:M(263.7),
    transparency: bone?95:94.5});
  s.addText('SPECIALIST SPIRITS',{...MONO,x:M(20),y:M(20),w:M(70),h:M(4),
    fontSize:PT(2.6),charSpacing:PT(.78),color:mix(body,sheet,.42)});
  s.addText('EST. SYDNEY',{...MONO,x:M(W-90),y:M(20),w:M(70),h:M(4),align:'right',
    fontSize:PT(2.6),charSpacing:PT(.78),color:mix(body,sheet,.42)});

  s.addImage({path:A(bone?'wordmark-ink.png':'wordmark-white.png'),
    x:M((W-145.4)/2), y:M(129), w:M(145.4), h:M(14.7)});
  s.addText('SPIRITS  ·  WINE  ·  COCKTAILS',{...MONO,x:M(20),y:M(151),w:M(W-40),h:M(6),
    align:'center',fontSize:PT(3.4),charSpacing:PT(1.77),color:mix(body,sheet,.62)});
  s.addShape('rect',{x:M((W-16)/2),y:M(173),w:M(16),h:M(.9),fill:{color:RED},line:{width:0}});
  s.addText('SYDNEY  ·  AUSTRALIA',{...MONO,x:M(20),y:M(271),w:M(W-40),h:M(5),
    align:'center',fontSize:PT(2.8),charSpacing:PT(1.19),color:mix(body,sheet,.45)});
}

label('bone'); label('ink'); artwork('ink'); artwork('bone');
pres.writeFile({ fileName: path.join(__dirname,'dist','spirithaus-box-label-artwork-A4.pptx') })
  .then(f=>console.log('wrote',f));
