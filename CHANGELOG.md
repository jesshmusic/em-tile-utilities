# Changelog

All notable changes to this project will be documented in this file.

## [1.16.1] - 2025-11-17

### Fixed

- enable scrolling for teleport dialog to fix inaccessible Create button (Issue #34)


## [1.16.0] - 2025-11-17

### Added

- accordion UI for trap dialog with organized collapsible sections
- required field indicators with red dots on accordion headers
- dynamic setup tasks guide that updates in real-time
- comprehensive GitHub bug report issue template

### Changed

- trap dialog now uses accordion interface instead of single scrolling form
- replace image behavior dropdown with intuitive visibility radio buttons
- improved visibility section layout and spacing
- one-section-at-a-time accordion behavior for cleaner, focused interface

### Fixed

- improved trap dialog usability and reduced cognitive load (addresses scrolling and form complexity issues)
- redesign trap visibility UI and fix related visibility bug (Issue #28)

## [1.15.3] - 2025-11-17

### Fixed

- fix pause game checkbox not being read from trap dialog (Issue #27)

## [1.15.2] - 2025-11-16

### Fixed

- correct pause game action structure and positioning
- resolve hidden trap visibility bug and improve trap dialog UX (Issue #24)
- active effect traps not applying effects (issue #22)

### Other

- enhancement: improve Tile Manager window positioning
- docs: update README with current features and capabilities (#21)

## [1.15.1] - 2025-11-06

### Added

- test: add comprehensive UI tests for custom tags functionality
- add custom tags support to all tile creation dialogs
- test: add integration tests for sound features and fix failing tests
- add sound field to teleport and light interfaces and templates
- add confirmation dialog before deleting paired teleport tiles
- fix: add error handling for bidirectional teleport deletion to prevent race conditions
- fix: match Tagger button styling and add action logging
- debug: add extensive console logging for tag input
- use Tagger's exact HTML structure and CSS
- implement Tagger-style tag input interface
- implement Tagger-style tag chip input for custom tags
- add custom tags input field to teleport dialog
- update default tile images to more descriptive icons
- fix: add proper null check for Tagger API before usage
- make delete source token option reactive to scene dropdown changes
- fix: add module name prefix to all error messages
- fix: add error handling and debug logging to teleport dialog
- fix: add error handling for return teleport creation
- add delete source token and return teleport options
- implement drag-to-size placement for teleport tiles
- add teleport dialog and workflow enhancements
- improve trap dialog UX, enhance build system, and implement Copilot suggestions (#18)

### Fixed

- remove saving throw from return teleport and use deleteSourceToken setting
- preserve customTags value across dialog re-renders in teleport dialog
- apply custom tags to return teleports and handle bidirectional deletion
- use globalThis.Tagger instead of module.api for tag creation
- correct TypeScript type errors in tile-helpers
- configure TypeScript to recognize Foundry global types

### Changed

- implement optional code improvements from Copilot review
- implement Copilot PR review recommendations
- bump version to 1.15.0

## [1.15.0] - 2025-11-04

### Added

- add sound field to teleport and light interfaces and templates
- add confirmation dialog before deleting paired teleport tiles
- fix: add error handling for bidirectional teleport deletion to prevent race conditions
- fix: match Tagger button styling and add action logging
- debug: add extensive console logging for tag input
- use Tagger's exact HTML structure and CSS
- implement Tagger-style tag input interface
- implement Tagger-style tag chip input for custom tags
- add custom tags input field to teleport dialog
- update default tile images to more descriptive icons
- fix: add proper null check for Tagger API before usage
- make delete source token option reactive to scene dropdown changes
- fix: add module name prefix to all error messages
- fix: add error handling and debug logging to teleport dialog
- fix: add error handling for return teleport creation
- add delete source token and return teleport options
- implement drag-to-size placement for teleport tiles
- add teleport dialog and workflow enhancements
- improve trap dialog UX, enhance build system, and implement Copilot suggestions (#18)

### Fixed

- preserve customTags value across dialog re-renders in teleport dialog
- apply custom tags to return teleports and handle bidirectional deletion
- use globalThis.Tagger instead of module.api for tag creation
- correct TypeScript type errors in tile-helpers
- configure TypeScript to recognize Foundry global types

## [1.14.0] - 2025-11-03

### Added

- fix: properly register Handlebars partials and add comprehensive integration tests
- migrate from Rollup to Vite and fix partial registration
- add Phase 1 integration testing for template rendering

### Fixed

- implement Copilot PR review suggestions
- test: fix reset-dialog height expectation to match 'auto' implementation
- replace all 'combat' string literals with TrapResultType.COMBAT enum
- improve Foundry API token handling in workflows

### Changed

- reorganize permissions to require approval for destructive commands
- update permissions for pr checks
- bump version to 1.13.0
- implement GitHub Copilot suggestions for PR #16
- update claude settings
- include remaining changes for 1.12.5
- bump version to 1.12.5

## [1.13.0] - 2025-11-02

### Added

- add Phase 1 integration testing for template rendering

### Fixed

- test: fix reset-dialog height expectation to match 'auto' implementation
- replace all 'combat' string literals with TrapResultType.COMBAT enum
- improve Foundry API token handling in workflows (#15)
- improve Foundry API token handling in workflows

### Changed

- implement GitHub Copilot suggestions for PR #16
- update claude settings
- include remaining changes for 1.12.5
- bump version to 1.12.5

### Other

- Feat/combat trap (#13)

## [1.12.5] - 2025-11-02

### Fixed

- improve Foundry API token handling in workflows

### Other

- Feat/combat trap (#13)

## [1.12.4] - 2025-10-31

### Other

- Feat/combat trap (#13)

## [1.12.3] - 2025-10-30

### Changed

- update startup logs to match consistent format with colored version/build numbers

## [1.12.2] - 2025-10-27

### Added

- rebrand to Dorman Lakely's Tile Utilities with wizard theme
- add Tile Manager auto-restore after tile creation
- add DMG trap item integration for trap dialogs

### Changed

- simplify startup console messages
- format code and update build info after merge

## [1.12.1] - 2025-10-25

### Added

- rebrand to Dorman Lakely's Tile Utilities with wizard theme
- add Tile Manager auto-restore after tile creation
- add DMG trap item integration for trap dialogs

### Changed

- format code and update build info after merge

## [1.12.0] - 2025-10-24

### Added

- add Tile Manager auto-restore after tile creation

## [1.11.0] - 2025-10-23

### Added

- add DMG trap item integration for trap dialogs
- remove combat trap from experimental flag and simplify tile button labels

### Changed

- bump version to 1.9.0
- bump version to 1.8.2

## [1.10.0] - 2025-10-22

### Added

- remove combat trap from experimental flag and simplify tile button labels

### Changed

- bump version to 1.9.0
- bump version to 1.8.2

## [1.9.0] - 2025-10-21

### Added

- remove combat trap from experimental flag and simplify tile button labels
- add optional click-to-set token position for combat traps
- enhance combat trap with item drag-and-drop and token visibility
- implement scene-based tile naming and simplify combat trap attacks
- adds missing files
- combat trap tile
- docs: add GitHub repository setup guide
- adds automated release workflow and feature development guide

### Fixed

- set combat trap tokens to unlocked by default
- implement manual combat resolution for traps to bypass MIDI-qol targeting
- update module.json download URL to v1.6.2

### Changed

- bump version to 1.8.2
- bump version to 1.8.1
- trigger CI rebuild
- bump version to 1.6.2
- move version bumping to PR process instead of workflow

### Other

- test: update tests for scene-based tile naming
- enhancement: auto-update download URL in release script
- enhancement: adds auto-reload prompt for experimental features

## [1.8.2] - 2025-10-21

### Added

- remove combat trap from experimental flag and simplify tile button labels
- add optional click-to-set token position for combat traps
- enhance combat trap with item drag-and-drop and token visibility
- implement scene-based tile naming and simplify combat trap attacks
- adds missing files
- combat trap tile
- docs: add GitHub repository setup guide
- adds automated release workflow and feature development guide

### Fixed

- set combat trap tokens to unlocked by default
- implement manual combat resolution for traps to bypass MIDI-qol targeting
- update module.json download URL to v1.6.2

### Changed

- bump version to 1.8.1
- trigger CI rebuild
- bump version to 1.6.2
- move version bumping to PR process instead of workflow

### Other

- test: update tests for scene-based tile naming
- enhancement: auto-update download URL in release script
- enhancement: adds auto-reload prompt for experimental features

## [1.8.1] - 2025-10-21

### Added

- add optional click-to-set token position for combat traps
- enhance combat trap with item drag-and-drop and token visibility
- implement scene-based tile naming and simplify combat trap attacks
- adds missing files
- combat trap tile
- docs: add GitHub repository setup guide
- adds automated release workflow and feature development guide

### Fixed

- set combat trap tokens to unlocked by default
- implement manual combat resolution for traps to bypass MIDI-qol targeting
- update module.json download URL to v1.6.2

### Changed

- trigger CI rebuild
- bump version to 1.6.2
- move version bumping to PR process instead of workflow

### Other

- test: update tests for scene-based tile naming
- enhancement: auto-update download URL in release script
- enhancement: adds auto-reload prompt for experimental features

## [1.8.0] - 2025-10-20

### Added

- add optional click-to-set token position for combat traps
- enhance combat trap with item drag-and-drop and token visibility
- implement scene-based tile naming and simplify combat trap attacks
- adds missing files
- combat trap tile
- docs: add GitHub repository setup guide
- adds automated release workflow and feature development guide

### Fixed

- set combat trap tokens to unlocked by default
- implement manual combat resolution for traps to bypass MIDI-qol targeting
- update module.json download URL to v1.6.2

### Changed

- trigger CI rebuild
- bump version to 1.6.2
- move version bumping to PR process instead of workflow

### Other

- test: update tests for scene-based tile naming
- enhancement: auto-update download URL in release script
- enhancement: adds auto-reload prompt for experimental features

## [1.7.0] - 2025-10-19

### Added

- add optional click-to-set token position for combat traps
- enhance combat trap with item drag-and-drop and token visibility
- implement scene-based tile naming and simplify combat trap attacks
- adds missing files
- combat trap tile
- docs: add GitHub repository setup guide
- adds automated release workflow and feature development guide

### Fixed

- set combat trap tokens to unlocked by default
- implement manual combat resolution for traps to bypass MIDI-qol targeting
- update module.json download URL to v1.6.2

### Changed

- bump version to 1.6.2
- move version bumping to PR process instead of workflow

### Other

- test: update tests for scene-based tile naming
- enhancement: auto-update download URL in release script
- enhancement: adds auto-reload prompt for experimental features

## [1.6.2] - 2025-10-19

### Added

- add optional click-to-set token position for combat traps
- enhance combat trap with item drag-and-drop and token visibility
- implement scene-based tile naming and simplify combat trap attacks
- adds missing files
- combat trap tile
- docs: add GitHub repository setup guide
- adds automated release workflow and feature development guide

### Fixed

- set combat trap tokens to unlocked by default
- implement manual combat resolution for traps to bypass MIDI-qol targeting
- update module.json download URL to v1.6.2

### Changed

- move version bumping to PR process instead of workflow

### Other

- test: update tests for scene-based tile naming
- enhancement: auto-update download URL in release script
- enhancement: adds auto-reload prompt for experimental features
