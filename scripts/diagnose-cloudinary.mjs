import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

console.log('cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('api_key:', process.env.CLOUDINARY_API_KEY);
console.log('secret set:', Boolean(process.env.CLOUDINARY_API_SECRET));

try {
  const ping = await cloudinary.api.ping();
  console.log('ping:', ping.status);
} catch (e) {
  console.error('ping FAIL', e.http_code, e.message);
}

const intentos = [
  { label: 'sin folder', opts: { resource_type: 'image' } },
  { label: 'folder ZyraEnterprise', opts: { folder: 'ZyraEnterprise', resource_type: 'image' } },
  { label: 'public_id con path', opts: { public_id: 'ZyraEnterprise/test-diagnose', resource_type: 'image', overwrite: true } }
];

for (const { label, opts } of intentos) {
  try {
    const r = await cloudinary.uploader.upload(`data:image/png;base64,${PNG}`, opts);
    console.log(`upload ${label}: OK`, r.secure_url);
  } catch (e) {
    console.error(`upload ${label}: FAIL`, e.http_code, e.message, e.error || '');
  }
}
