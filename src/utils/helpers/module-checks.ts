/**
 * Module availability checks for Foundry VTT modules
 */

/**
 * Check if Monk's Token Bar module is installed and active
 * @returns true if Monk's Token Bar is available, false otherwise
 */
import { notifyError } from '../../dialogs/notify';
import { EM_REGION_BEHAVIOR_TYPES } from '../region-behaviors/constants';

export function hasMonksTokenBar(): boolean {
  // Use globalThis.game for test compatibility, fall back to global game
  const g = (globalThis as any).game || game;
  return !!g?.modules?.get('monks-tokenbar')?.active;
}

/**
 * Check if midi-qol is installed and active.
 *
 * Mirrors the detection Enhanced Region Behaviors uses for its own traps
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:109) so tile
 * traps and region traps agree about whether midi owns damage application.
 *
 * @returns true if midi-qol is available, false otherwise
 */
export function hasMidiQol(): boolean {
  const g = (globalThis as any).game || game;
  return !!g?.modules?.get('midi-qol')?.active;
}

/**
 * Check if Enhanced Region Behaviors module is installed and active.
 *
 * This module no longer requires it for anything. As of v2.3.0 trap, elevation
 * and sound region behaviors are registered by this module itself
 * (src/utils/region-behaviors/), and `requireEnhancedRegionBehaviors()` — the
 * guard that used to refuse to build a trap region without ERB — is gone. The
 * check survives only so a world that still contains ERB-typed regions built
 * before that change can be reasoned about.
 *
 * @returns true if Enhanced Region Behaviors is available, false otherwise
 */
export function hasEnhancedRegionBehaviors(): boolean {
  // Use globalThis.game for test compatibility, fall back to global game
  const g = (globalThis as any).game || game;
  return !!g?.modules?.get('enhanced-region-behavior')?.active;
}

/**
 * Whether the server has picked up this module's RegionBehavior subtypes.
 *
 * `documentTypes` in `module.json` is read by the **server**, not the client,
 * and only when it (re)reads the manifest. So immediately after an update the
 * client can have `CONFIG.RegionBehavior.dataModels` fully populated — every
 * subtype looks registered — while the server still rejects them.
 *
 * The dangerous part is how it rejects: `createEmbeddedDocuments` returns an
 * **empty array rather than throwing**. Without this check a creator builds a
 * region, silently gets none of its behaviors, tags it, reports success, and
 * leaves the GM with a region that looks right and does nothing. Verified live
 * on 14.364: `game.documentTypes.RegionBehavior` listed every other module's
 * subtypes and none of ours until the world was restarted.
 *
 * `game.documentTypes` is the server's list, which is exactly the thing that
 * lags; `CONFIG.RegionBehavior.dataModels` is the client's and is useless here.
 */
export function hasEmRegionBehaviors(): boolean {
  const g = (globalThis as any).game || game;
  const known: string[] = g?.documentTypes?.RegionBehavior ?? [];
  // An empty list means we cannot tell — assume available rather than blocking
  // region creation on a probe that failed.
  if (known.length === 0) return true;
  return EM_REGION_BEHAVIOR_TYPES.every(type => known.includes(type));
}

/**
 * Guard for creators that build regions out of this module's own behaviors.
 *
 * @returns true when it is safe to proceed; false after warning the GM
 */
export function requireEmRegionBehaviors(): boolean {
  if (hasEmRegionBehaviors()) return true;
  notifyError('EMPUZZLES.NotifyRegionBehaviorsNeedRestart');
  return false;
}
