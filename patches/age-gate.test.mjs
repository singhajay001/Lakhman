import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const liquid = readFileSync('/home/user/Lakhman/sections/spirithaus-age-gate.liquid','utf8');
const script = liquid.match(/<script>([\s\S]*?)<\/script>/)[1];

// Hand-render the Liquid the way Shopify would, with schema defaults.
const markup = `
<a class="skip-to-content-link" href="#MainContent">Skip</a>
<main id="MainContent"><a href="/shop" id="outsideLink">Shop</a></main>
<div class="sh-age-gate" id="ShAgeGate" role="dialog" aria-modal="true"
     data-cookie-days="30" data-exit-url="https://drinkwise.org.au">
  <div class="sh-age-gate__panel">
    <h2 id="ShAgeGateHeading">Are you over <strong>18</strong>?</h2>
    <button type="button" class="button sh-age-gate__confirm" data-sh-age-confirm>Yes</button>
    <button type="button" class="sh-age-gate__decline" data-sh-age-decline>No</button>
  </div>
</div>`;

function boot(cookie='') {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`,
    { url: 'https://spirithaus.com.au/products/gin', pretendToBeVisual: true,
      runScripts: 'dangerously' });
  if (cookie) dom.window.document.cookie = cookie;
  const el = dom.window.document.createElement('script');
  el.textContent = script;
  dom.window.document.body.appendChild(el);
  return dom;
}
const results = [];
const t = (name, cond) => results.push([name, !!cond]);

// --- First visit ---
let dom = boot();
let d = dom.window.document;
t('gate present on first visit', d.getElementById('ShAgeGate'));
t('html gets sh-age-locked', d.documentElement.classList.contains('sh-age-locked'));
t('focus starts on confirm button', d.activeElement === d.querySelector('[data-sh-age-confirm]'));

// focus trap: something outside tries to take focus
d.getElementById('outsideLink').focus();
t('focus pulled back into dialog', d.getElementById('ShAgeGate').contains(d.activeElement));

// Escape must NOT dismiss
d.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
t('Escape does not dismiss', d.getElementById('ShAgeGate'));

// --- Confirm ---
d.querySelector('[data-sh-age-confirm]').click();
t('gate removed after confirm', !d.getElementById('ShAgeGate'));
t('cookie set', d.cookie.includes('sh_age_ok=1'));
t('sh-age-verified added', d.documentElement.classList.contains('sh-age-verified'));
t('REAL BUG FIXED: sh-age-locked removed, page scrollable again', !d.documentElement.classList.contains('sh-age-locked'));

// BUG2: after dismissal the page must be focusable again
d.getElementById('outsideLink').focus();
t('focus works after dismiss (was never broken; listener now detached for hygiene)', d.activeElement === d.getElementById('outsideLink'));

// --- Return visit ---
dom = boot('sh_age_ok=1'); d = dom.window.document;
t('gate removed for returning visitor', !d.getElementById('ShAgeGate'));
t('no lock class on return visit', !d.documentElement.classList.contains('sh-age-locked'));

const pass = results.filter(r=>r[1]).length;
for (const [n,ok] of results) console.log(`  ${ok?'PASS':'FAIL'}  ${n}`);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
