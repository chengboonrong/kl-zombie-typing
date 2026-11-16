/// <reference types="vite/client" />
import type { Lang, Level } from './words';

const lists = import.meta.glob<string[]>('../words/*/*.json', { eager: true, import: 'default' });

export function wordList(lang: Lang, level: Level): string[] {
  return lists[`../words/${lang}/${level}.json`];
}
