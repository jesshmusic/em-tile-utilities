/**
 * Localization guards for lang/en.json and the notify helpers
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * Source-scanning guards for localization.
 *
 * These do not exercise any runtime behaviour — they read the repository and
 * assert structural invariants that are easy to break by hand and impossible
 * to notice in review once the file is a few thousand lines long.
 */

const REPO_ROOT = join(__dirname, '..');
const LANG_FILE = join(REPO_ROOT, 'lang', 'en.json');
const TRANSLATIONS = JSON.parse(readFileSync(LANG_FILE, 'utf8'));

/**
 * Files whose user-facing notifications have been migrated onto the
 * `notifyInfo` / `notifyWarn` / `notifyError` helpers in src/dialogs/notify.ts.
 *
 * This is an allow-list rather than "all of src/" on purpose: the tile
 * creators under src/utils/{creators,helpers,builders,actions} still call
 * `ui.notifications` with English literals. Add their directories here as
 * they are migrated — that is the point of the list.
 */
const LOCALIZED_SOURCE_ROOTS = [
  join('src', 'main.ts'),
  join('src', 'dialogs'),
  join('src', 'settings'),
  join('src', 'utils', 'tag-input-manager.ts')
];

/** The one file that is allowed to touch `ui.notifications` directly. */
const NOTIFY_HELPER = join('src', 'dialogs', 'notify.ts');

function walk(absPath: string, extensions: string[]): string[] {
  if (!statSync(absPath).isDirectory()) {
    return extensions.some(ext => absPath.endsWith(ext)) ? [absPath] : [];
  }
  return readdirSync(absPath).flatMap(entry => walk(join(absPath, entry), extensions));
}

function collect(roots: string[], extensions: string[]): string[] {
  return roots.flatMap(root => walk(join(REPO_ROOT, root), extensions)).sort();
}

function read(absPath: string): { rel: string; text: string } {
  return {
    rel: relative(REPO_ROOT, absPath).split(sep).join('/'),
    text: readFileSync(absPath, 'utf8')
  };
}

const localizedSources = collect(LOCALIZED_SOURCE_ROOTS, ['.ts']).map(read);

describe('ui.notifications guards', () => {
  it('finds source files to scan', () => {
    // Guard the guard: a broken glob would make every assertion below vacuous.
    expect(localizedSources.length).toBeGreaterThan(10);
  });

  it('never passes a bare string literal to ui.notifications.*', () => {
    // Matches `ui.notifications.info('...')`, `.warn("...")`, `` .error(`...`) ``
    // and the optional-chained `ui.notifications?.warn('...')` form.
    const literalArgument = /ui\.notifications\??\.(info|warn|error)\(\s*['"`]/g;

    const offenders = localizedSources.flatMap(({ rel, text }) =>
      text
        .split('\n')
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => {
          literalArgument.lastIndex = 0;
          return literalArgument.test(line);
        })
        .map(({ line, number }) => `${rel}:${number}: ${line.trim()}`)
    );

    expect(offenders).toEqual([]);
  });

  it('routes every notification through src/dialogs/notify.ts', () => {
    const direct = localizedSources
      .filter(({ rel }) => rel !== NOTIFY_HELPER.split(sep).join('/'))
      .filter(({ text }) => /\bui\.notifications\b/.test(text))
      .map(({ rel }) => rel);

    expect(direct).toEqual([]);
  });
});

describe('EMPUZZLES localization keys', () => {
  const KEY_PATTERN = /EMPUZZLES\.([A-Za-z0-9_]+)/g;

  const referencingFiles = [...collect(['src'], ['.ts']), ...collect(['templates'], ['.hbs'])].map(
    read
  );

  const referenced = new Map<string, string[]>();
  for (const { rel, text } of referencingFiles) {
    for (const match of text.matchAll(KEY_PATTERN)) {
      const key = match[1];
      referenced.set(key, [...(referenced.get(key) ?? []), rel]);
    }
  }

  const defined = new Set(Object.keys(TRANSLATIONS.EMPUZZLES));

  it('defines every key referenced from src/ or templates/', () => {
    const missing = [...referenced.entries()]
      .filter(([key]) => !defined.has(key))
      .map(([key, files]) => `EMPUZZLES.${key} (${[...new Set(files)].join(', ')})`);

    expect(missing).toEqual([]);
  });

  it('has no orphaned keys — every defined key is referenced somewhere', () => {
    const orphans = [...defined].filter(key => !referenced.has(key)).map(key => `EMPUZZLES.${key}`);

    expect(orphans).toEqual([]);
  });

  it('gives every key a non-empty string value', () => {
    const bad = Object.entries(TRANSLATIONS.EMPUZZLES as Record<string, unknown>)
      .filter(([, value]) => typeof value !== 'string' || (value as string).length === 0)
      .map(([key]) => `EMPUZZLES.${key}`);

    expect(bad).toEqual([]);
  });
});
