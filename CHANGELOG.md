# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-01-XX

### Added
- Create Switch Tile: Double-click activated switches with ON/OFF states and variable tracking
- Create Reset Tile: Tiles that reset multiple variables and tile states to initial values
- Create Light Tile: Tiles with embedded light sources (click or darkness-triggered)
  - Support for custom light colors (default: warm torch color #ffa726)
  - Color intensity control
  - Configurable bright/dim light radii (default: 20/40 for torch)
  - Darkness-based automatic activation option
- Scene Variables Viewer: View and manage all Monk's Active Tiles variables
- Tile Manager: View, select, edit, and delete all tiles on the scene
  - Shows tile elevation, position, size
  - Quick select/edit/delete actions
  - Auto-refresh on tile changes
- Module settings for default images (switch ON/OFF, light ON/OFF)
- Localization support (English)

### Features
- Click-to-place functionality for all tile types
- Grid snapping for precise placement
- Integration with Monk's Active Tiles module
- File picker support for custom images
- Confirmation dialogs for destructive actions

### Technical
- Built with TypeScript and Rollup
- Foundry VTT v13 ApplicationV2 API
- Automatic build numbering system
