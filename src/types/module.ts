export interface SwitchConfig {
  name: string;
  variableName: string;
  onImage: string;
  offImage: string;
  sound: string;
}

export interface ResetTileConfig {
  name: string;
  image: string;
  varsToReset: Record<string, any>;
  tilesToReset: TileResetState[];
}

export interface TileResetState {
  tileId: string;
  hidden: boolean;
  fileindex: number;
  active: boolean;
  reverseActions: boolean;
  rotation: number;
  x: number;
  y: number;
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
  reverseActions: boolean;
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
