import data from './data.en.json';
import onboarding from './onboarding.en.json';
import planning from './planning.en.json';
import screens from './screens.en.json';
import shell from './shell.en.json';
import type { Language } from './Language';

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ');
const dictionary: Record<string, string> = Object.fromEntries(
  Object.entries({ ...data, ...screens, ...onboarding, ...planning, ...shell }).map(([key, value]) => [normalize(key), value]),
);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fields = /\{(\d+)\}/g;

const patterns = Object.entries(dictionary)
  .filter(([source]) => /\{\d+\}/.test(source) && /[a-zÀ-ÿ]{2}/i.test(source.replace(fields, '')))
  .map(([source, target]) => {
    const parts = source.split(fields);
    const slots = parts.filter((_, index) => index % 2);
    const expression = parts.map((part, index) => index % 2 ? '(.*?)' : escape(part)).join('');
    return { target, slots, expression: new RegExp(`^${expression}$`), prefix: parts[0], suffix: parts[parts.length - 1] };
  })
  .sort((a, b) => (b.prefix.length + b.suffix.length) - (a.prefix.length + a.suffix.length));

export function translate(text: string, language: Language): string {
  if (language === 'pt' || !text.trim()) return text;
  const key = normalize(text);
  let translated = Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
  if (translated === undefined) {
    for (const pattern of patterns) {
      if (!key.startsWith(pattern.prefix) || !key.endsWith(pattern.suffix)) continue;
      const match = pattern.expression.exec(key);
      if (!match) continue;
      translated = pattern.target.replace(fields, (token, slot: string) => {
        const value = match[pattern.slots.indexOf(slot) + 1];
        return value !== undefined ? (Object.hasOwn(dictionary, value) ? dictionary[value] : value) : token;
      });
      break;
    }
  }
  return translated === undefined ? text : text.replace(/\S[\s\S]*\S|\S/, () => translated);
}
