import { defineConfig } from 'astro/config';
const site = process.env.SITE_URL || 'https://taroway.com';
if (site) {
  const url = new URL(site);
  if (!['https:', 'http:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/' || url.search || url.hash) throw new Error('SITE_URL must be a public origin, such as https://example.ru');
}
export default defineConfig({ site, output: 'static', devToolbar: { enabled: false } });
