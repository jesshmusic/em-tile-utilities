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
