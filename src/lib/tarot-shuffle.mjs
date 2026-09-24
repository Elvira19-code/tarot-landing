function randomIndex(bound) {
  const ceiling = 0x100000000 - (0x100000000 % bound);
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= ceiling);
  return value[0] % bound;
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffledDeck(previous = []) {
  const majors = shuffle(Array.from({length:22}, (_, i) => i));
  const minors = shuffle(Array.from({length:56}, (_, i) => i + 22));
  // One major per randomly ordered band of 3 or 4 cards prevents long clusters.
  const bands = shuffle([...Array(12).fill(4), ...Array(10).fill(3)]);
  const result = [];
  for (const size of bands) {
    const majorSlot = randomIndex(size);
    for (let slot = 0; slot < size; slot++) result.push(slot === majorSlot ? majors.pop() : minors.pop());
  }
  if (result.every((id, index) => id === previous[index])) result.push(result.shift());
  return result;
}
