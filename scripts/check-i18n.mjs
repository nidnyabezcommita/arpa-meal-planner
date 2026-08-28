import { readFileSync } from 'node:fs';

const localeFiles = {
  en: new URL('../i18n/translations/en.json', import.meta.url),
  tr: new URL('../i18n/translations/tr.json', import.meta.url),
};

function flatten(value, prefix = '', entries = new Map()) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, entries);
    }
    return entries;
  }

  entries.set(prefix, value);
  return entries;
}

function interpolationNames(value) {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/{{\s*([^},\s]+)(?:,[^}]*)?}}/g)]
    .map((match) => match[1])
    .sort();
}

const locales = Object.fromEntries(
  Object.entries(localeFiles).map(([locale, file]) => [
    locale,
    flatten(JSON.parse(readFileSync(file, 'utf8'))),
  ]),
);

const referenceLocale = 'en';
const reference = locales[referenceLocale];
const failures = [];

for (const [locale, entries] of Object.entries(locales)) {
  if (locale === referenceLocale) continue;

  for (const key of reference.keys()) {
    if (!entries.has(key)) {
      failures.push(`${locale}: missing key ${key}`);
      continue;
    }

    const expectedNames = interpolationNames(reference.get(key));
    const actualNames = interpolationNames(entries.get(key));
    if (expectedNames.join(',') !== actualNames.join(',')) {
      failures.push(
        `${locale}: interpolation mismatch for ${key} (${expectedNames.join(',')} != ${actualNames.join(',')})`,
      );
    }
  }

  for (const key of entries.keys()) {
    if (!reference.has(key)) failures.push(`${locale}: extra key ${key}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `i18n catalogs match: ${Object.keys(locales).join(', ')} (${reference.size} leaf keys)`,
  );
}
