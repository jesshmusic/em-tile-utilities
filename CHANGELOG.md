# Changelog

All notable changes to this project will be documented in this file.

## [1.5.3] - 2025-10-16

### Added

- removes the check variable tile
- adds a basic check variables tile
- adds a new icon and shows variables

## [1.5.2] - 2025-10-15

### Fixed

- updatest the version of the module properly

## [1.5.1] - 2025-10-15

### Added

- adds tile import/export
- adds tile import/export
- documentation update

## [1.5.0] - 2025-10-14

### Added

- adds automatic package release

## [1.4.0] - 2025-10-14

### Added

- adds door features to the activate trap
- adjusts the activate trap
- separates trap creation into three templates
- added initial trap tile creator
- replaces icons for the buttons

### Fixed

- fixes a bunch of tests
- fixes a bunch of tests

### Changed

- adds tests, lint, and prettier

### Other

- enhancement: adds default settings to the trap
- enhancement: restyles the tile create buttons
- change: adds tile history reset checkbox

## [1.3.0] - 2025-10-12

### Other

- enhancement: updates the tile manager with more functionality - added sorting - added search - made resizable - added active and visibility toggles - fixed webm display

## [1.2.0] - 2025-10-11

### Added

- fix: removes script to add release notes file
- fix: removes script to add release notes file

## [1.1.2] - 2025-10-11

### Changed

- updates the minimum version and name
- updates the minimum version and name

## [1.1.1] - 2025-10-11

### Changed

- updates the minimum version and name

## [1.1.0] - 2025-10-11

### Added

- add light tiles and some automation
- adds a tile browser for the scene
- styles the dialogs with Application V2
- sets the switch variable and adds a variable display dialog
- improves token settings

### Fixed

- custom tiles can be clicked onto the map now.
- the custom tile image selection persists
- door changes now set properly

### Other

- Initial commit: EM Puzzles and Trap Tiles module

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
