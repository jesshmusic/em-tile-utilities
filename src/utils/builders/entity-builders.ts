/**
 * Entity creation builders for Foundry VTT entities
 */

import { TrapTargetType } from '../../types/module';

/**
 * A Monk's Active Tiles entity reference.
 */
export interface MonksEntity {
  id: string;
  name: string;
}

/**
 * Resolve a trap's target type to the Monk's Active Tiles entity reference.
 *
 * This is the single source of truth for the mapping. It used to be hand-rolled
 * at each call site, and the copies written as
 * `targetType === TRIGGERING ? 'token' : 'within'` silently swallowed
 * PLAYER_TOKENS, targeting tokens inside the tile instead of every player token.
 *
 * @param targetType - The configured trap target type
 * @returns The `data.entity` value for the resulting action
 */
export function resolveTargetEntity(targetType?: TrapTargetType): MonksEntity {
  switch (targetType) {
    case TrapTargetType.PLAYER_TOKENS:
      return { id: 'players', name: 'Player Tokens' };
    case TrapTargetType.WITHIN_TILE:
      return { id: 'within', name: 'Tokens within Tile' };
    case TrapTargetType.TRIGGERING:
    default:
      return { id: 'token', name: 'Triggering Token' };
  }
}

/**
 * Create an AmbientLight entity
 * @param x - X coordinate (usually centered on tile)
 * @param y - Y coordinate (usually centered on tile)
 * @param config - Light configuration
 * @returns Light data object
 */
export function createAmbientLightData(
  x: number,
  y: number,
  config: {
    color?: string | null;
    dimLight: number;
    brightLight: number;
    colorIntensity?: number;
    useDarkness?: boolean;
    darknessMin?: number;
    hidden?: boolean;
  }
): any {
  return {
    x,
    y,
    rotation: 0,
    elevation: 0,
    walls: true,
    vision: false,
    config: {
      angle: 360,
      color: config.color || null,
      dim: config.dimLight,
      bright: config.brightLight,
      alpha: config.colorIntensity ?? 0.5,
      negative: false,
      priority: 0,
      coloration: 1,
      attenuation: 0.5,
      luminosity: 0.5,
      saturation: 0,
      contrast: 0,
      shadows: 0,
      animation: {
        type: null,
        speed: 5,
        intensity: 5,
        reverse: false
      },
      darkness: {
        min: config.useDarkness ? (config.darknessMin ?? 0) : 0,
        max: 1
      }
    },
    hidden: config.hidden ?? !config.useDarkness // Start hidden for click-based, visible for darkness-based
  };
}

/**
 * Create an AmbientSound entity
 * @param x - X coordinate (usually centered on tile)
 * @param y - Y coordinate (usually centered on tile)
 * @param soundPath - Path to the sound file
 * @param options - Optional configuration
 * @returns Sound data object
 */
export function createAmbientSoundData(
  x: number,
  y: number,
  soundPath: string,
  options?: {
    radius?: number;
    volume?: number;
    easing?: boolean;
    repeat?: boolean;
    hidden?: boolean;
  }
): any {
  return {
    x,
    y,
    radius: options?.radius ?? 40,
    path: soundPath,
    volume: options?.volume ?? 0.5,
    easing: options?.easing ?? true,
    repeat: options?.repeat ?? true,
    hidden: options?.hidden ?? true,
    walls: true
  };
}

/**
 * Create an Actor for trap combatants
 * @param name - Actor name
 * @param folderId - Folder ID to place the actor in
 * @returns Actor data object
 */
export function createTrapActorData(name: string, folderId: string): any {
  return {
    name,
    type: 'npc',
    folder: folderId,
    prototypeToken: {
      name,
      disposition: -1, // Hostile
      actorLink: false,
      vision: true,
      dimSight: 0,
      brightSight: 0,
      dimLight: 0,
      brightLight: 0
    }
  };
}
