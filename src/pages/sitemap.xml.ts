import type { APIRoute } from 'astro';
import { seo } from '../data/seo';
import { articles } from '../data/editorial.mjs';

export const GET: APIRoute = ({ site }) => {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const paths = [...Object.keys(seo), '/articles/', '/faq/', ...articles.map(article => '/articles/' + article.slug + '/')];
  const urls = site ? [...new Set(paths)].filter(path => path !== '/404/').map(path => `<url><loc>${escape(new URL(path, site).href)}</loc></url>`).join('') : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
