/**
 * Scene level helpers.
 *
 * Foundry v14 gave every canvas document a `levels` field — a `SetField` of
 * Level document ids (`SceneLevelsSetField`, common/data/fields.mjs:4692) —
 * and `Region` carries one. `CanvasDocumentMixin#includedInLevel`
 * (client/documents/abstract/canvas-document.mjs:97) reads an **empty** set as
 * "included in every level", so leaving it off is not neutral: it puts the
 * region on the ground floor, the roof and every level in between.
 *
 * Foundry's own creation paths scope a new placeable to the level being
 * viewed — `PlaceablePaletteMixin._getDefaultLevelData` returns
 * `{levels: [canvas.level.id], …}` and `RegionLayer#_getNewPlaceableData` does
 * the same for template regions. These creators follow that, so a region built
 * while looking at the cellar stays in the cellar.
 */

/**
 * The level ids a newly created region should carry.
 *
 * Returns the viewed level when there is one and the scene actually contains
 * it; otherwise an empty array, which Foundry reads as "every level". The
 * scene check matters because `levels` entries are validated as document ids
 * belonging to that scene — a stale `canvas.level` from a different scene
 * would fail validation on create and take the whole region with it.
 *
 * @param scene - The scene the region is being created in
 * @returns Level ids for the region's `levels` field
 */
export function getRegionLevelIds(scene?: any): string[] {
  const levelId = (globalThis as any).canvas?.level?.id;
  if (typeof levelId !== 'string' || levelId.length === 0) return [];

  const sceneLevels = scene?.levels;
  if (sceneLevels && typeof sceneLevels.get === 'function' && !sceneLevels.get(levelId)) return [];

  return [levelId];
}
