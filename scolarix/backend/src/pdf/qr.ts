import QRCode from 'qrcode';

/** QR code en SVG vectoriel (intégré dans le HTML : aucune image externe). */
export const qrSvg = (text: string) =>
  QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#ffffff' } });
