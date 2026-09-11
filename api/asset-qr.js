import QRCode from 'qrcode';

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || 'https://harmas-asset-management.vercel.app').replace(/\/$/, '');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const token = Array.isArray(request.query.token) ? request.query.token[0] : request.query.token;
  const rawCode = Array.isArray(request.query.code) ? request.query.code[0] : request.query.code;

  if (!token || !UUID_PATTERN.test(token)) {
    return response.status(400).json({ message: 'Token QR tidak valid' });
  }

  const safeCode = String(rawCode || 'ASET').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);

  try {
    const png = await QRCode.toBuffer(`${PUBLIC_APP_URL}/scan/assets/${token}`, {
      type: 'png',
      errorCorrectionLevel: 'Q',
      margin: 4,
      width: 1200
    });

    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Content-Disposition', `attachment; filename="QR-${safeCode}.png"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).send(png);
  } catch (error) {
    return response.status(500).json({ message: 'Gagal membuat QR Code' });
  }
}
