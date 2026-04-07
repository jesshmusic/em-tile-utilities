/**
 * Base tile data structure builder
 */

/**
 * Create base tile data with common properties
 * @param config - Tile configuration
 * @returns Base tile data object
 */
export function createBaseTileData(config: {
  textureSrc: string;
  width: number;
  height: number;
  x: number;
  y: number;
  hidden?: boolean;
  locked?: boolean;
  alpha?: number;
  rotation?: number;
  elevation?: number;
  visible?: boolean;
}): any {
  return {
    texture: {
      src: config.textureSrc,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'fill',
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      tint: '#ffffff',
      alphaThreshold: 0.75
    },
    width: config.width,
    height: config.height,
    x: config.x,
    y: config.y,
    elevation: config.elevation ?? 0,
    sort: 0,
    // Foundry v14: `occlusion.mode` (singular number) was replaced with
    // `occlusion.modes` (SetField of numbers). The legacy value
    // `OCCLUSION_MODES.NONE` (0) is no longer a valid element of the set —
    // "no occlusion" is now represented by an empty set. Foundry's
    // compatibility migration `_addDataFieldMigration("occlusion.mode",
    // "occlusion.modes", d => [d.occlusion.mode])` wraps the old `mode: 0`
    // into `modes: [0]` and then fails validation because `0` isn't in the
    // allowed choices for the new SetField. Use `modes: []` directly.
    // See foundry.mjs:25381-25408 (BaseTile.defineSchema) and CONST.OCCLUSION_MODES.
    occlusion: { modes: [], alpha: 0 },
    rotation: config.rotation ?? 0,
    alpha: config.alpha ?? 1,
    hidden: config.hidden ?? false,
    locked: config.locked ?? false,
    restrictions: { light: false, weather: false },
    video: { loop: true, autoplay: true, volume: 0 },
    visible: config.visible ?? true,
    img: config.textureSrc
  };
}
