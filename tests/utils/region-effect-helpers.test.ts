/**
 * Region effect helpers — the piece that makes gas clouds possible.
 *
 * `applyActiveEffect`'s schema is a set of ActiveEffect **UUIDs**, but a status
 * effect is not a document and has no UUID. These helpers bridge that by
 * materialising chosen statuses onto one shared hidden world Item, and the
 * deterministic-id behaviour is the whole point: re-running a dialog must reuse
 * the effects it made last time rather than pile up duplicates in the sidebar.
 *
 * The tests below drive the real branches — reuse, partial failure, unknown
 * status ids, worlds where Item creation is unavailable — because those are the
 * paths a GM actually lands on and none were exercised.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';
mockFoundry();

import {
  resolveStatusEffectUuids,
  parseEffectUuids,
  EFFECT_HOLDER_NAME,
  EFFECT_HOLDER_FOLDER
} from '../../src/utils/helpers/region-effect-helpers';

/** Build a fake holder Item whose embedded effects are addressable by id. */
function makeHolder(existingIds: string[] = []) {
  const effects = new Map(existingIds.map(id => [id, { uuid: `Item.holder.ActiveEffect.${id}` }]));
  return {
    uuid: 'Item.holder',
    name: EFFECT_HOLDER_NAME,
    effects: { get: (id: string) => effects.get(id) },
    createEmbeddedDocuments: jest.fn(async (_t: string, data: any[]) => {
      data.forEach(d => effects.set(d._id, { uuid: `Item.holder.ActiveEffect.${d._id}` }));
      return data;
    }),
    getFlag: () => true
  };
}

/** Status ids the fake system knows about, mapped to deterministic ids. */
const KNOWN: Record<string, string> = {
  poisoned: 'staticpoisoned01',
  blinded: 'staticblinded001',
  prone: 'staticprone00001'
};

function installWorld(opts: { holder?: any; items?: any[]; canCreateItem?: boolean } = {}) {
  const items = opts.items ?? [];
  (global as any).game.items = {
    find: (fn: any) => items.find(fn)
  };
  (global as any).game.folders = { find: () => ({ id: 'folder-1' }) };
  (global as any).game.documentTypes = { Item: ['base', 'loot', 'weapon'] };

  (globalThis as any).Item = {
    create:
      opts.canCreateItem === false ? undefined : jest.fn(async () => opts.holder ?? makeHolder())
  };

  (globalThis as any).CONFIG = {
    ActiveEffect: {
      documentClass: {
        fromStatusEffect: jest.fn(async (id: string) => {
          if (!(id in KNOWN)) throw new Error('unknown status');
          return { toObject: () => ({ _id: KNOWN[id], name: id }) };
        })
      }
    }
  };
}

describe('parseEffectUuids', () => {
  it('returns nothing for empty input', () => {
    expect(parseEffectUuids()).toEqual([]);
    expect(parseEffectUuids('')).toEqual([]);
  });

  it.each([
    ['comma', 'Item.a.ActiveEffect.1,Item.b.ActiveEffect.2'],
    ['semicolon', 'Item.a.ActiveEffect.1;Item.b.ActiveEffect.2'],
    ['newline', 'Item.a.ActiveEffect.1\nItem.b.ActiveEffect.2']
  ])('splits on %s', (_label, raw) => {
    expect(parseEffectUuids(raw)).toEqual(['Item.a.ActiveEffect.1', 'Item.b.ActiveEffect.2']);
  });

  it('trims surrounding whitespace', () => {
    expect(parseEffectUuids('  Item.a.ActiveEffect.1  ')).toEqual(['Item.a.ActiveEffect.1']);
  });

  it('drops anything that does not name an ActiveEffect', () => {
    expect(parseEffectUuids('Actor.a.Item.b, Item.a.ActiveEffect.1, nonsense')).toEqual([
      'Item.a.ActiveEffect.1'
    ]);
  });

  it('de-duplicates', () => {
    expect(parseEffectUuids('Item.a.ActiveEffect.1, Item.a.ActiveEffect.1')).toHaveLength(1);
  });
});

describe('resolveStatusEffectUuids', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns nothing for an empty request without touching the world', async () => {
    installWorld();
    expect(await resolveStatusEffectUuids([])).toEqual([]);
    expect((globalThis as any).Item.create).not.toHaveBeenCalled();
  });

  it('ignores blank and non-string ids', async () => {
    installWorld();
    expect(await resolveStatusEffectUuids(['', null as any, undefined as any])).toEqual([]);
  });

  it('creates effects for new statuses and returns their UUIDs', async () => {
    const holder = makeHolder();
    installWorld({ holder });
    const uuids = await resolveStatusEffectUuids(['poisoned', 'blinded']);

    expect(uuids).toEqual([
      `Item.holder.ActiveEffect.${KNOWN.poisoned}`,
      `Item.holder.ActiveEffect.${KNOWN.blinded}`
    ]);
    const [, created, options] = holder.createEmbeddedDocuments.mock.calls[0] as any[];
    expect(created).toHaveLength(2);
    // keepId is mandatory: the UUIDs above assume the deterministic ids survive.
    expect(options).toEqual({ keepId: true });
  });

  it('reuses an effect already on the holder instead of creating a duplicate', async () => {
    const holder = makeHolder([KNOWN.poisoned]);
    installWorld({ holder, items: [holder] });
    const uuids = await resolveStatusEffectUuids(['poisoned']);

    expect(uuids).toEqual([`Item.holder.ActiveEffect.${KNOWN.poisoned}`]);
    expect(holder.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it('creates only the statuses that are missing', async () => {
    const holder = makeHolder([KNOWN.poisoned]);
    installWorld({ holder, items: [holder] });
    await resolveStatusEffectUuids(['poisoned', 'blinded']);

    const created = (holder.createEmbeddedDocuments.mock.calls[0] as any[])[1];
    expect(created.map((e: any) => e._id)).toEqual([KNOWN.blinded]);
  });

  it('de-duplicates repeated ids in one request', async () => {
    const holder = makeHolder();
    installWorld({ holder });
    const uuids = await resolveStatusEffectUuids(['poisoned', 'poisoned']);
    expect(uuids).toHaveLength(1);
  });

  it('skips a status the system does not define, keeping the rest', async () => {
    // A macro passing a stale id should still produce a working region.
    const holder = makeHolder();
    installWorld({ holder });
    const uuids = await resolveStatusEffectUuids(['poisoned', 'bogus', 'prone']);
    expect(uuids).toEqual([
      `Item.holder.ActiveEffect.${KNOWN.poisoned}`,
      `Item.holder.ActiveEffect.${KNOWN.prone}`
    ]);
  });

  it('returns nothing when the world cannot create the holder Item', async () => {
    installWorld({ canCreateItem: false });
    expect(await resolveStatusEffectUuids(['poisoned'])).toEqual([]);
  });

  it('returns nothing when the system has no fromStatusEffect', async () => {
    installWorld();
    (globalThis as any).CONFIG = { ActiveEffect: { documentClass: {} } };
    expect(await resolveStatusEffectUuids(['poisoned'])).toEqual([]);
  });

  it('drops the UUIDs it could not create when the create call fails', async () => {
    const holder = makeHolder([KNOWN.poisoned]);
    holder.createEmbeddedDocuments = jest.fn(async () => {
      throw new Error('no permission');
    }) as any;
    installWorld({ holder, items: [holder] });

    // poisoned already exists so it survives; blinded was to be created and must not
    // be reported as available when creation failed.
    const uuids = await resolveStatusEffectUuids(['poisoned', 'blinded']);
    expect(uuids).toEqual([`Item.holder.ActiveEffect.${KNOWN.poisoned}`]);
  });

  it('finds the holder by flag even when it has been renamed', async () => {
    const renamed = makeHolder([KNOWN.poisoned]);
    renamed.name = 'A GM renamed this';
    installWorld({ items: [renamed] });
    await resolveStatusEffectUuids(['poisoned']);
    // Resolved against the renamed holder, so no second holder was created.
    expect((globalThis as any).Item.create).not.toHaveBeenCalled();
  });
});

describe('holder naming', () => {
  it('names the holder and its folder recognisably', () => {
    // A GM who finds this Item in their sidebar should be able to tell what
    // made it and why.
    expect(EFFECT_HOLDER_NAME).toContain('Tile Utilities');
    expect(EFFECT_HOLDER_FOLDER).toContain('Tile Utilities');
  });
});
