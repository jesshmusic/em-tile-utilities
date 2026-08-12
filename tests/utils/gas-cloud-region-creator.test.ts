/**
 * Tests for the gas cloud / aura creator.
 *
 * The load-bearing assertion is that `applyActiveEffect` receives a `system`
 * with a single `effects` array of ActiveEffect UUIDs — the v14 schema, which
 * replaced v12/v13's `uuid` + `overrides`. Status effect ids are NOT valid
 * there, so the tests also pin the id-to-UUID materialization.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import {
  createGasCloudRegion,
  GasCloudModes,
  GAS_CLOUD_COLOR
} from '../../src/utils/creators/gas-cloud-region-creator';
import type { GasCloudRegionConfig } from '../../src/utils/creators/gas-cloud-region-creator';
import {
  createApplyActiveEffectRegionBehavior,
  APPLY_ACTIVE_EFFECT_TYPE
} from '../../src/utils/builders/region-behavior-builder';
import {
  parseEffectUuids,
  resolveStatusEffectUuids
} from '../../src/utils/helpers/region-effect-helpers';

describe('createApplyActiveEffectRegionBehavior', () => {
  it('emits the un-namespaced core type', () => {
    const behavior = createApplyActiveEffectRegionBehavior({ effects: [] });
    expect(behavior.type).toBe('applyActiveEffect');
    expect(APPLY_ACTIVE_EFFECT_TYPE).toBe('applyActiveEffect');
  });

  it('carries effects as a flat UUID array under system.effects', () => {
    const behavior = createApplyActiveEffectRegionBehavior({
      effects: ['Item.a.ActiveEffect.b', 'Item.c.ActiveEffect.d']
    });
    expect(behavior.system).toEqual({
      effects: ['Item.a.ActiveEffect.b', 'Item.c.ActiveEffect.d']
    });
  });

  it('does not emit an events key — enter/exit are declared statically', () => {
    const behavior = createApplyActiveEffectRegionBehavior({ effects: [] });
    expect(behavior).not.toHaveProperty('events');
    expect(behavior.system).not.toHaveProperty('events');
  });
});

describe('parseEffectUuids', () => {
  it('splits on commas, semicolons and newlines', () => {
    expect(parseEffectUuids('Item.a.ActiveEffect.b, Item.c.ActiveEffect.d')).toEqual([
      'Item.a.ActiveEffect.b',
      'Item.c.ActiveEffect.d'
    ]);
  });

  it('drops anything that does not name an ActiveEffect', () => {
    expect(parseEffectUuids('Item.a.ActiveEffect.b, Actor.nope, junk')).toEqual([
      'Item.a.ActiveEffect.b'
    ]);
  });

  it('deduplicates and tolerates an empty field', () => {
    expect(parseEffectUuids('Item.a.ActiveEffect.b,Item.a.ActiveEffect.b')).toEqual([
      'Item.a.ActiveEffect.b'
    ]);
    expect(parseEffectUuids(undefined)).toEqual([]);
    expect(parseEffectUuids('')).toEqual([]);
  });
});

describe('resolveStatusEffectUuids', () => {
  let holder: any;

  beforeEach(() => {
    holder = {
      uuid: 'Item.holder1',
      // A Foundry EmbeddedCollection is Map-like; only `get` is used.
      effects: new Map<string, any>(),
      createEmbeddedDocuments: jest.fn(async () => [])
    };

    (global as any).game.items = {
      find: jest.fn(() => holder)
    };
    (global as any).game.folders = { find: jest.fn(() => ({ id: 'folder1' })) };
    (global as any).CONFIG = {
      ActiveEffect: {
        documentClass: {
          // Deterministic ids are the whole point — dnd5e derives a staticID
          // from the status, which is what makes reuse possible.
          fromStatusEffect: jest.fn(async (id: string) => ({
            toObject: () => ({ _id: `dnd5e${id}`.padEnd(16, '0'), name: id, statuses: [id] })
          }))
        }
      }
    };
  });

  it('turns status ids into UUIDs on the holder item', async () => {
    const uuids = await resolveStatusEffectUuids(['poisoned']);
    expect(uuids).toEqual(['Item.holder1.ActiveEffect.dnd5epoisoned000']);
  });

  it('creates the effects with keepId so the UUIDs stay valid', async () => {
    await resolveStatusEffectUuids(['poisoned']);
    const [collection, data, options] = (holder.createEmbeddedDocuments as any).mock.calls[0];
    expect(collection).toBe('ActiveEffect');
    expect(data[0].name).toBe('poisoned');
    expect(options).toEqual({ keepId: true });
  });

  it('reuses an effect already on the holder instead of duplicating it', async () => {
    holder.effects.set('dnd5epoisoned000', {
      uuid: 'Item.holder1.ActiveEffect.dnd5epoisoned000'
    });

    const uuids = await resolveStatusEffectUuids(['poisoned']);

    expect(uuids).toEqual(['Item.holder1.ActiveEffect.dnd5epoisoned000']);
    expect(holder.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it('deduplicates repeated ids', async () => {
    const uuids = await resolveStatusEffectUuids(['poisoned', 'poisoned']);
    expect(uuids).toHaveLength(1);
  });

  it('skips a status the system does not define rather than failing', async () => {
    (global as any).CONFIG.ActiveEffect.documentClass.fromStatusEffect = jest.fn(
      async (id: string) => {
        if (id === 'bogus') throw new Error('unknown status');
        return { toObject: () => ({ _id: `dnd5e${id}`.padEnd(16, '0'), name: id }) };
      }
    );

    const uuids = await resolveStatusEffectUuids(['bogus', 'poisoned']);
    expect(uuids).toEqual(['Item.holder1.ActiveEffect.dnd5epoisoned000']);
  });

  it('returns nothing for an empty request without touching the world', async () => {
    expect(await resolveStatusEffectUuids([])).toEqual([]);
    expect((global as any).game.items.find).not.toHaveBeenCalled();
  });
});

describe('createGasCloudRegion', () => {
  let mockScene: any;
  let region: any;

  beforeEach(() => {
    mockScene = createMockScene();
    region = { id: 'region-1', createEmbeddedDocuments: jest.fn(async () => []) };
    mockScene.createEmbeddedDocuments = jest.fn(async () => [region]);
    (global as any).canvas.scene = mockScene;
    (global as any).canvas.grid = { size: 100 };

    (global as any).game.items = { find: jest.fn(() => undefined) };
    (global as any).game.folders = { find: jest.fn(() => undefined) };
    (global as any).CONFIG = { ActiveEffect: { documentClass: {} } };
  });

  const basicConfig: GasCloudRegionConfig = {
    name: 'Stinking Cloud',
    mode: GasCloudModes.CLOUD,
    effectUuids: 'Item.a.ActiveEffect.poison'
  };

  it('creates a cloud region with the gas colour at the dragged rectangle', async () => {
    await createGasCloudRegion(mockScene, basicConfig, 100, 200, 300, 400);

    const regionData = (mockScene.createEmbeddedDocuments as any).mock.calls[0][1][0];
    expect(regionData.name).toBe('Stinking Cloud');
    expect(regionData.color).toBe(GAS_CLOUD_COLOR);
    expect(regionData.shapes[0]).toMatchObject({ x: 100, y: 200, width: 300, height: 400 });
  });

  it('attaches one applyActiveEffect behavior holding the effect UUIDs', async () => {
    await createGasCloudRegion(mockScene, basicConfig, 0, 0);

    const [collection, behaviors] = (region.createEmbeddedDocuments as any).mock.calls[0];
    expect(collection).toBe('RegionBehavior');
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0].type).toBe('applyActiveEffect');
    expect(behaviors[0].system.effects).toEqual(['Item.a.ActiveEffect.poison']);
  });

  it('still builds the region when no effects are chosen yet', async () => {
    await createGasCloudRegion(mockScene, { name: 'Empty Fog' }, 0, 0);

    const behaviors = (region.createEmbeddedDocuments as any).mock.calls[0][1];
    expect(behaviors[0].system.effects).toEqual([]);
  });

  it('tags clouds so the Tile Manager and Tagger can find them', async () => {
    await createGasCloudRegion(mockScene, basicConfig, 0, 0);

    expect((globalThis as any).Tagger.setTags).toHaveBeenCalledWith(
      region,
      expect.arrayContaining(['EM_Region', 'EM_Aura'])
    );
  });

  it('uses createTokenEmanation in aura mode, passing range in grid units', async () => {
    const token = { id: 'token-1', name: 'Troll' };
    mockScene.tokens = new Map([['token-1', token]]);

    const createTokenEmanation = jest.fn(async (..._args: any[]) => region);
    (globalThis as any).foundry.documents = { RegionDocument: { createTokenEmanation } };

    await createGasCloudRegion(mockScene, {
      name: 'Stench',
      mode: GasCloudModes.EMANATION,
      tokenId: 'token-1',
      range: 15,
      excludeToken: true,
      gridBased: true,
      effectUuids: 'Item.a.ActiveEffect.poison'
    });

    expect(createTokenEmanation).toHaveBeenCalledWith(
      token,
      15,
      expect.objectContaining({ name: 'Stench', color: GAS_CLOUD_COLOR, behaviors: [] }),
      { excludeToken: true, gridBased: true }
    );
    // Behaviors are added afterwards, never inside the emanation's regionData —
    // createTokenEmanation overwrites shapes/elevation/attachment/levels only,
    // but the module's convention is to attach behaviors post-create.
    expect(region.createEmbeddedDocuments).toHaveBeenCalled();
  });

  it('floors a zero or missing aura range at one grid unit', async () => {
    const token = { id: 'token-1' };
    mockScene.tokens = new Map([['token-1', token]]);
    const createTokenEmanation = jest.fn(async (..._args: any[]) => region);
    (globalThis as any).foundry.documents = { RegionDocument: { createTokenEmanation } };

    await createGasCloudRegion(mockScene, {
      name: 'Aura',
      mode: GasCloudModes.EMANATION,
      tokenId: 'token-1',
      range: 0
    });

    expect((createTokenEmanation as any).mock.calls[0][1]).toBe(1);
  });

  it('creates nothing when the aura names a token that is not on the scene', async () => {
    mockScene.tokens = new Map();
    const createTokenEmanation = jest.fn(async (..._args: any[]) => region);
    (globalThis as any).foundry.documents = { RegionDocument: { createTokenEmanation } };

    await createGasCloudRegion(mockScene, {
      name: 'Aura',
      mode: GasCloudModes.EMANATION,
      tokenId: 'missing'
    });

    expect(createTokenEmanation).not.toHaveBeenCalled();
    expect(region.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
