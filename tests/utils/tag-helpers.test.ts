/**
 * Tests for tag-helpers
 *
 * The teleport matchers are deliberately tested against tags produced by
 * generateUniqueEMTag rather than against hardcoded strings. Hardcoding both
 * sides is what allowed the producer ("EMTeleport") and the consumer
 * ("EM-Teleport-") to drift, which silently disabled paired-teleport cleanup.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockFoundry } from '../mocks/foundry';

mockFoundry();

import {
  getAllTagsInScene,
  generateUniqueEMTag,
  generateUniqueLightTag,
  generateUniqueTrapTag,
  isTeleportTag,
  isReturnTeleportTag
} from '../../src/utils/helpers/tag-helpers';

/**
 * Build a scene stub whose embedded collections are Foundry-ish Maps. Each doc
 * carries its own `tags` array, which the Tagger stub below reads back.
 */
function makeScene(collections: Record<string, string[][]>, id = 'scene-1'): any {
  const scene: any = { id };
  for (const [name, docTags] of Object.entries(collections)) {
    const docs = docTags.map((tags, i) => ({ id: `${name}-${i}`, tags }));
    scene[name] = new Map(docs.map(d => [d.id, d]));
  }
  return scene;
}

describe('tag-helpers', () => {
  beforeEach(() => {
    (globalThis as any).Tagger.getTags = jest.fn((doc: any) => doc?.tags ?? []);
    (global as any).game.modules.get = jest.fn(() => ({ active: true }));
    (global as any).canvas.scene = null;
  });

  describe('teleport tag matchers', () => {
    it('recognizes the tag generateUniqueEMTag actually produces for a main teleport', () => {
      const tag = generateUniqueEMTag('Teleport');

      expect(isTeleportTag(tag)).toBe(true);
      expect(isReturnTeleportTag(tag)).toBe(false);
    });

    it('recognizes the tag generateUniqueEMTag actually produces for a return teleport', () => {
      const tag = generateUniqueEMTag('Return Teleport');

      expect(isReturnTeleportTag(tag)).toBe(true);
      // Ordering hazard: "EMReturnTeleport" must never read as an outbound tag.
      expect(isTeleportTag(tag)).toBe(false);
    });

    it('matches the numeric suffix the generator appends when disambiguating', () => {
      const first = generateUniqueEMTag('Teleport');
      (global as any).canvas.scene = makeScene({ tiles: [[first]] });
      const second = generateUniqueEMTag('Teleport');

      // Guard the premise: the generator must actually have numbered this one.
      expect(second).not.toBe(first);
      expect(isTeleportTag(second)).toBe(true);
      expect(isReturnTeleportTag(second)).toBe(false);
    });

    it('matches numbered return teleport tags without misclassifying them', () => {
      const first = generateUniqueEMTag('Return Teleport');
      (global as any).canvas.scene = makeScene({ tiles: [[first]] });
      const second = generateUniqueEMTag('Return Teleport');

      expect(second).not.toBe(first);
      expect(isReturnTeleportTag(second)).toBe(true);
      expect(isTeleportTag(second)).toBe(false);
    });

    it('does not match tags that merely contain the teleport base name', () => {
      // A trap whose result type is "teleport" is not half of a teleport pair.
      const trapTag = generateUniqueTrapTag('Floor Trap', 'teleport');

      expect(isTeleportTag(trapTag)).toBe(false);
      expect(isReturnTeleportTag(trapTag)).toBe(false);
      expect(isTeleportTag('EMTeleportPad')).toBe(false);
      expect(isTeleportTag('EM-Teleport-1')).toBe(false);
      expect(isTeleportTag('')).toBe(false);
    });
  });

  describe('getAllTagsInScene', () => {
    it('collects tags from tiles, lights, sounds, regions and tokens', () => {
      (global as any).canvas.scene = makeScene({
        tiles: [['EMTileTag']],
        lights: [['EMLightTag']],
        sounds: [['EMSoundTag']],
        regions: [['EMRegionTag']],
        tokens: [['EMTokenTag']]
      });

      const tags = getAllTagsInScene();

      expect(tags).toEqual(
        expect.arrayContaining([
          'EMTileTag',
          'EMLightTag',
          'EMSoundTag',
          'EMRegionTag',
          'EMTokenTag'
        ])
      );
    });

    it('de-duplicates tags shared across collections', () => {
      (global as any).canvas.scene = makeScene({
        tiles: [['EMShared']],
        regions: [['EMShared']]
      });

      expect(getAllTagsInScene().filter(t => t === 'EMShared')).toHaveLength(1);
    });

    it('tolerates a scene missing some embedded collections', () => {
      (global as any).canvas.scene = makeScene({ tiles: [['EMOnlyTiles']] });

      expect(() => getAllTagsInScene()).not.toThrow();
      expect(getAllTagsInScene()).toEqual(['EMOnlyTiles']);
    });

    it('reads the supplied scene instead of the active one', () => {
      (global as any).canvas.scene = makeScene({ tiles: [['EMActiveScene']] });
      const other = makeScene({ regions: [['EMOtherScene']] }, 'scene-2');

      expect(getAllTagsInScene(other)).toEqual(['EMOtherScene']);
    });

    it('returns an empty array when Tagger is inactive', () => {
      (global as any).game.modules.get = jest.fn(() => ({ active: false }));
      (global as any).canvas.scene = makeScene({ tiles: [['EMTileTag']] });

      expect(getAllTagsInScene()).toEqual([]);
    });
  });

  describe('unique tag generation against a specific scene', () => {
    it('avoids collisions on the destination scene, not just the active one', () => {
      const base = generateUniqueEMTag('Return Teleport');
      // Active scene is clean; the cross-scene destination already holds the tag.
      (global as any).canvas.scene = makeScene({ tiles: [] });
      const destination = makeScene({ tiles: [[base]] }, 'destination');

      expect(generateUniqueEMTag('Return Teleport', destination)).not.toBe(base);
      expect(isReturnTeleportTag(generateUniqueEMTag('Return Teleport', destination))).toBe(true);
    });

    it('avoids collisions against region tags, which used to be invisible', () => {
      const base = generateUniqueEMTag('Teleport');
      (global as any).canvas.scene = makeScene({ regions: [[base]] });

      expect(generateUniqueEMTag('Teleport')).not.toBe(base);
    });

    it('forwards the optional scene through the light and trap wrappers', () => {
      const lightBase = generateUniqueLightTag('Torch');
      const trapBase = generateUniqueTrapTag('Floor Trap', 'damage');
      (global as any).canvas.scene = makeScene({ tiles: [] });
      const destination = makeScene({ tokens: [[lightBase]], sounds: [[trapBase]] }, 'destination');

      expect(generateUniqueLightTag('Torch', destination)).not.toBe(lightBase);
      expect(generateUniqueTrapTag('Floor Trap', 'damage', destination)).not.toBe(trapBase);
    });
  });
});
