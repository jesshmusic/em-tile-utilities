export interface SwitchConfig {
  name: string;
  variableName: string;
  onImage: string;
  offImage: string;
  sound: string;
}

export interface LightConfig {
  name: string;
  offImage: string;
  onImage: string;
  useDarkness: boolean;
  darknessMin: number;
  dimLight: number;
  brightLight: number;
  lightColor: string;
  colorIntensity: number;
}

/**
 * Enum for trap result types
 */
export enum TrapResultType {
  DAMAGE = 'damage',
  TELEPORT = 'teleport',
  ACTIVE_EFFECT = 'activeeffect'
}

/**
 * Enum for trap target types
 */
export enum TrapTargetType {
  TRIGGERING = 'triggering',
  WITHIN_TILE = 'within'
}

/**
 * Configuration for teleport result
 */
export interface TeleportConfig {
  x: number;
  y: number;
  scene?: string; // Optional: scene ID for cross-scene teleport
}

/**
 * Configuration for active effect result (using Monk's Active Tiles structure)
 */
export interface ActiveEffectConfig {
  effectid: string; // ID of the effect from CONFIG.statusEffects (e.g., "burning", "poisoned")
  addeffect: 'add' | 'remove' | 'toggle' | 'clear'; // How to apply the effect
  altereffect?: string; // For PF2e effects with values (e.g., "+ 1")
}

/**
 * Configuration for trap tiles
 */
export interface TrapConfig {
  name: string;
  startingImage: string;
  triggeredImage: string;
  hideTrapOnTrigger: boolean;
  sound: string;
  resultType: TrapResultType; // Type of result (damage, teleport, activeeffect)
  targetType: TrapTargetType; // Who to target (triggering token or tokens within tile)
  // Optional saving throw (applies to all result types)
  hasSavingThrow: boolean;
  minRequired: number | null;
  savingThrow: string;
  dc: number;
  // For damage result type
  damageOnFail: string;
  flavorText: string;
  // For teleport result type
  teleportConfig?: TeleportConfig; // Optional: teleport destination
  // For active effect result type
  activeEffectConfig?: ActiveEffectConfig; // Optional: active effect to apply
  // For activating trap type
  tilesToActivate?: string[]; // Optional: IDs of tiles to activate (for activating trap type)
}

export interface ResetTileConfig {
  name: string;
  image: string;
  varsToReset: Record<string, any>;
  tilesToReset: TileResetState[];
}

export interface WallDoorState {
  entityId: string;
  entityName: string;
  state: string; // "CLOSED", "OPEN", "LOCKED"
}

export interface TileResetState {
  tileId: string;
  hidden: boolean;
  fileindex: number;
  active: boolean;
  rotation: number;
  x: number;
  y: number;
  wallDoorStates: WallDoorState[];
  hasActivateAction: boolean;
  hasMovementAction: boolean;
  hasTileImageAction: boolean;
  hasShowHideAction: boolean;
  hasFiles: boolean;
  resetTriggerHistory: boolean;
}

export interface WallDoorAction {
  entityId: string;
  entityName: string;
  state: string; // "CLOSED", "OPEN", "LOCKED"
}

export interface SelectedTileData {
  tileId: string;
  tileName: string;
  hidden: boolean;
  image: string;
  fileindex: number;
  active: boolean;
  files: TileFile[];
  variables: Record<string, any>;
  rotation: number;
  x: number;
  y: number;
  currentRotation: number;
  currentX: number;
  currentY: number;
  wallDoorActions: WallDoorAction[];
  hasActivateAction: boolean;
  hasMovementAction: boolean;
  hasTileImageAction: boolean;
  hasShowHideAction: boolean;
  hasAnyActions: boolean;
  resetTriggerHistory: boolean;
}

export interface TileFile {
  id: string;
  name: string;
}

export interface VariableData {
  value: any;
  tiles: TileReference[];
}

export interface TileReference {
  name: string;
  id: string;
}
