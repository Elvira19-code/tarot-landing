import test from 'node:test';
import assert from 'node:assert/strict';
import {shuffledDeck} from '../src/lib/tarot-shuffle.mjs';

test('78 unique cards, 22 majors spread through the deck, new order each run', () => {
  let previous = [];
  const positions = new Set();
  for (let run = 0; run < 100; run++) {
    const cards = shuffledDeck(previous);
    assert.deepEqual([...cards].sort((a,b)=>a-b), Array.from({length:78},(_,i)=>i));
    assert.notDeepEqual(cards, previous);
    const majors = cards.flatMap((id,index)=>id<22?[index]:[]);
    assert.equal(majors.length,22);
    assert.ok(majors[0] <= 3);
    assert.ok(majors.at(-1) >= 74);
    for(let i=1;i<majors.length;i++)assert.ok(majors[i]-majors[i-1]<=7);
    positions.add(cards.indexOf(0));
    previous=cards;
  }
  assert.ok(positions.size>10);
});
