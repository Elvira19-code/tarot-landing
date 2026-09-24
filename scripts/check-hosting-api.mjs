const origin = process.env.SITE_URL || 'https://taroway.com';
if (new URL(origin).protocol !== 'https:') throw Error('SITE_URL must use HTTPS');
async function json(path) {
  const response = await fetch(new URL(path, origin), {signal: AbortSignal.timeout(20000), cache:'no-store'});
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error(`Host API unavailable at ${path}: HTTP ${response.status}. Deploy the Node server and route /api/ before publishing forms.`);
  return response.json();
}
const catalog = await json('/api/catalog');
if (catalog.mode !== 'requests') throw Error('Production must run PAYMENT_MODE=requests');
const availability = await json('/api/availability');
if (!Array.isArray(availability.times) || typeof availability.accepting !== 'boolean' || availability.timezone !== 'Europe/Moscow') throw Error('Invalid calendar API response');
if (process.argv.includes('--release')) {
  const release = await json('/release.json?check=' + Date.now());
  if (!process.env.GITHUB_SHA || release.revision !== process.env.GITHUB_SHA) throw Error('Hosted revision does not match the published commit');
}
console.log('Hosting API verified');
