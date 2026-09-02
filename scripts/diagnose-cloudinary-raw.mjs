import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const timestamp = Math.round(Date.now() / 1000);
const paramsToSign = `timestamp=${timestamp}${apiSecret}`;
const crypto = await import('crypto');
const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

const body = new URLSearchParams({
  file: `data:image/png;base64,${PNG}`,
  api_key: apiKey,
  timestamp: String(timestamp),
  signature
});

const options = {
  hostname: 'api.cloudinary.com',
  path: `/v1_1/${cloudName}/image/upload`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body.toString())
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (c) => { data += c; });
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    console.log('Body:', data);
  });
});

req.on('error', console.error);
req.write(body.toString());
req.end();
