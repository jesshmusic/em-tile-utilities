/**
 * Centralized dialog position configurations
 * All dialog window sizes and positions defined in one place
 */

/**
 * Dialog position configuration type
 */
export interface DialogPosition {
  width: number | 'auto';
  height: number | 'auto';
  left: number;
  top: number;
}

/**
 * Default dialog position - inherited by all dialogs unless overridden
 */
const DEFAULT_DIALOG_POSITION: DialogPosition = {
  width: 650,
  height: 750,
  left: 100,
  top: 100
};

/**
 * Dialog-specific position configurations
 * Each dialog inherits from DEFAULT_DIALOG_POSITION and overrides left/top for cascading effect
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
    ...DEFAULT_DIALOG_POSITION,
    left: 120,
    top: 120
  },

  /**
   * Trap tile dialog
   */
  TRAP: {
    ...DEFAULT_DIALOG_POSITION,
    left: 140,
    top: 140,
    height: 800
  },

  /**
   * Reset tile dialog
   */
  RESET: {
    ...DEFAULT_DIALOG_POSITION,
    left: 160,
    top: 160,
    height: 525
  },

  /**
   * Teleport tile dialog
   */
  TELEPORT: {
    ...DEFAULT_DIALOG_POSITION,
    left: 180,
    top: 180,
    height: 800
  },

  /**
   * Check State dialog
   */
  CHECK_STATE: {
    ...DEFAULT_DIALOG_POSITION,
    left: 200,
    top: 200
  },

  /**
   * Tile Manager
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
    ...DEFAULT_DIALOG_POSITION,
    left: 240,
    top: 240
  }
};
