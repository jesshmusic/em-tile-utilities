/**
 * Module availability checks for Foundry VTT modules
 */

/**
 * Check if Monk's Token Bar module is installed and active
 * @returns true if Monk's Token Bar is available, false otherwise
 */
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
