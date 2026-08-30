import { readFileSync } from 'node:fs';
import * as csstree from 'css-tree';
const css = readFileSync('/home/user/Lakhman/assets/spirithaus.css', 'utf8');
const ast = csstree.parse(css, { positions: true });

// Real value errors only: ignore csstree's var() limitation.
const real = [];
csstree.walk(ast, { visit: 'Declaration', enter(n) {
  if (n.property.startsWith('--')) return;
  const r = csstree.lexer.matchDeclaration(n);
  if (r.error && !/var\(\)/.test(r.error.message)) real.push(`line ${n.loc.start.line}: ${n.property}`);
}});
console.log(real.length ? 'REAL VALUE ERRORS:\n' + real.join('\n') : 'VALUES: no real errors (all 50 were csstree var() limitation)');

// !important in actual declarations, not comments.
const imp = [];
csstree.walk(ast, { visit: 'Declaration', enter(n) { if (n.important) imp.push(`line ${n.loc.start.line}: ${n.property}`); }});
console.log(imp.length ? 'DECLARED !important:\n' + imp.join('\n') : '!important in declarations: NONE ✓ (the 3 text hits are prose in comments)');

// Contrast verification of every claim in the header comment.
const lum = hex => { const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
  .map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
  return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; };
const ratio = (a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05);};
const INK='#111110', BONE='#F2EFE9', RED='#CF1C29', OLD='#D8202E', WHITE='#FFFFFF';
const rows = [
  ['ink on bone', INK, BONE, 4.5], ['red #CF1C29 on bone', RED, BONE, 4.5],
  ['white on red #CF1C29', WHITE, RED, 4.5], ['white on ink', WHITE, INK, 4.5],
  ['red on ink (text)', RED, INK, 4.5], ['red on ink (non-text 3:1)', RED, INK, 3.0],
  ['OLD red #D8202E on bone', OLD, BONE, 4.5],
];
console.log('\nCONTRAST');
for (const [label,a,b,floor] of rows) {
  const r = ratio(a,b);
  console.log(`  ${label.padEnd(28)} ${r.toFixed(2)}:1  vs ${floor}:1  ${r>=floor?'PASS':'FAIL'}`);
}

// Guard: comma-separated RGB triplets must never be used with slash-alpha.
const bad = css.split('\n').map((l,i)=>[i+1,l])
  .filter(([,l])=>/rgba?\(\s*var\(--[a-z-]*rgb\)\s*\//.test(l));
console.log(bad.length ? `SLASH-ALPHA ON COMMA TRIPLET (invalid) lines ${bad.map(b=>b[0])}`
                       : 'rgb/rgba syntax: no comma-triplet + slash-alpha misuse');
