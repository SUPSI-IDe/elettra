import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { translations } from '../src/i18n/translations.js';
import { VEHICLE_CATEGORIES } from '../src/config/vehicle-categories.js';

test('shift UI messages, weekdays and vehicle categories are translated in all supported languages', () => {
  const directory = new URL('../src/pages/Fleet/Shifts/', import.meta.url);
  const keys = new Set(VEHICLE_CATEGORIES.map(category => category.labelI18nKey));
  for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) keys.add(`simulation.day_${day}`);
  for (const file of readdirSync(directory).filter(file => /\.(js|html)$/.test(file))) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    for (const match of source.matchAll(/["']((?:shifts|trip_preview|common|gtfs)\.[a-zA-Z0-9_]+)["']/g)) keys.add(match[1]);
  }
  for (const key of keys) for (const lang of ['en', 'it', 'de', 'fr']) {
    assert.ok(translations[lang][key]?.trim(), `${lang}: missing ${key}`);
  }
});

test('shift translations keep the same substitution parameters in every language', () => {
  const parameters = text => [...text.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(translations.en).filter(key => key.startsWith('shifts.'))) {
    for (const lang of ['it', 'de', 'fr']) assert.deepEqual(parameters(translations[lang][key]), parameters(translations.en[key]), `${lang}: ${key}`);
  }
});
