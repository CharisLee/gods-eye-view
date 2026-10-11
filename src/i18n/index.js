/**
 * Lightweight Chinese / English UI localisation.
 *
 * The UI is authored in English (templates in src/ui/templates and strings
 * rendered by JS). Rather than rewriting hundreds of modules, this module
 * translates the rendered DOM: every text node and every translatable
 * attribute whose (whitespace-collapsed) value matches a key in the active
 * dictionary is swapped for its translation. A MutationObserver keeps
 * dynamically rendered UI translated, and switching back to English restores
 * the original strings.
 *
 * Add a string: put `'English text': '中文'` in src/i18n/zh.js.
 * Opt an element out: add the `data-i18n-skip` attribute (applies to its subtree).
 */
import { zh } from './zh.js';

export const LOCALES = ['en', 'zh'];
export const STORAGE_KEY = 'gev.locale';
const DICTIONARIES = { en: null, zh };
const ATTRIBUTES = ['title', 'placeholder', 'aria-label', 'alt'];
const SKIP_SELECTOR =
  'script,style,textarea,code,pre,[contenteditable="true"],[data-i18n-skip],.material-symbols-outlined,.gev-flap-host';

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

/** Pick the initial locale: saved choice → browser language → English (the project's original language). */
export function detectLocale({
  storage = globalThis.localStorage,
  languages = globalThis.navigator?.languages,
} = {}) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (LOCALES.includes(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const list = Array.isArray(languages) ? languages : [];
  return list.some((lang) => /^zh\b/i.test(String(lang))) ? 'zh' : 'en';
}

/** Translate a string into the given locale; unknown strings are returned unchanged. */
export function translate(text, locale) {
  const dictionary = DICTIONARIES[locale];
  if (!dictionary || typeof text !== 'string') return text;
  const key = normalize(text);
  if (!key || !Object.hasOwn(dictionary, key)) return text;
  const leading = text.match(/^\s*/)[0];
  const trailing = text.match(/\s*$/)[0];
  return leading + dictionary[key] + trailing;
}

export function createI18n({
  root = globalThis.document,
  storage = globalThis.localStorage,
} = {}) {
  let locale = detectLocale({ storage });
  // node -> original English text / element -> { attr: original }
  const textOriginals = new WeakMap();
  const textApplied = new WeakMap();
  const attrOriginals = new WeakMap();
  const listeners = new Set();
  let observer = null;
  let applying = false;

  const skipped = (element) =>
    !element || Boolean(element.closest?.(SKIP_SELECTOR));

  function applyText(node) {
    if (skipped(node.parentElement)) return;
    const current = node.nodeValue;
    // If the app rewrote the node since we touched it, the new value is the source.
    if (!textOriginals.has(node) || textApplied.get(node) !== current)
      textOriginals.set(node, current);
    const source = textOriginals.get(node);
    const next = translate(source, locale);
    textApplied.set(node, next);
    if (next !== current) node.nodeValue = next;
  }

  function applyAttributes(element) {
    if (skipped(element)) return;
    let originals = attrOriginals.get(element);
    for (const name of ATTRIBUTES) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      originals ??= {};
      const record = originals[name];
      if (!record || record.applied !== current)
        originals[name] = { source: current };
      const next = translate(originals[name].source, locale);
      originals[name].applied = next;
      if (next !== current) element.setAttribute(name, next);
    }
    if (originals) attrOriginals.set(element, originals);
  }

  function applyTree(node) {
    if (!node) return;
    if (node.nodeType === 3) return applyText(node);
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11)
      return;
    if (node.nodeType === 1) {
      if (skipped(node)) return;
      applyAttributes(node);
    }
    const doc = node.ownerDocument || node;
    const walker = doc.createTreeWalker(node, 1 | 4, {
      acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP_SELECTOR) ? 2 : 1),
    });
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === 3) applyText(current);
      else applyAttributes(current);
      current = walker.nextNode();
    }
  }

  function run(fn) {
    applying = true;
    try {
      fn();
    } finally {
      observer?.takeRecords();
      applying = false;
    }
  }

  function onMutations(records) {
    if (applying) return;
    run(() => {
      for (const record of records) {
        if (record.type === 'characterData') applyText(record.target);
        else if (record.type === 'attributes') applyAttributes(record.target);
        else record.addedNodes.forEach(applyTree);
      }
    });
  }

  function syncDocument() {
    const html = root.documentElement;
    if (html) html.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }

  return {
    get locale() {
      return locale;
    },
    t: (text) => translate(text, locale),
    start() {
      syncDocument();
      run(() => applyTree(root.body));
      if (typeof MutationObserver === 'function' && !observer) {
        observer = new MutationObserver(onMutations);
        observer.observe(root.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ATTRIBUTES,
        });
      }
    },
    setLocale(next) {
      if (!LOCALES.includes(next) || next === locale) return;
      locale = next;
      try {
        storage?.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      syncDocument();
      run(() => applyTree(root.body));
      listeners.forEach((listener) => listener(locale));
    },
    toggle() {
      this.setLocale(locale === 'zh' ? 'en' : 'zh');
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Wire the #language-toggle button in the top-center action bar. */
export function bindLanguageToggle(i18n, button) {
  if (!button) return;
  const render = () => {
    // Shows the language you will switch TO.
    const label = button.querySelector('.language-toggle-label');
    if (label) label.textContent = i18n.locale === 'zh' ? 'EN' : '中';
    button.setAttribute('aria-pressed', String(i18n.locale === 'zh'));
  };
  button.addEventListener('click', () => i18n.toggle());
  i18n.onChange(render);
  render();
}
