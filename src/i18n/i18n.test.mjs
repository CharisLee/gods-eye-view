import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { detectLocale, translate, STORAGE_KEY } from './index.js';
import { zh } from './zh.js';

test('translate swaps known strings and preserves surrounding whitespace', () => {
  assert.equal(translate('  DATA LAYERS\n', 'zh'), '  数据图层\n');
  assert.equal(translate('Search  any\n location', 'zh'), '搜索任意位置');
  assert.equal(translate('DATA LAYERS', 'en'), 'DATA LAYERS');
  assert.equal(translate('not a ui string', 'zh'), 'not a ui string');
});

test('detectLocale prefers saved choice, then browser language, then English', () => {
  const storage = (value) => ({
    getItem: (key) => (key === STORAGE_KEY ? value : null),
  });
  assert.equal(
    detectLocale({ storage: storage('en'), languages: ['zh-CN'] }),
    'en',
  );
  assert.equal(
    detectLocale({ storage: storage(null), languages: ['zh-TW', 'en'] }),
    'zh',
  );
  assert.equal(
    detectLocale({ storage: storage('fr'), languages: ['en-US'] }),
    'en',
  );
  assert.equal(detectLocale({ storage: null, languages: undefined }), 'en');
});

test('zh dictionary has non-empty Chinese values', () => {
  for (const [key, value] of Object.entries(zh)) {
    assert.ok(value && value.trim(), `empty translation for ${key}`);
    assert.equal(
      key,
      key.replace(/\s+/g, ' ').trim(),
      `key must be whitespace-normalised: ${key}`,
    );
  }
});

test('scene chrome exposes the language toggle', () => {
  const html = readFileSync(
    new URL('../ui/templates/scene-chrome.html', import.meta.url),
    'utf8',
  );
  assert.match(
    html,
    /<nav id="top-center-actions"[\s\S]*?id="language-toggle"[\s\S]*?<\/nav>/,
  );
});
