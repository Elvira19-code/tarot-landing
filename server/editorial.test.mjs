import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles,faq} from '../src/data/editorial.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('two complete supplied articles and 23 FAQ answers are present',()=>{
 assert.equal(articles.length,2);
 assert.equal(faq.sections.length,5);
 assert.equal(faq.sections.flatMap(s=>s.questions).length,23);
 for(const a of articles){
  assert.ok(a.title.includes('Точка ясности'));
  assert.ok(a.keywords);
  assert.ok(a.blocks.length>20);
  assert.ok(a.blocks.some(b=>b.type==='list'));
 }
 for(const section of faq.sections)for(const item of section.questions){
  assert.ok(item.question.endsWith('?'));
  assert.ok(item.answer.length>20);
 }
});
test('editorial pages are linked and included in the sitemap',()=>{
 const layout=read('src/layouts/Layout.astro');
 for(const path of ['/articles/','/faq/'])assert.ok(layout.includes(path));
 assert.ok(read('src/pages/sitemap.xml.ts').includes('articles.map'));
 assert.ok(read('src/pages/sitemap.xml.ts').includes("'/faq/'"));
 assert.ok(read('src/pages/faq.astro').includes('faq.sections.flatMap'));
 assert.ok(read('src/pages/articles/[slug].astro').includes("datePublished:'2026-10-07'"));
 assert.ok(layout.includes('structuredData'));
 assert.ok(layout.includes('Кельина Эльвира Рустемовна'));
});
