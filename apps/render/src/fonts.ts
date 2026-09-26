import { continueRender, delayRender, staticFile } from 'remotion';

/**
 * The two licensed faces, served locally.
 *
 * Both are SIL OFL 1.1 and the licence texts travel with them (public/fonts/*-OFL.txt), which
 * is what the licence requires. Nothing here reaches a font CDN: this environment's network
 * policy would refuse it, and a render that silently substituted a fallback would measure the
 * wrong type — which is exactly the defect the storefront harness found in itself.
 */
let injected = false;

export function ensureFonts(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;

  const handle = delayRender('Loading the SPIRITHAUS faces');
  const style = document.createElement('style');
  style.textContent = `
@font-face {
  font-family: 'Archivo';
  src: url('${staticFile('fonts/archivo-latin.woff2')}') format('woff2');
  font-weight: 100 900;
  font-display: block;
}
@font-face {
  font-family: 'Space Mono';
  src: url('${staticFile('fonts/spacemono-latin.woff2')}') format('woff2');
  font-weight: 400;
  font-display: block;
}`;
  document.head.appendChild(style);

  void document.fonts.load('900 64px Archivo').then(() =>
    document.fonts.load('400 24px "Space Mono"').then(() => {
      continueRender(handle);
    }),
  );
}

/**
 * Whether the faces are actually present, rather than whether loading settled.
 *
 * `document.fonts.check()` answers the second question, which is how the storefront harness
 * came to report "fonts loaded" while measuring substitutes. This measures a probe string
 * against a fallback and compares widths.
 */
export function facesPresent(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return false;

  const probe = 'SPIRITHAUS 0123456789';
  const measure = (family: string): number => {
    context.font = `900 64px ${family}`;
    return context.measureText(probe).width;
  };

  const fallback = measure('monospace');
  const archivo = measure('Archivo, monospace');
  return Math.abs(archivo - fallback) > 0.5;
}
