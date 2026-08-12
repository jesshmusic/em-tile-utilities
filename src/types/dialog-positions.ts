/**
 * Centralized dialog position configurations
 * All dialog window sizes and positions defined in one place
 * Dialogs are centered on screen by default (no left/top specified)
 */

/**
 * Dialog position configuration type
 */
export interface DialogPosition {
  width: number | 'auto';
  height: number | 'auto';
  left?: number;
  top?: number;
}

/**
 * Default dialog position - inherited by all dialogs unless overridden.
 *
 * `height: 'auto'` lets ApplicationV2 size the window to its content instead
 * of forcing a fixed pixel height. This is only safe for the dialogs whose
 * root class appears in the `max-height: 90vh` block at the top of
 * styles/dialogs.css: those are `display: flex; flex-direction: column` with a
 * `min-height: 0; overflow-y: auto` window-content and a sticky footer, so
 * they grow to fit short forms, stop at 90% of the viewport for tall ones,
 * and scroll the body in between. Before this, a short form (Switch, Reset)
 * rendered with dead space below the footer while a tall one (Trap, Teleport)
 * was pinned to 800px whether or not the screen could take it.
 *
 * No left/top = centered on screen.
 */
const DEFAULT_DIALOG_POSITION: DialogPosition = {
  width: 650,
  height: 'auto'
};

/**
 * Dialog-specific position configurations
 * Dialogs are centered on screen by default
 */
export const DialogPositions: Record<string, DialogPosition> = {
  /**
   * Switch tile dialog
   */
  SWITCH: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Light tile dialog
   */
  LIGHT: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Trap tile dialog
   */
  TRAP: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Reset tile dialog
   */
  RESET: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Teleport tile dialog
   */
  TELEPORT: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Check State dialog
   */
  CHECK_STATE: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Tile Manager.
   *
   * Keeps an explicit pixel height: `.tile-manager` is deliberately NOT in the
   * `max-height: 90vh` flex block in styles/dialogs.css, and
   * `.tile-manager-container` is `height: 100%`, which collapses to nothing
   * against an auto-height window. The window is resizable, and the fixed
   * `left: 100, top: 100` has been dropped so Foundry restores wherever the
   * user last dragged it instead of snapping back to the top-left on reopen.
   */
  TILE_MANAGER: {
    width: 650,
    height: 750
  },

  /**
   * Variables Viewer.
   *
   * Also outside the 90vh flex block, so it keeps a pixel height; the dialog
   * itself is now `resizable` (see src/dialogs/variables-viewer.ts) because
   * the variables table is unbounded and a scene with many tracked variables
   * used to be stuck in a window the user could not grow.
   */
  VARIABLES_VIEWER: {
    width: 650,
    height: 750
  },

  /**
   * Elevation Region dialog
   */
  ELEVATION: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Rotating Room dialog
   */
  ROTATE: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Gas Cloud / Aura dialog
   */
  GAS_CLOUD: {
    ...DEFAULT_DIALOG_POSITION
  }
};
