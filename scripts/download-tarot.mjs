import {mkdir, writeFile, readFile} from 'node:fs/promises';
import sharp from 'sharp';

const base = 'https://raw.githubusercontent.com/sixseeds/tarot-api/main/';
const metadata = await fetch(base + 'cards.json');
if (!metadata.ok) throw Error('Cannot fetch card manifest');
const cards = await metadata.json();
if (cards.length !== 78) throw Error('Expected 78 cards');
const destination = new URL('../public/images/tarot/', import.meta.url);
await mkdir(destination, {recursive: true});
async function download(card) {
  const filename = new URL(card.image).pathname.split('/').pop();
  if (!/^(ar|wa|cu|sw|pe)\d{2}\.jpg$/.test(filename)) throw Error('Unexpected filename');
  let bytes;
  try { bytes = await readFile(new URL(filename, destination)); }
  catch {
    const response = await fetch(base + 'cards/' + filename);
    if (!response.ok) throw Error(`${filename}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error(`${filename}: not JPEG`);
  await writeFile(new URL(filename, destination), await sharp(bytes).resize({width:420,withoutEnlargement:true}).jpeg({quality:85}).toBuffer());
  console.log(filename, bytes.length);
}
const queue = [...cards];
await Promise.all(Array.from({length:4}, async () => {
  while (queue.length) await download(queue.shift());
}));
