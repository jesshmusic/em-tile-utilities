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
