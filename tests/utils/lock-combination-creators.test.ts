/**
 * Tests for the two lock puzzles: src/utils/creators/lock-creator.ts and
 * src/utils/creators/combination-creator.ts.
 *
 * Both creators are pure Monk's Active Tiles action construction — no custom
 * action, no code generation, nothing that throws when it is wrong. A misnamed
 * `data` key produces a tile that opens, renders and does absolutely nothing,
 * which is exactly the failure mode unit tests have to catch. So every
 * assertion here is on the emitted action data, and on the wall flags, rather
 * than on anything the dialogs hold.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

mockFoundry();

import {
  createLockTile,
  buildLockActions,
  createCombinationTile,
  buildCombinationActions,
  buildAnswerComparison,
  buildPromptContent,
  type LockConfig,
  type CombinationConfig
} from '../../src/utils/creators';

const SCENE_ID = 'scene0000000000';
const WALL_ID = 'wall000000000000';

/**
 * The shared scene mock has no walls collection and no update path, because
 * nothing in this module wrote to a wall before these creators existed.
 */
function createSceneWithWall(overrides: any = {}): any {
  const scene = createMockScene(SCENE_ID);
  const wall: any = { id: WALL_ID, c: [1000, 500, 1000, 600], door: 1, ds: 0, ...overrides };
  return Object.assign(scene, {
    walls: { get: (id: string) => (id === WALL_ID ? wall : undefined) },
    updateEmbeddedDocuments: jest.fn(async () => {
      // Mirror MATT's `preUpdateWall` hook, which stamps the door change onto a
      // transient `_wallchange` array on every wall update — including ours.
      wall._wallchange = ['lock'];
      return [wall];
    })
  });
}

function lockConfig(overrides: Partial<LockConfig> = {}): LockConfig {
  return {
    name: 'Vault Door',
    wallId: WALL_ID,
    wallName: 'Door abc',
    keyItemName: 'Rusty Key',
    successMessage: 'It opens.',
    failureMessage: 'It holds.',
    ...overrides
  };
}

function comboConfig(overrides: Partial<CombinationConfig> = {}): CombinationConfig {
  return {
    name: 'Rune Panel',
    image: 'path/to/panel.webp',
    prompt: 'What word do the runes spell?',
    answer: 'Mellon',
    successMessage: 'The stone shifts.',
    failureMessage: 'Nothing happens.',
    ...overrides
  };
}

/** Pull the MATT actions back out of a `createEmbeddedDocuments('Tile', …)` call. */
function emittedActions(scene: any): any[] {
  const [, [tileData]] = scene.createEmbeddedDocuments.mock.calls[0];
  return tileData.flags['monks-active-tiles'].actions;
}

function byAction(actions: any[], name: string): any[] {
  return actions.filter(a => a.action === name);
}

/* -------------------------------------------- */

describe('buildLockActions', () => {
  it('gates the door on an inventory filter followed by a checkvalue', () => {
    const actions = buildLockActions(SCENE_ID, lockConfig());

    // The inventory filter cannot branch by itself: MATT's `fn` returns
    // { tokens, items } with no `continue` and no `goto`, so an empty result
    // falls straight through. The checkvalue on tokens.length is the gate.
    expect(actions[0]).toMatchObject({
      action: 'inventory',
      data: {
        entity: { id: 'token', name: 'Triggering Token' },
        item: 'Rusty Key',
        count: '> 0'
      }
    });
    expect(actions[1]).toMatchObject({
      action: 'checkvalue',
      data: { name: 'tokens.length', value: '> 0', fail: 'em_lock_denied' }
    });
  });

  it('writes an explicit count — MATT defaults a missing one to "= 1", not "> 0"', () => {
    expect(buildLockActions(SCENE_ID, lockConfig())[0].data.count).toBe('> 0');
  });

  it('scopes the search to every player token when asked', () => {
    const actions = buildLockActions(SCENE_ID, lockConfig({ checkScope: 'players' }));
    expect(actions[0].data.entity).toEqual({ id: 'players', name: 'Player Tokens' });
  });

  it('unlocks the door with the UPPERCASE door state MATT expects', () => {
    const [door] = byAction(buildLockActions(SCENE_ID, lockConfig()), 'changedoor');
    expect(door.data.entity.id).toBe(`Scene.${SCENE_ID}.Wall.${WALL_ID}`);
    // CLOSED is "unlocked but still shut"; lowercase "locked"/"closed" would
    // miss CONST.WALL_DOOR_STATES and fail schema validation on Wall#ds.
    expect(door.data.state).toBe('CLOSED');
  });

  it('swings the door open in open mode', () => {
    const [door] = byAction(
      buildLockActions(SCENE_ID, lockConfig({ unlockMode: 'open' })),
      'changedoor'
    );
    expect(door.data.state).toBe('OPEN');
  });

  it('stops before the denied branch so success never falls into failure', () => {
    const actions = buildLockActions(SCENE_ID, lockConfig());
    const stopIndex = actions.findIndex(a => a.action === 'stop');
    const anchorIndex = actions.findIndex(
      a => a.action === 'anchor' && a.data.tag === 'em_lock_denied'
    );

    expect(stopIndex).toBeGreaterThan(-1);
    expect(anchorIndex).toBe(stopIndex + 1);
    // The success chat message must sit before the stop, the failure one after.
    const messages = actions
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.action === 'chatmessage');
    expect(messages[0].i).toBeLessThan(stopIndex);
    expect(messages[1].i).toBeGreaterThan(anchorIndex);
  });

  it('omits optional sounds rather than emitting empty playsound actions', () => {
    expect(byAction(buildLockActions(SCENE_ID, lockConfig()), 'playsound')).toHaveLength(0);
    const withSound = buildLockActions(
      SCENE_ID,
      lockConfig({ successSound: 'a.ogg', failureSound: 'b.ogg' })
    );
    expect(byAction(withSound, 'playsound')).toHaveLength(2);
  });

  it('gives every action a unique id', () => {
    const actions = buildLockActions(SCENE_ID, lockConfig({ successSound: 'a.ogg' }));
    expect(new Set(actions.map(a => a.id)).size).toBe(actions.length);
  });
});

/* -------------------------------------------- */

describe('createLockTile', () => {
  let scene: any;

  beforeEach(() => {
    scene = createSceneWithWall();
    (global as any).canvas.scene = scene;
  });

  it('creates a hidden tile that accepts the door trigger', async () => {
    await createLockTile(scene, lockConfig());

    const [type, [tileData]] = scene.createEmbeddedDocuments.mock.calls[0];
    expect(type).toBe('Tile');
    expect(tileData.hidden).toBe(true);
    expect(tileData.name).toBe('Vault Door');
    expect(tileData.flags['monks-active-tiles'].trigger).toEqual(['door']);
    expect(tileData.flags['monks-active-tiles'].active).toBe(true);
  });

  it('parks the logic tile on the wall midpoint', async () => {
    await createLockTile(scene, lockConfig());

    // Wall runs (1000,500)-(1000,600); midpoint (1000,550). Tile x/y are
    // top-left, so a 100px grid square is offset by half a grid.
    const [, [tileData]] = scene.createEmbeddedDocuments.mock.calls[0];
    expect(tileData.x).toBe(950);
    expect(tileData.y).toBe(500);
  });

  it('writes MATT door-trigger flags onto the wall itself', async () => {
    await createLockTile(scene, lockConfig());

    expect(scene.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
    const [type, [update]] = scene.updateEmbeddedDocuments.mock.calls[0];
    expect(type).toBe('Wall');
    expect(update._id).toBe(WALL_ID);
    expect(update['flags.monks-active-tiles.entity'].id).toMatch(
      new RegExp(`^Scene\\.${SCENE_ID}\\.Tile\\.`)
    );
    expect(update['flags.monks-active-tiles.checklock']).toBe(true);
  });

  it('locks the door so the checklock change can survive MATT’s filter', async () => {
    await createLockTile(scene, lockConfig());
    const [, [update]] = scene.updateEmbeddedDocuments.mock.calls[0];
    expect(update.ds).toBe(2); // CONST.WALL_DOOR_STATES.LOCKED
  });

  it('leaves the door state alone when told not to lock it', async () => {
    await createLockTile(scene, lockConfig({ lockDoorOnCreate: false }));
    const [, [update]] = scene.updateEmbeddedDocuments.mock.calls[0];
    expect(update.ds).toBeUndefined();
  });

  it('never sets the unlock flag, which would re-trigger off its own changedoor', async () => {
    await createLockTile(scene, lockConfig());
    const [, [update]] = scene.updateEmbeddedDocuments.mock.calls[0];
    expect(update['flags.monks-active-tiles.unlock']).toBeUndefined();
    expect(update['flags.monks-active-tiles.open']).toBeUndefined();
  });

  it('clears the transient change marker its own wall update just set', async () => {
    // Verified live on Foundry 14.364 / MATT 14.01: locking the door leaves
    // `_wallchange: ["lock"]` on the document, `triggerDoor` only synthesises
    // `checklock` when that array is empty, and the first rattle after
    // creation therefore did nothing at all until this was cleared.
    await createLockTile(scene, lockConfig());
    expect(scene.walls.get(WALL_ID)._wallchange).toEqual([]);
  });

  it('refuses a wall that is not in the scene', async () => {
    await expect(createLockTile(scene, lockConfig({ wallId: 'nope' }))).rejects.toThrow(
      /is not in this scene/
    );
    expect(scene.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */

describe('buildAnswerComparison', () => {
  it('compares case-insensitively by default', () => {
    expect(buildAnswerComparison('Mellon', false)).toBe('.trim().toLowerCase() == "mellon"');
  });

  it('compares exactly when case sensitivity is on', () => {
    expect(buildAnswerComparison('Mellon', true)).toBe('.trim() == "Mellon"');
  });

  it('produces an expression MATT’s getValue passes through untouched', () => {
    // getValue only forwards a compare value verbatim when it starts with
    // ==/>/</!= or *contains* "==". The leading method call relies on the last
    // of those, so guard it.
    const expression = buildAnswerComparison('Mellon', false);
    expect(expression.indexOf('==')).toBeGreaterThanOrEqual(0);
    // ...and it must not end in true/false, which getValue short-circuits.
    expect(expression.endsWith('true')).toBe(false);
    expect(expression.endsWith('false')).toBe(false);
  });

  it('survives an answer of "true"', () => {
    const expression = buildAnswerComparison('true', false);
    expect(expression).toBe('.trim().toLowerCase() == "true"');
    expect(eval(`"True" ${expression}`)).toBe(true);
  });

  it('escapes quotes and backslashes so the eval stays well-formed', () => {
    expect(buildAnswerComparison('say "hi"', true)).toBe('.trim() == "say \\"hi\\""');
    expect(buildAnswerComparison('a\\b', true)).toBe('.trim() == "a\\\\b"');
  });

  it('strips the template syntax MATT would otherwise evaluate', () => {
    const expression = buildAnswerComparison('{{value.answer}}', true);
    expect(expression).not.toContain('{{');
    expect(buildAnswerComparison('[[1d20]]', true)).not.toContain('[[');
  });

  it('actually evaluates the way MATT will evaluate it', () => {
    const insensitive = buildAnswerComparison('Mellon', false);
    const sensitive = buildAnswerComparison('Mellon', true);
    expect(eval(`"  mellon " ${insensitive}`)).toBe(true);
    expect(eval(`"MELLON" ${insensitive}`)).toBe(true);
    expect(eval(`"moria" ${insensitive}`)).toBe(false);
    expect(eval(`"mellon" ${sensitive}`)).toBe(false);
    expect(eval(`" Mellon " ${sensitive}`)).toBe(true);
  });
});

/* -------------------------------------------- */

describe('buildPromptContent', () => {
  it('carries a plain input named "answer" — the key checkvalue reads', () => {
    const html = buildPromptContent('Speak, friend', 'Your answer');
    expect(html).toContain('name="answer"');
    expect(html).toContain('Speak, friend');
    expect(html).toContain('Your answer');
  });

  it('escapes HTML so a prompt cannot break out of the dialog body', () => {
    const html = buildPromptContent('<script>bad()</script>', 'A');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('defuses Handlebars, which MATT compiles twice over this content', () => {
    expect(buildPromptContent('{{value.answer}}', 'A')).not.toContain('{{');
  });
});

/* -------------------------------------------- */

describe('buildCombinationActions', () => {
  it('opens with a custom dialog whose submit button harvests the form', () => {
    const [dialog] = buildCombinationActions(SCENE_ID, comboConfig());

    expect(dialog.action).toBe('dialog');
    expect(dialog.data.dialogtype).toBe('custom');
    expect(dialog.data.showto).toBe('trigger');
    expect(dialog.data.content).toContain('name="answer"');
    expect(dialog.data.buttons).toHaveLength(1);
    // Only a submit button runs FormDataExtended over the dialog's form.
    expect(dialog.data.buttons[0]).toMatchObject({
      submit: true,
      goto: 'em_combo_check'
    });
    expect(dialog.data.buttons[0].id).toEqual(expect.any(String));
  });

  it('always sets a close landing — a blank one reopens the dialog forever', () => {
    const [dialog] = buildCombinationActions(SCENE_ID, comboConfig());
    expect(dialog.data.close).toBe('em_combo_end');

    const actions = buildCombinationActions(SCENE_ID, comboConfig());
    expect(actions.some(a => a.action === 'anchor' && a.data.tag === 'em_combo_end')).toBe(true);
  });

  it('checks value.answer, not a tile variable', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig());
    const [check] = byAction(actions, 'checkvalue');

    expect(check.data.name).toBe('answer');
    expect(check.data.value).toBe('.trim().toLowerCase() == "mellon"');
    expect(check.data.fail).toBe('em_combo_fail');
  });

  it('lands the submit button on an anchor that actually exists', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig());
    const tags = actions.filter(a => a.action === 'anchor').map(a => a.data.tag);
    const [dialog] = actions;
    expect(tags).toContain(dialog.data.buttons[0].goto);
    expect(tags).toContain(dialog.data.close);
    for (const check of byAction(actions, 'checkvalue')) expect(tags).toContain(check.data.fail);
  });

  it('emits no attempt counter when attempts are unlimited', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig());
    expect(byAction(actions, 'setvariable')).toHaveLength(0);
    expect(byAction(actions, 'checkvariable')).toHaveLength(0);
    expect(byAction(actions, 'activate')).toHaveLength(0);
  });

  it('counts attempts with MATT increment syntax, not a Handlebars helper', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig({ maxAttempts: 3 }));
    const increment = byAction(actions, 'setvariable').find(a => a.data.value === '+ 1');

    expect(increment).toBeDefined();
    expect(increment.data.name).toBe('em_combo_attempts');
    // {{add}} is not registered and helperMissing throws with arguments.
    expect(JSON.stringify(actions)).not.toContain('{{');
  });

  it('puts the comparison in checkvariable.value and keeps type an aggregation', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig({ maxAttempts: 3 }));
    const [check] = byAction(actions, 'checkvariable');

    expect(check.data.value).toBe('>= 3');
    // type accepts only all | any | none — it is not a comparison operator.
    expect(check.data.type).toBe('all');
    expect(check.data.fail).toBe('em_combo_retry');
  });

  it('clears the counter on success with MATT’s _null sentinel', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig({ maxAttempts: 3 }));
    const reset = byAction(actions, 'setvariable').find(a => a.data.value !== '+ 1');

    // The literal string "null" is eval'd into a live value and clears nothing.
    expect(reset.data.value).toBe('"_null"');
  });

  it('deactivates the running tile once attempts run out', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig({ maxAttempts: 2 }));
    const [activate] = byAction(actions, 'activate');

    expect(activate.data.activate).toBe('deactivate');
    // { id: 'tile' } is the tile *running* the action, which is this one.
    expect(activate.data.entity.id).toBe('tile');
    expect(activate.data.collection).toBe('tiles');
  });

  it('places the lockout branch before the retry landing', () => {
    const actions = buildCombinationActions(SCENE_ID, comboConfig({ maxAttempts: 2 }));
    const activateIndex = actions.findIndex(a => a.action === 'activate');
    const retryIndex = actions.findIndex(
      a => a.action === 'anchor' && a.data.tag === 'em_combo_retry'
    );
    const stopAfterLockout = actions.findIndex((a, i) => a.action === 'stop' && i > activateIndex);

    expect(activateIndex).toBeLessThan(retryIndex);
    expect(stopAfterLockout).toBeGreaterThan(activateIndex);
    expect(stopAfterLockout).toBeLessThan(retryIndex);
  });

  it('unlocks an optional door and triggers an optional tile on success', () => {
    const actions = buildCombinationActions(
      SCENE_ID,
      comboConfig({ wallId: WALL_ID, unlockMode: 'open', targetTileId: 'tile000000000000' })
    );

    const [door] = byAction(actions, 'changedoor');
    expect(door.data.entity.id).toBe(`Scene.${SCENE_ID}.Wall.${WALL_ID}`);
    expect(door.data.state).toBe('OPEN');

    const [trigger] = byAction(actions, 'trigger');
    expect(trigger.data.entity.id).toBe(`Scene.${SCENE_ID}.Tile.tile000000000000`);

    // Both belong to the success branch, i.e. before the first stop.
    const stopIndex = actions.findIndex(a => a.action === 'stop');
    expect(actions.indexOf(door)).toBeLessThan(stopIndex);
    expect(actions.indexOf(trigger)).toBeLessThan(stopIndex);
  });

  it('gives every action a unique id', () => {
    const actions = buildCombinationActions(
      SCENE_ID,
      comboConfig({ maxAttempts: 3, successSound: 'a.ogg', failureSound: 'b.ogg' })
    );
    expect(new Set(actions.map(a => a.id)).size).toBe(actions.length);
  });
});

/* -------------------------------------------- */

describe('createCombinationTile', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene(SCENE_ID);
    (global as any).canvas.scene = scene;
  });

  it('creates a visible, pointer-enabled tile at the requested position', async () => {
    await createCombinationTile(scene, comboConfig(), 300, 400);

    const [type, [tileData]] = scene.createEmbeddedDocuments.mock.calls[0];
    expect(type).toBe('Tile');
    expect(tileData.x).toBe(300);
    expect(tileData.y).toBe(400);
    expect(tileData.hidden).toBe(false);
    expect(tileData.texture.src).toBe('path/to/panel.webp');
    expect(tileData.flags['monks-active-tiles'].pointer).toBe(true);
  });

  it('defaults to a double-click trigger and honours single click', async () => {
    await createCombinationTile(scene, comboConfig(), 0, 0);
    expect(emittedActions(scene)).toBeDefined();
    const [, [dbl]] = scene.createEmbeddedDocuments.mock.calls[0];
    expect(dbl.flags['monks-active-tiles'].trigger).toEqual(['dblclick']);

    const clickScene = createMockScene(SCENE_ID) as any;
    await createCombinationTile(clickScene, comboConfig({ triggerOn: 'click' }), 0, 0);
    const [, [single]] = clickScene.createEmbeddedDocuments.mock.calls[0];
    expect(single.flags['monks-active-tiles'].trigger).toEqual(['click']);
  });

  it('stores the built action list on the tile', async () => {
    await createCombinationTile(scene, comboConfig({ maxAttempts: 3 }), 0, 0);

    const actions = emittedActions(scene);
    expect(actions.map(a => a.action)).toEqual(
      expect.arrayContaining(['dialog', 'anchor', 'checkvalue', 'setvariable', 'checkvariable'])
    );
  });
});
