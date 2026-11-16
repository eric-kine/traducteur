import fs from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';

/**
 * Conversion HTML → PDF avec Chromium (Puppeteer).
 *  - un seul navigateur lancé à la demande puis réutilisé ;
 *  - JavaScript désactivé et accès réseau bloqué dans la page : le gabarit
 *    ne peut rien charger de l'extérieur (sécurité + rendu identique partout).
 * Chemin du navigateur : variable CHROMIUM_PATH, sinon emplacements usuels.
 */
const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
].filter(Boolean) as string[];

let browserPromise: Promise<Browser> | null = null;

function executablePath() {
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chromium introuvable : définissez CHROMIUM_PATH dans .env');
  return found;
}

function getBrowser() {
  browserPromise ??= puppeteer
    .launch({ executablePath: executablePath(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] })
    .then((b) => {
      b.on('disconnected', () => (browserPromise = null));
      return b;
    })
    .catch((e) => {
      browserPromise = null;
      throw e;
    });
  return browserPromise;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => (req.url().startsWith('data:') ? req.continue() : req.abort()));
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function closePdfBrowser() {
  if (browserPromise) await (await browserPromise).close().catch(() => {});
}
