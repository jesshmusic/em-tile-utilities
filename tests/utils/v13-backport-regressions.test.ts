/**
 * Regression tests for the v2.0.2 v13 backport.
 *
 * Every test here asserts on the Monk's Active Tiles action data that a creator
 * actually emits, not on dialog state — the bugs these cover were all "the tile
 * we wrote out is wrong", and only the emitted payload proves that.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';

mockFoundry();

import * as fs from 'fs';
import * as path from 'path';

import {
  createTrapTile,
  createTeleportTile,
  createResetTile,
  createCheckStateTile,
  createCombatTrapTile
} from '../../src/utils/creators';
import { resolveTargetEntity } from '../../src/utils/builders/entity-builders';
import { isTeleportTag, isReturnTeleportTag } from '../../src/utils/helpers/tag-helpers';
import { createSetVariableAction } from '../../src/utils/actions';
import { TrapResultType, TrapTargetType } from '../../src/types/module';

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Pull the MATT action list out of the first tile the scene was asked to create. */
function actionsOf(scene: any): any[] {
  const tileCall = scene.createEmbeddedDocuments.mock.calls.find((c: any) => c[0] === 'Tile');
  return tileCall[1][0].flags['monks-active-tiles'].actions;
}

/* -------------------------------------------- */
/* 1. save: namespacing                          */
/* -------------------------------------------- */

describe('saving throws use the save: namespace', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
    (global as any).canvas.scene = scene;
  });

  it('emits save:dex, not ability:dex, from a damage trap', async () => {
    await createTrapTile(
      scene,
      {
        name: 'Dart Trap',
        resultType: TrapResultType.DAMAGE,
        targetType: TrapTargetType.TRIGGERING,
        startingImage: 'icons/svg/trap.svg',
        damageOnFail: '2d6',
        hasSavingThrow: true,
        savingThrow: 'save:dex',
        dc: 14,
        flavorText: '',
        halfDamageOnSuccess: false
      } as any,
      100,
      100
    );

    const request = actionsOf(scene).find((a: any) => a.action === 'monks-tokenbar.requestroll');
    expect(request).toBeDefined();
    // Monk's Token Bar's findBestRequest scans `ability` before `save`, so
    // `ability:dex` silently produces an ability CHECK with no save proficiency.
    expect(request.data.request).toBe('save:dex');
    expect(request.data.request.startsWith('ability:')).toBe(false);
  });

  it('emits save:dex from a teleport tile', async () => {
    await createTeleportTile(
      scene,
      {
        name: 'Trap Door',
        image: 'icons/svg/hazard.svg',
        hidden: false,
        teleportX: 500,
        teleportY: 500,
        teleportSceneId: scene.id,
        deleteSourceToken: false,
        createReturnTeleport: false,
        hasSavingThrow: true,
        savingThrow: 'save:dex',
        dc: 15,
        flavorText: ''
      } as any,
      100,
      100
    );

    const request = actionsOf(scene).find((a: any) => a.action === 'monks-tokenbar.requestroll');
    expect(request.data.request).toBe('save:dex');
  });

  it('offers only save:-namespaced options in every saving-throw template', () => {
    const templates = [
      'templates/partials/saving-throw-section.hbs',
      'templates/teleport-dialog.hbs',
      'templates/activating-trap-config.hbs',
      'templates/switching-trap-config.hbs',
      'templates/disappearing-trap-config.hbs'
    ];

    for (const rel of templates) {
      const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      expect(source).not.toMatch(/ability:(str|dex|con|int|wis|cha)/);
    }
  });
});

/* -------------------------------------------- */
/* 2. Reset tile defects                         */
/* -------------------------------------------- */

describe('reset tile', () => {
  let scene: any;

  const baseTileState = {
    tileId: 'tile-1',
    hidden: false,
    fileindex: 0,
    active: true,
    rotation: 0,
    x: 100,
    y: 100,
    wallDoorStates: [],
    hasActivateAction: false,
    hasMovementAction: false,
    hasTileImageAction: true,
    hasShowHideAction: false,
    hasFiles: true,
    resetTriggerHistory: false
  };

  beforeEach(() => {
    scene = createMockScene();
    (global as any).canvas.scene = scene;
  });

  it('addresses setvariable at the tile that owns the variable', async () => {
    await createResetTile(
      scene,
      {
        name: 'Reset',
        image: 'icons/svg/statue.svg',
        tilesToReset: [
          { ...baseTileState, tileId: 'tile-a', variables: { switch_1: 'ON' } },
          { ...baseTileState, tileId: 'tile-b', variables: { switch_1: 'OFF' } }
        ]
      } as any,
      0,
      0
    );

    const setVars = actionsOf(scene).filter((a: any) => a.action === 'setvariable');
    expect(setVars).toHaveLength(2);

    // `{ id: 'tile' }` resolves to the tile RUNNING the action — the reset tile
    // itself — so the variables landed on the wrong document entirely.
    expect(setVars.map((a: any) => a.data.entity.id)).toEqual([
      `Scene.${scene.id}.Tile.tile-a`,
      `Scene.${scene.id}.Tile.tile-b`
    ]);
    expect(setVars.some((a: any) => a.data.entity.id === 'tile')).toBe(false);

    // Both tiles use the same default variable name; each must still get its
    // own value.
    expect(setVars[0].data.value).toBe('"ON"');
    expect(setVars[1].data.value).toBe('"OFF"');
  });

  it('clears a variable with MATT\'s "_null" sentinel', async () => {
    await createResetTile(
      scene,
      {
        name: 'Reset',
        image: 'icons/svg/statue.svg',
        tilesToReset: [{ ...baseTileState, variables: { gone: null } }]
      } as any,
      0,
      0
    );

    const setVar = actionsOf(scene).find((a: any) => a.action === 'setvariable');
    // The literal 'null' is eval'd into a live JS null and clears nothing.
    expect(setVar.data.value).toBe('"_null"');
    expect(setVar.data.value).not.toBe('null');
  });

  it("converts the 0-based fileindex to MATT's 1-based tileimage.select", async () => {
    await createResetTile(
      scene,
      {
        name: 'Reset',
        image: 'icons/svg/statue.svg',
        tilesToReset: [{ ...baseTileState, fileindex: 1, variables: {} }]
      } as any,
      0,
      0
    );

    const tileImage = actionsOf(scene).find((a: any) => a.action === 'tileimage');
    expect(tileImage.data.select).toBe('2');
  });

  it('renders per-tile control names in reset-config.hbs', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'templates/reset-config.hbs'), 'utf8');
    // `tile` is a block parameter of `{{#each tiles as |tile|}}`: it is
    // lexically scoped, so `{{../tile.tileId}}` looks for a PROPERTY named
    // `tile` one frame up, finds nothing, and renders empty — producing control
    // names like `fileindex_`.
    expect(source).not.toContain('../tile.');
    expect(source).toContain('name="fileindex_{{tile.tileId}}"');
    expect(source).toContain('name="walldoor_{{tile.tileId}}_{{@index}}"');
    expect(source).toContain('name="var_{{tile.tileId}}_{{variable.name}}"');
  });
});

/* -------------------------------------------- */
/* 3. Check State                                */
/* -------------------------------------------- */

describe('check state tile', () => {
  let scene: any;

  const tilesToCheck = [
    {
      tileId: 'tile-a',
      tileName: 'Switch A',
      variables: [{ variableName: 'switch_1', currentValue: 'ON' }]
    },
    {
      tileId: 'tile-b',
      tileName: 'Switch B',
      variables: [{ variableName: 'switch_1', currentValue: 'OFF' }]
    }
  ];

  beforeEach(() => {
    scene = createMockScene();
    (global as any).canvas.scene = scene;
  });

  it.each([
    ['eq', '== "ON"'],
    ['ne', '!= "ON"']
  ])('honours the %s operator', async (operator, expected) => {
    await createCheckStateTile(
      scene,
      {
        name: 'Check',
        image: 'icons/svg/statue.svg',
        tilesToCheck,
        branches: [
          {
            name: 'Branch',
            conditions: [{ tileId: 'tile-a', variableName: 'switch_1', operator, value: 'ON' }],
            actions: []
          }
        ]
      } as any,
      0,
      0
    );

    const check = actionsOf(scene).find((a: any) => a.action === 'checkvariable');
    expect(check).toBeDefined();
    // Only `eq` used to be emitted; every other operator was silently dropped
    // and the branch then ran unconditionally.
    expect(check.data.value).toBe(expected);
    // `type` is an aggregation over resolved entities, never a comparison.
    expect(check.data.type).toBe('all');
  });

  it.each([
    ['gt', '> 3'],
    ['lt', '< 3'],
    ['gte', '>= 3'],
    ['lte', '<= 3']
  ])('puts the %s comparison in data.value, not data.type', async (operator, expected) => {
    await createCheckStateTile(
      scene,
      {
        name: 'Check',
        image: 'icons/svg/statue.svg',
        tilesToCheck,
        branches: [
          {
            name: 'Branch',
            conditions: [{ tileId: 'tile-a', variableName: 'switch_1', operator, value: '3' }],
            actions: []
          }
        ]
      } as any,
      0,
      0
    );

    const check = actionsOf(scene).find((a: any) => a.action === 'checkvariable');
    // Numeric operands stay unquoted so a stored "10" compares numerically.
    expect(check.data.value).toBe(expected);
    expect(check.data.type).toBe('all');
  });

  it('targets the tile named by the condition, not the first tile with the name', async () => {
    await createCheckStateTile(
      scene,
      {
        name: 'Check',
        image: 'icons/svg/statue.svg',
        tilesToCheck,
        branches: [
          {
            name: 'Branch',
            // Every switch defaults to the variable name `switch_1`, so name-only
            // resolution always picked tile-a and tile-b was untargetable.
            conditions: [
              { tileId: 'tile-b', variableName: 'switch_1', operator: 'eq', value: 'ON' }
            ],
            actions: []
          }
        ]
      } as any,
      0,
      0
    );

    const check = actionsOf(scene).find((a: any) => a.action === 'checkvariable');
    expect(check.data.entity.id).toBe(`Scene.${scene.id}.Tile.tile-b`);
    expect(check.data.entity.name).toBe('Switch B');
  });

  it('expresses an OR connector as separate condition groups', async () => {
    await createCheckStateTile(
      scene,
      {
        name: 'Check',
        image: 'icons/svg/statue.svg',
        tilesToCheck,
        branches: [
          {
            name: 'Either',
            conditions: [
              {
                tileId: 'tile-a',
                variableName: 'switch_1',
                operator: 'eq',
                value: 'ON',
                logicConnector: 'or'
              },
              { tileId: 'tile-b', variableName: 'switch_1', operator: 'eq', value: 'ON' }
            ],
            actions: []
          }
        ]
      } as any,
      0,
      0
    );

    const actions = actionsOf(scene);
    const checks = actions.filter((a: any) => a.action === 'checkvariable');
    expect(checks).toHaveLength(2);

    // First group falls through to the second group's anchor, not to the next
    // branch: an OR must give the second condition a chance.
    expect(checks[0].data.fail).toBe('either_b0_g1');
    expect(checks[1].data.fail).toBe('em_end');

    // A passing first group jumps over the second.
    expect(actions.some((a: any) => a.action === 'goto' && a.data.tag === 'either_b0_body')).toBe(
      true
    );
    expect(actions.some((a: any) => a.action === 'anchor' && a.data.tag === 'either_b0_body')).toBe(
      true
    );
  });

  it('gives branches whose names slugify identically distinct anchors', async () => {
    await createCheckStateTile(
      scene,
      {
        name: 'Check',
        image: 'icons/svg/statue.svg',
        tilesToCheck,
        branches: [
          { name: 'Branch A', conditions: [], actions: [] },
          { name: 'branch-a', conditions: [], actions: [] }
        ]
      } as any,
      0,
      0
    );

    const anchors = actionsOf(scene)
      .filter((a: any) => a.action === 'anchor')
      .map((a: any) => a.data.tag);

    expect(anchors).toContain('branch_a_b0');
    expect(anchors).toContain('branch_a_b1');
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('skips a branch it cannot express rather than running it unconditionally', async () => {
    (global as any).ui.notifications.warn = jest.fn();

    await createCheckStateTile(
      scene,
      {
        name: 'Check',
        image: 'icons/svg/statue.svg',
        tilesToCheck,
        branches: [
          {
            name: 'Bad',
            conditions: [{ tileId: 'nope', variableName: 'missing', operator: 'eq', value: 'ON' }],
            actions: []
          }
        ]
      } as any,
      0,
      0
    );

    const actions = actionsOf(scene);
    expect(actions.some((a: any) => a.action === 'checkvariable')).toBe(false);
    expect(actions.some((a: any) => a.action === 'goto' && a.data.tag === 'em_end')).toBe(true);
    expect((global as any).ui.notifications.warn).toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/* 4, 5, 7. Combat trap                          */
/* -------------------------------------------- */

describe('combat trap', () => {
  let scene: any;
  let tagger: any;

  const baseConfig = {
    name: 'Spear Trap',
    startingImage: 'icons/svg/trap.svg',
    triggeredImage: '',
    hideTrapOnTrigger: false,
    sound: '',
    targetType: TrapTargetType.TRIGGERING,
    itemId: 'Item.weapon123',
    tokenVisible: false,
    maxTriggers: 0
  };

  beforeEach(() => {
    scene = createMockScene();
    (global as any).canvas.scene = scene;

    (global as any).fromUuid = jest.fn(() =>
      Promise.resolve({
        name: 'Spear',
        img: 'icons/weapons/spear.png',
        toObject: () => ({ name: 'Spear' })
      })
    );

    (global as any).game.actors = {
      documentClass: {
        create: jest.fn(() =>
          Promise.resolve({
            id: 'actor123',
            delete: jest.fn(() => Promise.resolve()),
            createEmbeddedDocuments: jest.fn(() => Promise.resolve([{ id: 'item456' }]))
          })
        )
      }
    };
    (global as any).game.folders = { find: jest.fn().mockReturnValue({ id: 'folder789' }) };

    tagger = {
      getTags: jest.fn(() => []),
      setTags: jest.fn(() => Promise.resolve())
    };
    (global as any).Tagger = tagger;
  });

  it('increments the trigger count with MATT syntax, not missing Handlebars helpers', async () => {
    await createCombatTrapTile(scene, { ...baseConfig, maxTriggers: 3 } as any, 0, 0);

    const actions = actionsOf(scene);
    const setVar = actions.find((a: any) => a.action === 'setvariable');

    // `{{default …}}` and `{{add …}}` are not registered helpers; Handlebars'
    // helperMissing THROWS when an unknown helper is called with arguments, so
    // the whole action aborted.
    expect(setVar.data.value).toBe('+ 1');
    expect(setVar.data.value).not.toContain('{{');
    expect(JSON.stringify(actions)).not.toContain('{{default');
    expect(JSON.stringify(actions)).not.toContain('{{add');
  });

  it('puts the trigger-limit comparison in checkvariable.data.value', async () => {
    await createCombatTrapTile(scene, { ...baseConfig, maxTriggers: 3 } as any, 0, 0);

    const check = actionsOf(scene).find((a: any) => a.action === 'checkvariable');
    expect(check.data.value).toBe('> 3');
    // `type` accepts only all|any|none; 'gte' matched none of them, so the
    // filter always took the fail path.
    expect(check.data.type).toBe('all');
  });

  it('does not reveal a hidden trap token on trigger', async () => {
    await createCombatTrapTile(scene, { ...baseConfig, tokenVisible: false } as any, 0, 0);

    const showToken = actionsOf(scene).find(
      (a: any) => a.action === 'showhide' && a.data.entity?.id?.includes('.Token.')
    );
    // An unconditional show defeated tokenVisible:false on the first trigger
    // and left the trap actor permanently exposed.
    expect(showToken).toBeUndefined();
  });

  it('does reveal a visible trap token before it attacks', async () => {
    await createCombatTrapTile(scene, { ...baseConfig, tokenVisible: true } as any, 0, 0);

    const showToken = actionsOf(scene).find(
      (a: any) => a.action === 'showhide' && a.data.entity?.id?.includes('.Token.')
    );
    expect(showToken).toBeDefined();
    expect(showToken.data.hidden).toBe('show');
  });

  it('targets player tokens when the target type says so', async () => {
    await createCombatTrapTile(
      scene,
      { ...baseConfig, targetType: TrapTargetType.PLAYER_TOKENS } as any,
      0,
      0
    );

    const attack = actionsOf(scene).find((a: any) => a.action === 'attack');
    // The old ternary fell through to 'within' for anything that was not
    // TRIGGERING, swallowing PLAYER_TOKENS entirely.
    expect(attack.data.entity.id).toBe('players');
    expect(attack.data.entity.name).toBe('Player Tokens');
  });

  it("writes the trap actor id under this module's own flag scope", async () => {
    await createCombatTrapTile(scene, baseConfig as any, 0, 0);

    const tileCall = scene.createEmbeddedDocuments.mock.calls.find((c: any) => c[0] === 'Tile');
    const flags = tileCall[1][0].flags;

    expect(flags['em-tile-utilities']['em-trap-actor-id']).toBe('actor123');
    expect(flags['monks-active-tiles']['em-trap-actor-id']).toBeUndefined();
  });

  it('reads the trap actor id from either flag scope', async () => {
    const { getCombatTrapActorId } = await import('../../src/utils/creators/combat-trap-creator');

    expect(
      getCombatTrapActorId({ flags: { 'em-tile-utilities': { 'em-trap-actor-id': 'new' } } })
    ).toBe('new');
    // Tiles created before this fix still carry the legacy key.
    expect(
      getCombatTrapActorId({ flags: { 'monks-active-tiles': { 'em-trap-actor-id': 'old' } } })
    ).toBe('old');
    expect(getCombatTrapActorId({ flags: {} })).toBeUndefined();
  });

  it("keeps the user's custom tags", async () => {
    await createCombatTrapTile(scene, { ...baseConfig, customTags: 'Foo, Bar' } as any, 0, 0);

    expect(tagger.setTags).toHaveBeenCalled();
    const tags = (tagger.setTags as any).mock.calls[0][1];
    expect(tags).toContain('Foo');
    expect(tags).toContain('Bar');
  });

  it('rolls the actor and token back when tile creation fails', async () => {
    const actorDelete = jest.fn(() => Promise.resolve());
    (global as any).game.actors.documentClass.create = jest.fn(() =>
      Promise.resolve({
        id: 'actor123',
        delete: actorDelete,
        createEmbeddedDocuments: jest.fn(() => Promise.resolve([{ id: 'item456' }]))
      })
    );

    scene.createEmbeddedDocuments = jest.fn(async (type: string, data: any[]) => {
      if (type === 'Tile') throw new Error('boom');
      return data.map((d: any) => ({ ...d, id: 'token-1' }));
    });
    scene.deleteEmbeddedDocuments = jest.fn(() => Promise.resolve());

    const result = await createCombatTrapTile(scene, baseConfig as any, 0, 0);

    expect(result).toBeNull();
    expect(actorDelete).toHaveBeenCalled();
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledWith('Token', ['token-1']);
    expect(scene.unsetFlag).toHaveBeenCalledWith('em-tile-utilities', 'trap-token-actor123');
  });
});

/* -------------------------------------------- */
/* 5. Target-type resolution                     */
/* -------------------------------------------- */

describe('resolveTargetEntity', () => {
  it('maps every target type, including PLAYER_TOKENS', () => {
    expect(resolveTargetEntity(TrapTargetType.PLAYER_TOKENS)).toEqual({
      id: 'players',
      name: 'Player Tokens'
    });
    expect(resolveTargetEntity(TrapTargetType.WITHIN_TILE)).toEqual({
      id: 'within',
      name: 'Tokens within Tile'
    });
    expect(resolveTargetEntity(TrapTargetType.TRIGGERING)).toEqual({
      id: 'token',
      name: 'Triggering Token'
    });
    expect(resolveTargetEntity(undefined)).toEqual({ id: 'token', name: 'Triggering Token' });
  });
});

/* -------------------------------------------- */
/* 6. Teleport tag matching                      */
/* -------------------------------------------- */

describe('teleport tag matchers', () => {
  it('matches the PascalCase tags the generator actually emits', () => {
    // The cleanup used to test for the prefixes `EM-Teleport-` /
    // `EM-Return-Teleport-`, which nothing has ever produced.
    expect(isTeleportTag('EMTeleport')).toBe(true);
    expect(isTeleportTag('EMTeleport2')).toBe(true);
    expect(isTeleportTag('EM-Teleport-1')).toBe(false);

    expect(isReturnTeleportTag('EMReturnTeleport')).toBe(true);
    expect(isReturnTeleportTag('EMReturnTeleport3')).toBe(true);
  });

  it('never reads a return teleport tag as a main teleport tag', () => {
    expect(isTeleportTag('EMReturnTeleport')).toBe(false);
    expect(isTeleportTag('EMTeleportRoom')).toBe(false);
    expect(isReturnTeleportTag('EMTeleport')).toBe(false);
  });
});

/* -------------------------------------------- */
/* setvariable entity plumbing                   */
/* -------------------------------------------- */

describe('createSetVariableAction', () => {
  it('defaults to the running tile and accepts an explicit owner', () => {
    expect(createSetVariableAction('v', '1').data.entity).toEqual({
      id: 'tile',
      name: 'This Tile'
    });
    expect(
      createSetVariableAction('v', '1', 'scene', { id: 'Scene.s.Tile.t', name: 'Tile: t' }).data
        .entity
    ).toEqual({ id: 'Scene.s.Tile.t', name: 'Tile: t' });
  });
});

/* -------------------------------------------- */
/* 8 & 9. Source-level guards                    */
/* -------------------------------------------- */

describe('grid snapping constants', () => {
  it('never hardcodes a getSnappedPoint mode literal', () => {
    // GRID_SNAPPING_MODES is a BIT FIELD: CENTER 0x1, EDGE_MIDPOINT 0x2,
    // TOP_LEFT_VERTEX 0x10. `mode: 2` snapped to edge midpoints while the
    // comment beside it claimed corners.
    const files = [
      'src/dialogs/trap-dialog.ts',
      'src/dialogs/base-trap-dialog.ts',
      'src/dialogs/check-state-dialog.ts',
      'src/dialogs/tile-manager.ts',
      'src/utils/helpers/tile-preview-helper.ts'
    ];

    for (const rel of files) {
      const source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      expect(source).not.toMatch(/getSnappedPoint\([^)]*\{\s*mode:\s*\d+\s*\}/);
    }
  });
});

describe('dialog stylesheet', () => {
  it('targets the ApplicationV2 root class', () => {
    const css = fs.readFileSync(path.join(REPO_ROOT, 'styles/dialogs.css'), 'utf8');
    // `.window-app` is the ApplicationV1 root; every dialog here is
    // ApplicationV2, whose root carries `.application`.
    expect(css).not.toMatch(/^\s*\.[a-z-]+\.window-app/m);
    expect(css).toContain('.trap-config.application');
  });
});
