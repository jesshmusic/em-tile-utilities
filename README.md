# EM Tile Utilities

A FoundryVTT module that provides utility tile creation tools for Monk's Active Tiles.

## Features

- **Create Switch Tiles**: Interactive ON/OFF switches with custom images and sounds
  - Double-click activation
  - Variable tracking for puzzle logic
  - Custom sound effects
  - Configurable images for ON/OFF states

- **Create Light Tiles**: Dynamic light sources that can be toggled or darkness-activated
  - Manual toggle (double-click) or automatic darkness-based activation
  - Configurable bright/dim light radii (default: torch 20/40)
  - Custom light color with intensity control (default: warm torch #ffa726)
  - Separate AmbientLight creation for proper lighting
  - OFF/ON image states

- **Create Reset Tiles**: Reset multiple tiles and variables to their initial states
  - Reverse tile actions to undo their last sequence
  - Reset position, rotation, visibility, and active state
  - Configure variable values for reset
  - Reset wall/door states
  - Tile image state restoration

- **Scene Variables Viewer**: View and manage all tile variables in the current scene
  - See variable names, values, and which tiles use them
  - Real-time updates
  - Refresh on demand

- **Tile Manager**: Comprehensive tile management interface
  - View all tiles on the scene with thumbnails
  - See tile position, size, and elevation
  - Quick select, edit, or delete tiles
  - Shows Monk's Active Tiles status and action count
  - Auto-refresh when tiles are created/updated/deleted

- **Module Settings**: Customizable defaults
  - Default switch ON/OFF images
  - Default light ON/OFF images
  - Default sound effects

## Requirements

- FoundryVTT v13 or higher (uses ApplicationV2 API)
- [Monk's Active Tiles](https://foundryvtt.com/packages/monks-active-tiles) module

## Installation

1. Download the module from the Foundry module browser, or
2. Install manually by placing this folder in `Data/modules/`
3. Enable both "Monk's Active Tiles" and "EM Tile Utilities" in your world

## Usage

All tools are accessible from the **Tiles layer toolbar** in Foundry VTT. After enabling the module, you'll see five new buttons:

- 🔀 **Toggle icon** - Create Switch
- ↶ **Undo icon** - Create Reset Tile
- 💡 **Lightbulb icon** - Create Light Tile
- 📋 **List icon** - Scene Variables
- 📚 **Layer-group icon** - Tile Manager

### Creating a Switch

1. Select the Tiles layer
2. Click the "Create Switch" button (toggle icon) in the toolbar
3. Configure your switch settings:
   - Switch Name
   - Variable Name (unique identifier)
   - ON/OFF Images (file picker available)
   - Sound file (file picker available)
4. Click "Create"
5. Click on the canvas to place the switch

The switch can be activated by double-clicking. It toggles between ON/OFF states and tracks its state in a scene variable.

### Creating a Light Tile

1. Select the Tiles layer
2. Click the "Create Light Tile" button (lightbulb icon) in the toolbar
3. Configure your light settings:
   - Light Name
   - OFF/ON Images (file picker available)
   - **Use Darkness Trigger**: Toggle for automatic activation
     - When enabled: Light activates automatically based on scene darkness
     - Darkness Minimum: Slider to set activation threshold (0-1)
     - When disabled: Light toggles manually on double-click
   - **Dim Light Radius**: Distance of dim light (default: 40 feet)
   - **Bright Light Radius**: Distance of bright light (default: 20 feet)
   - **Light Color**: Color picker for light tint (default: warm torch #ffa726)
   - **Color Intensity**: Slider for color opacity (0-1)
4. Click "Create"
5. Click on the canvas to place the light tile

The light tile creates both a tile graphic and a separate AmbientLight source. For manual lights, double-click toggles the light on/off.

### Creating a Reset Tile

1. Select the Tiles layer
2. Click the "Create Reset Tile" button (undo icon) in the toolbar
3. Click "Add Tile" and select tiles from the canvas
4. For each tile, configure:
   - **Reverse Actions**: Undo the tile's last action sequence
   - Visibility, Active state, Rotation
   - Position (Start position for reset)
   - Image state
   - Variable values
5. Configure reset image for the reset tile itself
6. Click "Create"
7. Click on the canvas to place the reset tile (2x2 grid size)

The reset tile will restore all selected tiles to their configured states when double-clicked.

### Viewing Scene Variables

1. Select the Tiles layer
2. Click the "Scene Variables" button (list icon) in the toolbar
3. See all variables in the current scene with their values and associated tiles
4. Click "Refresh" to update the view

### Using the Tile Manager

1. Select the Tiles layer
2. Click the "Tile Manager" button (layer-group icon) in the toolbar
3. Browse all tiles on the scene:
   - Thumbnail preview
   - Tile name
   - Position (x, y) and Elevation
   - Size (width × height)
   - Status badges (Monk's Active Tile, Actions count, Variables count)
   - Visibility/Lock status
4. Actions for each tile:
   - **Select** (crosshair icon): Select the tile on canvas
   - **Edit** (pencil icon): Open tile configuration
   - **Delete** (trash icon): Delete tile with confirmation
5. The list auto-refreshes when tiles are created, updated, or deleted

### Module Settings

Configure defaults in **Game Settings → Module Settings → EM Tile Utilities**:
- Default ON Image (for switches)
- Default OFF Image (for switches)
- Default Sound (for switches)
- Default Light ON Image
- Default Light OFF Image

## Development

This module is built with TypeScript for better code organization and type safety.

### Project Structure

```
em-tile-utilities/
├── src/                    # TypeScript source files
│   ├── dialogs/           # Dialog components
│   │   ├── switch-dialog.ts      # Switch creation dialog
│   │   ├── light-dialog.ts       # Light tile creation dialog
│   │   ├── reset-dialog.ts       # Reset tile creation dialog
│   │   ├── variables-viewer.ts   # Scene variables viewer
│   │   └── tile-manager.ts       # Tile management interface
│   ├── utils/             # Utility functions
│   │   └── tile-helpers.ts       # Tile creation helpers
│   ├── types/             # TypeScript type definitions
│   │   ├── foundry.d.ts          # Foundry VTT types
│   │   └── module.ts             # Module-specific types
│   └── main.ts            # Main entry point
├── templates/             # Handlebars templates
│   ├── switch-config.hbs
│   ├── light-config.hbs
│   ├── reset-config.hbs
│   ├── variables-viewer.hbs
│   ├── tile-manager.hbs
│   └── form-footer.hbs
├── styles/                # CSS styles
│   └── dialogs.css
├── lang/                  # Localization files
│   └── en.json
├── dist/                  # Compiled JavaScript (generated)
├── .github/workflows/     # GitHub Actions
│   └── release.yml        # Release automation
├── scripts/               # Build scripts
│   └── release.js         # Version bump and changelog
├── rollup.config.mjs      # Build configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # NPM dependencies and scripts
├── module.json            # Foundry module manifest
└── CHANGELOG.md           # Version history
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
- `npm run clean` - Clean the dist folder
- `npm run release:patch` - Bump patch version (1.0.1 → 1.0.2) and update changelog
- `npm run release:minor` - Bump minor version (1.0.1 → 1.1.0) and update changelog
- `npm run release:major` - Bump major version (1.0.1 → 2.0.0) and update changelog

### Development Workflow

```bash
npm run watch
```

This watches for file changes and rebuilds automatically. When you save TypeScript files in the `src/` directory, they will be compiled to `dist/main.js`. Refresh Foundry VTT to see your changes.

### Making Changes

1. Edit TypeScript files in the `src/` directory
2. Run `npm run watch` in a terminal
3. Save your changes - they will automatically be compiled
4. Refresh Foundry VTT to see your changes

### Releasing a New Version

The module uses automated versioning and changelog generation:

1. Make your commits using conventional commit messages:
   - `feat: add new feature` → Added section
   - `fix: resolve bug` → Fixed section
   - `chore: update dependencies` → Changed section

2. Run the release script locally:
   ```bash
   npm run release:minor  # or patch/major
   ```

3. Or trigger the GitHub Actions workflow:
   - Go to **Actions** → **Release Version**
   - Click **Run workflow**
   - Select version type
   - The workflow will automatically bump version, update changelog, commit, tag, and create a GitHub release

### Type Definitions

Basic Foundry VTT type definitions are included in `src/types/foundry.d.ts`. These provide autocomplete and type checking for common Foundry APIs.

## License

ISC
