/**
 * Source-scanning guards for styles/dialogs.css.
 *
 * This module ships one stylesheet into a page it shares with Foundry core,
 * the game system and every other active module. A selector written without a
 * namespace does not just style this module's dialogs -- it restyles actor
 * sheets, chat, the settings menus and other modules' UI, and the symptom
 * shows up somewhere completely unrelated to this repository.
 *
 * These tests do not exercise any runtime behaviour. They read the stylesheet
 * and assert the specific leaks that were found and fixed stay fixed.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const CSS = readFileSync(join(__dirname, '..', 'styles', 'dialogs.css'), 'utf8');

/** Selector text only: strip declaration blocks and comments. */
function selectors(): string[] {
  return CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map(block => block.split('{')[0])
    .filter(text => text.trim().length > 0)
    .flatMap(text => text.split(','))
    .map(text => text.trim())
    .filter(text => text.length > 0 && !text.startsWith('@'));
}

describe('dialogs.css scoping guards', () => {
  it('finds selectors to scan', () => {
    // Guard the guard: a broken parse would make every assertion vacuous.
    expect(selectors().length).toBeGreaterThan(200);
  });

  it('never applies :valid / :invalid outside this module', () => {
    // Unscoped `input:valid` matched every constraint-free input in the whole
    // Foundry UI and repainted its border.
    const offenders = selectors().filter(
      selector => /:(in)?valid\b/.test(selector) && !selector.includes('.em-puzzles')
    );

    expect(offenders).toEqual([]);
  });

  it('never reaches into Foundry control chrome with !important', () => {
    // `button.ui-control[class*="gi-"] { ... !important }` overrode Foundry's
    // own control styling everywhere, not just in the scene-controls toolbar.
    const controlRules = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .filter(block => /\.ui-control|\.control\b/.test(block.split('{')[0] ?? ''));

    const offenders = controlRules
      .filter(block => block.includes('!important'))
      .map(block => (block.split('{')[0] ?? '').trim());

    expect(offenders).toEqual([]);
  });

  it('scopes gi- toolbar overrides to the scene controls', () => {
    const offenders = selectors().filter(
      selector => /\.ui-control/.test(selector) && !selector.includes('#scene-controls')
    );

    expect(offenders).toEqual([]);
  });

  it('does not paint the sticky form footer a hard black', () => {
    // `background: #000` reads as a broken bar in Foundry's light theme; the
    // footer now uses the theme-aware `--background` the window itself uses.
    const footerRule = CSS.split('}').find(block =>
      /\.trap-config \.form-footer/.test(block.split('{')[0] ?? '')
    );

    expect(footerRule).toBeDefined();
    expect(footerRule).not.toMatch(/background:\s*#000\b/);
    expect(footerRule).toMatch(/var\(--background/);
  });

  it('namespaces the selectors most likely to collide with other packages', () => {
    // `.tag` in particular collides with the Tagger module's own chips, and
    // `.required` / `.game-icon` / `.tile-manager-footer` are generic enough
    // that any package could be using them.
    const risky = [
      '.required',
      '.game-icon',
      '.game-icon-sm',
      '.game-icon-lg',
      '.game-icon-xl',
      '.game-icon-2x',
      '.tag-select-container',
      '.tile-manager-footer'
    ];

    const offenders = selectors().filter(selector =>
      risky.some(name => selector.startsWith(`${name} `) || selector === name)
    );

    expect(offenders).toEqual([]);
  });

  it('defines every --dmguru-* custom property it reads', () => {
    const declared = new Set(
      [...CSS.matchAll(/(--dmguru-[a-z]+)\s*:/g)].map(match => match[1] as string)
    );
    const referenced = new Set(
      [...CSS.matchAll(/var\((--dmguru-[a-z]+)/g)].map(match => match[1] as string)
    );

    expect(referenced.size).toBeGreaterThan(0);
    expect([...referenced].filter(name => !declared.has(name))).toEqual([]);
  });
});
