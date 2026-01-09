/**
 * Centralized dialog position configurations
 * All dialog window sizes and positions defined in one place
 * Dialogs are centered on screen by default (no left/top specified)
 * Tile Manager stays anchored to the left side
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
 * Default dialog position - inherited by all dialogs unless overridden
 * No left/top = centered on screen
 */
const DEFAULT_DIALOG_POSITION: DialogPosition = {
  width: 650,
  height: 750
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
    ...DEFAULT_DIALOG_POSITION,
    height: 565
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
    ...DEFAULT_DIALOG_POSITION,
    height: 800
  },

  /**
   * Reset tile dialog
   */
  RESET: {
    ...DEFAULT_DIALOG_POSITION,
    height: 525
  },

  /**
   * Teleport tile dialog
   */
  TELEPORT: {
    ...DEFAULT_DIALOG_POSITION,
    height: 800
  },

  /**
   * Check State dialog
   */
  CHECK_STATE: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Tile Manager - stays anchored on left side
   */
  TILE_MANAGER: {
    ...DEFAULT_DIALOG_POSITION,
    left: 100,
    top: 100
  },

  /**
   * Variables Viewer
   */
  VARIABLES_VIEWER: {
    ...DEFAULT_DIALOG_POSITION
  },

  /**
   * Elevation Region dialog
   */
  ELEVATION: {
    ...DEFAULT_DIALOG_POSITION,
    height: 700
  }
};
