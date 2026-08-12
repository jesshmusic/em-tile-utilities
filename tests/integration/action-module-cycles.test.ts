/**
 * A source-scanning guard against one specific, catastrophic mistake.
 *
 * `src/utils/actions/apply-damage-tile-action.ts` owns `registerEmTileActions()`
 * and therefore imports every other custom action module in order to register
 * it. If one of those modules imports anything back — `EM_ACTION_NAMESPACE` is
 * the tempting one, since the damage file exports it — the two become circular.
 *
 * That cycle is not benign. Vite bundles this module as a single IIFE, so
 * Rollup evaluates the imported module's body FIRST; it reaches the `const` it
 * imported from the damage file while that binding is still in its temporal
 * dead zone and throws a `ReferenceError`. The throw happens at script
 * evaluation, above every `Hooks.once("init")` handler, so the ENTIRE module
 * dies: no settings, no scene control tools, no region behaviors, no dialogs.
 * Nothing in the type checker, the linter or the unit suite notices, because
 * each module is loaded independently under Jest and the cycle resolves fine
 * there.
 *
 * This shipped once, during the `useactivity` work, and was found only by
 * loading the built bundle in a live world. Hence a guard.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');
const ACTIONS_DIR = join(REPO_ROOT, 'src', 'utils', 'actions');

/** The module that registers the others, and so must be the only importer. */
const REGISTRAR = 'apply-damage-tile-action.ts';

function actionModules(): Array<{ rel: string; file: string; text: string }> {
  return readdirSync(ACTIONS_DIR)
    .filter(file => file.endsWith('.ts'))
    .map(file => ({
      file,
      rel: relative(REPO_ROOT, join(ACTIONS_DIR, file)).split(sep).join('/'),
      text: readFileSync(join(ACTIONS_DIR, file), 'utf8')
    }));
}

describe('custom action module import cycles', () => {
  const modules = actionModules();

  it('finds the action modules to scan', () => {
    // Guard the guard: a broken path would make the assertion below vacuous.
    expect(modules.length).toBeGreaterThan(5);
    expect(modules.map(m => m.file)).toContain(REGISTRAR);
  });

  it('never imports back from the module that registers them', () => {
    const importsRegistrar = /^\s*import\s[\s\S]*?from\s+'\.\/apply-damage-tile-action'/gm;

    const offenders = modules
      .filter(({ file }) => file !== REGISTRAR && file !== 'index.ts')
      .filter(({ text }) => {
        importsRegistrar.lastIndex = 0;
        return importsRegistrar.test(text);
      })
      .map(({ rel }) => rel);

    expect(offenders).toEqual([]);
  });

  it('lets each action module declare its own namespace constant', () => {
    // The intended shape: a local `const EM_ACTION_NAMESPACE = 'em-tile-utilities'`
    // per module. Cheap duplication, and the only thing standing between a
    // refactor and a module that does not load at all.
    const registrars = modules.filter(({ text }) => text.includes('registerTileAction('));
    expect(registrars.length).toBeGreaterThan(2);

    for (const { rel, text } of registrars) {
      expect([rel, text.includes("EM_ACTION_NAMESPACE = 'em-tile-utilities'")]).toEqual([
        rel,
        true
      ]);
    }
  });
});
