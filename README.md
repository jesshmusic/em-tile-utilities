# EM Puzzle and Trap Tiles

A FoundryVTT module that adds switch puzzle actions to Monk's Active Tiles for creating sequence-based puzzles.

## Features

- **Create Switch Tiles**: Easily create interactive ON/OFF switches with custom images and sounds
- **Scene Variables Viewer**: View all tile variables in the current scene at a glance
- **Reset Tiles**: Create tiles that reset multiple other tiles to specific states
  - Reverse tile actions to undo their last sequence
  - Reset position, rotation, visibility, and active state
  - Configure variable values for reset

## Requirements

- FoundryVTT v11 or higher
- [Monk's Active Tiles](https://foundryvtt.com/packages/monks-active-tiles) module

## Installation

1. Download the module from the Foundry module browser, or
2. Install manually by placing this folder in `Data/modules/`
3. Enable both "Monk's Active Tiles" and "EM Puzzle and Trap Tiles" in your world

## Usage

### Creating a Switch

1. Select the Tiles layer
2. Click the "Create Switch" button in the toolbar
3. Configure your switch settings:
   - Switch Name
   - Variable Name (unique identifier)
   - ON/OFF Images
   - Sound file
4. Click Create

The switch will be placed at the center of your scene and can be activated by double-clicking.

### Viewing Scene Variables

1. Select the Tiles layer
2. Click the "View Scene Variables" button
3. See all variables in the current scene with their values and associated tiles
4. Click "Refresh" to update the view

### Creating a Reset Tile

1. Select the Tiles layer
2. Click the "Create Reset Tile" button
3. Click "Add Tile" and select tiles from the canvas
4. For each tile, configure:
   - **Reverse Actions**: Undo the tile's last action sequence
   - Visibility, Active state, Rotation
   - Position (Start position for reset)
   - Image state
   - Variable values
5. Click Create

The reset tile will restore all selected tiles to their configured states when double-clicked.

## Development

This module is built with TypeScript for better code organization and type safety.

### Project Structure

```
em-puzzles-and-trap-tiles/
├── src/                    # TypeScript source files
│   ├── dialogs/           # Dialog components
│   │   ├── switch-dialog.ts
│   │   ├── reset-dialog.ts
│   │   └── variables-viewer.ts
│   ├── utils/             # Utility functions
│   │   └── tile-helpers.ts
│   ├── types/             # TypeScript type definitions
│   │   ├── foundry.d.ts
│   │   └── module.ts
│   └── main.ts            # Main entry point
├── dist/                  # Compiled JavaScript (generated)
├── scripts/               # Original JS backup
├── rollup.config.mjs      # Build configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # NPM dependencies and scripts
```

### Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

### Available Scripts

- `npm run build` - Build the project once
- `npm run watch` - Watch for changes and rebuild automatically
- `npm run dev` - Development mode with hot reload (port 30001)
- `npm run clean` - Clean the dist folder

### Development Workflow

#### Option 1: Standard Build (Recommended)
```bash
npm run watch
```
This watches for file changes and rebuilds automatically. Refresh Foundry to see changes.

#### Option 2: Hot Reload (Experimental)
```bash
npm run dev
```
This starts a development server with live reload. When you save files, changes will be rebuilt and the browser will automatically refresh. Note: This may require additional configuration depending on your Foundry setup.

### Making Changes

1. Edit TypeScript files in the `src/` directory
2. Run `npm run watch` or `npm run dev`
3. Changes will be compiled to `dist/main.js`
4. Refresh Foundry VTT to see your changes

### Type Definitions

Basic Foundry VTT type definitions are included in `src/types/foundry.d.ts`. These provide autocomplete and type checking for common Foundry APIs.

## License

ISC
