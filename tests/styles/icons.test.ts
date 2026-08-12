/**
 * Icon wiring.
 *
 * A `gi-*` class is only an icon if two separate things line up: a CSS rule
 * pointing at an SVG, and the SVG actually existing on disk. The Gas Cloud card
 * shipped with `gi-poison-cloud` and neither — so it rendered as an empty box,
 * and nothing failed. Typecheck, lint and 1346 tests all passed.
 *
 * These guards close both halves of that gap.
 */
import { describe, it, expect } from '@jest/globals';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const CSS = readFileSync(join(ROOT, 'styles', 'dialogs.css'), 'utf8');
const TEMPLATE_DIR = join(ROOT, 'templates');

/** Every `.gi-x { background-image: url('../icons/y.svg') }` pair in the CSS. */
function cssIconRules(): Array<{ cls: string; svg: string }> {
  const rules: Array<{ cls: string; svg: string }> = [];
  const re = /\.gi-([a-z0-9-]+)\s*\{[^}]*background-image:\s*url\(['"]\.\.\/icons\/([^'"]+)['"]\)/g;
  for (const m of CSS.matchAll(re)) rules.push({ cls: `gi-${m[1]}`, svg: m[2] });
  return rules;
}

/** Every `gi-*` class referenced from a Handlebars template. */
function templateIconClasses(): Array<{ cls: string; file: string }> {
  const used: Array<{ cls: string; file: string }> = [];
  for (const file of readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.hbs'))) {
    const text = readFileSync(join(TEMPLATE_DIR, file), 'utf8');
    for (const m of text.matchAll(/class="([^"]*\bgi-[a-z0-9-]+[^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/).filter(c => c.startsWith('gi-'))) {
        used.push({ cls, file });
      }
    }
  }
  return used;
}

describe('icon assets', () => {
  it('finds icon rules to check', () => {
    expect(cssIconRules().length).toBeGreaterThan(20);
  });

  it('every CSS icon rule points at an SVG that exists', () => {
    const broken = cssIconRules()
      .filter(({ svg }) => !existsSync(join(ROOT, 'icons', svg)))
      .map(({ cls, svg }) => `${cls} -> icons/${svg}`);

    expect(broken).toEqual([]);
  });

  it('every gi-* class used in a template has a CSS rule', () => {
    // This is the one that would have caught the empty Gas Cloud box:
    // gi-poison-cloud was in tile-manager.hbs with no rule anywhere.
    const defined = new Set(cssIconRules().map(r => r.cls));
    const undefinedClasses = [
      ...new Set(
        templateIconClasses()
          .filter(({ cls }) => !defined.has(cls))
          .map(({ cls, file }) => `${cls} (${file})`)
      )
    ];

    expect(undefinedClasses).toEqual([]);
  });

  it('every icon SVG is a real SVG document', () => {
    // An XML prolog and/or a DOCTYPE before <svg> is perfectly valid — one of
    // the shipped icons has both — so match the root element anywhere near the
    // top rather than requiring the file to start with it.
    const bad = readdirSync(join(ROOT, 'icons'))
      .filter(f => f.endsWith('.svg'))
      .filter(f => {
        const text = readFileSync(join(ROOT, 'icons', f), 'utf8');
        return !/<svg[\s>]/.test(text) || !text.includes('viewBox');
      });

    expect(bad).toEqual([]);
  });

  it('every Tile Manager create-card carries an icon', () => {
    const text = readFileSync(join(TEMPLATE_DIR, 'tile-manager.hbs'), 'utf8');

    // Split on the action attribute: the text between one `data-action` and
    // the next IS that card's body, so no further bounding is needed. A
    // fixed-width window does not work here (descriptions vary from a few
    // words to several lines), and trimming at `</button>` does not either —
    // the cards are wrapped in Handlebars conditionals, so the closing tag is
    // not always inside the chunk.
    const chunks = text.split(/data-action="(create[A-Za-z]+)"/).slice(1);
    const cards: Array<{ action: string; body: string }> = [];
    for (let i = 0; i < chunks.length; i += 2) {
      cards.push({ action: chunks[i], body: chunks[i + 1] ?? '' });
    }

    expect(cards.length).toBeGreaterThan(10);
    expect(cards.filter(c => !/class="gi-[a-z0-9-]+"/.test(c.body)).map(c => c.action)).toEqual([]);
  });
});
