import { WordEntry } from '../game/types.js';

export function parseCsvWordPack(csv: string): WordEntry[] {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: WordEntry[] = [];
  for (const row of rows) {
    const [wordRaw, categoryRaw = 'General'] = row.split(',').map((cell) => cell.trim());
    const word = wordRaw?.toLowerCase();
    if (!word || word.length < 2) {
      continue;
    }
    entries.push({ word, category: categoryRaw || 'General' });
  }
  if (!entries.length) {
    throw new Error('No words parsed from CSV');
  }
  return entries;
}
