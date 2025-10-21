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
 * Configuration for tile actions in activating traps
 */
export interface TileAction {
  tileId: string;
  actionType: 'activate' | 'showhide' | 'moveto';
  mode?: string; // For activate: 'activate', 'deactivate', 'toggle'. For showhide: 'show', 'hide', 'toggle'
  x?: number; // For moveto
  y?: number; // For moveto
}

/**
 * Configuration for wall/door actions in activating traps
 */
export interface WallAction {
  wallId: string;
  state: string; // 'OPEN', 'CLOSED', 'LOCKED'
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
  tilesToActivate?: string[]; // Optional: IDs of tiles to activate (deprecated, use tileActions)
  tileActions?: TileAction[]; // Optional: tile actions with configurations
  wallActions?: WallAction[]; // Optional: wall/door actions
}

/**
 * Configuration for combat trap tiles (uses attack rolls instead of saving throws)
 */
export interface CombatTrapConfig {
  name: string;
  startingImage: string;
  triggeredImage: string;
  hideTrapOnTrigger: boolean;
  sound: string;
  targetType: TrapTargetType; // Who to target (triggering token or tokens within tile)
  // Attack item from compendium
  itemId: string; // ID of the item/feature to use for attacks
  // Token configuration
  tokenVisible: boolean; // Whether the trap token is visible or hidden
  tokenImage?: string; // Optional custom image for visible tokens
  tokenX?: number; // Optional custom X position for token
  tokenY?: number; // Optional custom Y position for token
  // Trigger limit
  maxTriggers: number; // 0 = unlimited, 1 = once, 2+ = that many times
  // For activating trap type
  tileActions?: TileAction[]; // Optional: tile actions with configurations
  wallActions?: WallAction[]; // Optional: wall/door actions
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

/**
 * Comparison operators for branch conditions
 */
export enum ConditionOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN_OR_EQUAL = 'lte'
}

/**
 * Logic connectors for multiple conditions
 */
export enum LogicConnector {
  AND = 'and',
  OR = 'or'
}

/**
 * Branch action category
 */
export enum BranchActionCategory {
  TILE_CHANGE = 'tile',
  DOOR_CHANGE = 'door'
}

/**
 * A single condition in a branch
 */
export interface BranchCondition {
  tileId: string;
  tileName: string;
  variableName: string;
  operator: ConditionOperator;
  value: string;
  logicConnector: LogicConnector;
  isSwitch?: boolean; // True if variable is from a switch tile (ON/OFF values)
}

/**
 * A single action to execute when branch matches
 */
export interface BranchAction {
  category: BranchActionCategory;
  // For tile change:
  targetTileId?: string;
  targetTileName?: string;
  activateMode?: 'activate' | 'deactivate' | 'toggle' | 'nothing';
  triggerTile?: boolean;
  showHideMode?: 'show' | 'hide' | 'toggle' | 'nothing';
  // For door change:
  wallId?: string;
  wallName?: string;
  doorState?: 'open' | 'closed' | 'locked';
}

/**
 * A branch with conditions and actions
 */
export interface Branch {
  name: string;
  conditions: BranchCondition[];
  actions: BranchAction[];
}

export interface CheckStateConfig {
  name: string;
  image: string;
  tilesToCheck: Array<{
    tileId: string;
    tileName: string;
    variables: Array<{
      variableName: string;
      currentValue: string;
    }>;
  }>;
  branches: Branch[];
}
