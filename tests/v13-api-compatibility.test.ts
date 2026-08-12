/**
 * Foundry v13 API compatibility guard for the maintenance branch.
 *
 * This branch cannot be run before release. There is no Foundry v13 available
 * to the maintainer, so nothing here has ever been loaded by the software it
 * targets — the fixes were re-implemented by hand against the v2.0.1 code
 * rather than cherry-picked, and the only feedback available is this suite.
 *
 * The failure mode that worries me is not a logic bug: the unit tests catch
 * those. It is a **v14-only API** getting copied across while re-implementing a
 * fix from `main`, because that produces code which passes every test here and
 * then throws the moment a v13 world loads it. The mocks cannot catch it —
 * they are hand-written, so a v14 call would simply be mocked too.
 *
 * So this checks the source text directly, for APIs that do not exist in
 * Foundry v13. Each entry below was verified against the installed Foundry
 * 14.364 source:
 *
 *  - The namespaced homes (`foundry.applications.handlebars`, `.apps`,
 *    `foundry.audio`) are where v14 *moved* things that were flat globals in
 *    v13. v14 keeps the flat names alive through
 *    `addBackwardsCompatibilityReferences` with deprecation markers reading
 *    "since 13, until 15" — which is itself the proof those flat globals were
 *    the v13 spelling. On v13 the namespaces do not exist at all.
 *  - `TileDocument.occlusion` is `mode` (a number) in v13 and `modes` (a
 *    SetField) in v14.
 *  - Region `levels`, `CONFIG.Token.movement.actions`, the
 *    `movement.passed.waypoints` shape and `TokenDocument#move` are all v14
 *    additions.
 *  - `Set#intersection` is ES2024 and is not available in v13's Electron.
 *
 * If a future backport genuinely needs one of these, delete the entry AND say
 * in the commit why it is safe on v13 — do not just add an exception.
 */
import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', 'src');
const MOCKS = join(__dirname, 'mocks', 'foundry.ts');

/** Source text with comments stripped, so prose cannot trip a check. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const SOURCES = walk(SRC).map(path => ({
  rel: path.slice(path.indexOf('/src/') + 1),
  code: codeOf(path)
}));

/** APIs that exist in Foundry v14 and not in v13. */
const V14_ONLY: Array<{ label: string; pattern: RegExp; instead: string }> = [
  {
    label: 'foundry.applications.handlebars',
    pattern: /foundry\s*\.\s*applications\s*\.\s*handlebars/,
    instead: 'the flat loadTemplates / renderTemplate globals'
  },
  {
    label: 'foundry.applications.apps.FilePicker',
    pattern: /foundry\s*\.\s*applications\s*\.\s*apps/,
    instead: 'the flat FilePicker global'
  },
  {
    label: 'foundry.audio',
    pattern: /foundry\s*\.\s*audio\b/,
    instead: 'the flat AudioHelper global'
  },
  {
    label: 'foundry.applications.ux.TextEditor',
    pattern: /foundry\s*\.\s*applications\s*\.\s*ux\b/,
    instead: 'the flat TextEditor global'
  },
  {
    label: 'v14 occlusion.modes (SetField)',
    pattern: /occlusion\s*:\s*\{[^}]*\bmodes\b/,
    instead: 'occlusion: { mode: <number> }, which is the v13 schema'
  },
  {
    label: 'v14 Region levels field',
    pattern: /\blevels\s*:\s*\[/,
    instead: 'nothing — regions have no levels field in v13'
  },
  {
    label: 'v14 CONFIG.Token.movement.actions',
    pattern: /CONFIG\s*\.\s*Token\s*\.\s*movement/,
    instead: 'nothing — movement actions are a v14 concept'
  },
  {
    label: 'v14 movement.passed.waypoints',
    pattern: /movement\s*\.\s*passed/,
    instead: 'nothing — the movement pipeline is a v14 concept'
  },
  {
    label: 'v14 game.documentTypes subtype registry',
    pattern: /game\s*\.\s*documentTypes/,
    instead: 'nothing — this branch registers no document subtypes'
  },
  {
    label: 'Set#intersection (ES2024)',
    pattern: /\.\s*intersection\s*\(/,
    instead: 'a manual filter; v13 Electron predates ES2024 Set methods'
  }
];

describe('v13 API compatibility', () => {
  it('finds source files to scan', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it.each(V14_ONLY)('src/ never uses $label', ({ pattern, instead }) => {
    const offenders = SOURCES.filter(s => pattern.test(s.code)).map(s => s.rel);
    expect({ offenders, useInstead: instead }).toEqual({ offenders: [], useInstead: instead });
  });

  it('still uses the flat v13 globals it depends on', () => {
    // The mirror of the above: if these disappeared it would mean someone had
    // "modernised" the branch onto v14 spellings, which is the same bug.
    const all = SOURCES.map(s => s.code).join('\n');
    expect(/\bloadTemplates\s*\(/.test(all)).toBe(true);
    expect(/\bFilePicker\b/.test(all)).toBe(true);
  });

  it('emits the v13 occlusion schema', () => {
    const builder = SOURCES.find(s => s.rel.endsWith('base-tile-builder.ts'));
    if (!builder) throw new Error('base-tile-builder.ts not found');
    // v13: a single numeric `mode`. v14 replaced it with a `modes` SetField and
    // dropped 0 as a legal value, which is why main had to change and this
    // branch must not.
    expect(builder.code).toMatch(/occlusion\s*:\s*\{\s*mode\s*:/);
  });
});

describe('the test mocks model v13, not v14', () => {
  const mock = codeOf(MOCKS);

  it('mocks the flat globals a v13 world provides', () => {
    // If the mocks drifted to v14 namespaces, every test here would keep
    // passing while the shipped code called into things v13 does not have.
    expect(mock).toMatch(/\bloadTemplates\b/);
    expect(mock).toMatch(/\bFilePicker\b/);
  });

  it.each([
    ['foundry.applications.handlebars', /applications\s*:\s*\{[\s\S]*\bhandlebars\b/],
    ['foundry.audio', /\baudio\s*:\s*\{[\s\S]*AudioHelper/]
  ])('does not mock the v14 %s namespace', (_label, pattern) => {
    expect(pattern.test(mock)).toBe(false);
  });
});
