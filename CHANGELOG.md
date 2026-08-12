# Changelog

All notable changes to this project will be documented in this file.

## [2.0.2] - 2026-08-12

Maintenance release for **FoundryVTT v13**. Development of the module continues on the `main` branch, which is v14-only from v2.1.0 onward; this release backports the v2.2.0 bug fixes that apply to v13 so v13 users are not stranded on v2.0.1.

Everything here was re-implemented by hand against the v2.0.1 code — nothing was cherry-picked.

> **Not tested in a live Foundry v13 world.** There is no v13 instance available to the maintainer of this branch. The full unit suite, lint, formatting and build all pass, and every fix is covered by a regression test that asserts on the Monk's Active Tiles action data actually written to the tile — but no fix here has been exercised in a running game. Please report anything that misbehaves.

### Fixed

- **Saving throws roll a save, not an ability check**: trap and teleport tiles emitted `ability:dex` to Monk's Token Bar. `findBestRequest` resolves the `ability` namespace before `save`, so the roll came back as a Dexterity _check_ with no save proficiency. New tiles emit `save:dex`.
- **Reset tile wrote its variables to itself**: reset actions used `entity: { id: 'tile' }`, which Monk's Active Tiles resolves to the tile _running_ the action. Every reset landed on the Reset tile's own flags and the target tiles never changed. Each variable is now addressed at the tile that owns it (`Scene.<sceneId>.Tile.<tileId>`).
- **Reset tile could not clear a variable**: clearing emitted the literal string `"null"`, which is eval'd into a live value. It now emits Monk's `"_null"` sentinel, which unsets the flag.
- **Reset tile restored the wrong image**: `fileindex` is 0-based but Monk's `tileimage.select` is 1-based and clamps to the image count, so a reset could only ever restore the _first_ image. The index is now converted.
- **Reset tile form controls had no tile id**: `{{../tile.tileId}}` inside `{{#each tiles as |tile|}}` rendered empty (block parameters are lexically scoped, so `../tile` searches for a _property_ named `tile`). Controls came out named `fileindex_`, `walldoor__0` and so on, which broke wall/door state capture with more than one tile selected.
- **Check State honoured only `eq`**: `ne`, `gt`, `lt`, `gte` and `lte` were silently discarded and the branch then ran unconditionally. Comparisons now go into `checkvariable.data.value`, where Monk's actually evaluates them (`data.type` accepts only `all`/`any`/`none` and is an aggregation, not an operator).
- **Check State ignored AND/OR connectors**: multiple conditions are now compiled into disjunctive normal form using anchors and jumps, so `or` really is an `or`.
- **Check State branch anchors could collide**: "Branch A" and "branch-a" both slugified to `branch_a`. Anchors now carry a per-branch index suffix.
- **Check State could not target a second tile**: conditions were matched on variable name alone, and every switch defaults to the variable name `switch_1`, so every condition resolved to whichever tile came first. Conditions now match on tile id.
- **Check State no longer emits an unconditional branch**: a condition it cannot express now skips the branch with a warning instead of leaving it to fire every time.
- **Combat trap trigger limits were broken outright**: the generated actions used `{{default …}}` and `{{add …}}`, neither of which is a registered Handlebars helper when Monk's compiles an action value — and `helperMissing` _throws_ when an unknown helper is called with arguments. Trigger counting now uses Monk's own `setvariable` increment (`+ 1`) with the comparison in the check's value (`> 3`).
- **Player-token traps targeted the wrong tokens**: one copy of the target-type switch was written as a ternary that fell through to "tokens within tile" for anything other than the triggering token, swallowing the Player Tokens option. There is now a single shared resolver.
- **Deleting a teleport orphaned its partner**: the paired-teleport cleanup matched the tag prefixes `EM-Teleport-` / `EM-Return-Teleport-`, which this module has never emitted — the generator produces PascalCase (`EMTeleport`, `EMReturnTeleport`). Every match failed silently.
- **Combat trap dropped custom tags**: tags entered in the dialog were never applied to the created tile.
- **Combat trap revealed hidden trap tokens**: an unconditional `showhide … 'show'` defeated "token hidden" on the very first trigger, permanently exposing the trap actor. The reveal now only happens when the GM asked for a visible token.
- **Combat trap left orphans on failure**: the actor, its item and its token are all created before the tile exists, so a later failure stranded them in the world. Creation is now rolled back.
- **Combat trap actor id moved to this module's own flag scope**: it was written inside `flags['monks-active-tiles']`, where a schema clean by that module would drop it and break cleanup. Existing tiles are still read from the old location.
- **Tiles and regions placed half a square off**: `CONST.GRID_SNAPPING_MODES` is a bit field (`CENTER 0x1`, `EDGE_MIDPOINT 0x2`, `TOP_LEFT_VERTEX 0x10`), not a sequential enum. Placement used `mode: 2` while its comment claimed corners, and `mode: 1` (centre) for documents whose `x`/`y` is the top-left. Named constants are now read off `CONST`. The centre-snapping calls that feed Monk's teleport/movetoken destinations are correct and were deliberately left alone.
- **Dialog scroll containers never applied**: the stylesheet scoped them to `.window-app`, the ApplicationV1 root class. Every dialog in this module is ApplicationV2, whose root carries `.application`.
- **Update checks on this branch pointed at the v14 line**: the `manifest` URL was `releases/latest/download/module.json`, and GitHub's "latest release" is repo-wide rather than per-branch — so a v13 world checking for updates was handed the v14 manifest, which declares `minimum: 14` and cannot be installed. It now points at this branch directly, so the v13 line only ever offers v13 releases. (Installing from Foundry's package browser was already correct: the release workflow registers each version with its own pinned manifest and its own compatibility range. This only affected worlds that installed the module by pasting a manifest URL.)

### Upgrade notes

- **Existing saving-throw traps and teleports must be recreated.** These fixes change what _newly created_ tiles emit; they do not rewrite tiles already saved in your world. Any trap or teleport built with an earlier version still carries `ability:dex` and will keep rolling an ability check. The same applies to the Reset, Check State and combat-trap fixes: recreate the affected tiles to pick them up.
- Combat trap tiles created before this release keep working — the actor id is still read from the old flag location.

### Deliberately not backported

These three changes from the v14 line are **intentionally excluded** and should not be brought over later:

- **Foundry v14 deprecated-global migration** (`loadTemplates` / `FilePicker` / `AudioHelper` moved under the `foundry.*` namespaces). v13 has the flat globals, and the v14 namespaces may not exist there.
- **Tile occlusion schema fix** (`occlusion.modes` as a `SetField`). That is a v14 schema change; v13 uses `occlusion.mode`.
- **Typed damage / midi-qol `em-tile-utilities.applydamage` custom action.** It depends on dnd5e 5.x APIs.

## [2.0.1] - 2026-01-14

### Fixed

- **Toolbar Button Location**: Moved Tile Utilities button back to Tiles submenu instead of main toolbar
- **404 Error**: Fixed build-info.json 404 error by importing at build time instead of fetching at runtime

## [2.0.0] - 2026-01-08

This major release introduces **FoundryVTT v13 Region support** as an alternative to Monk's Active Tiles, along with a complete visual overhaul using game-icons.net SVG icons.

### Highlights

- **Region Support**: Create traps, teleports, and elevation changes using native FoundryVTT v13 Regions instead of Monk's Active Tiles
- **New Elevation Dialog**: Automatically change token elevation when entering/exiting regions
- **Icon Overhaul**: All Font Awesome icons replaced with beautiful game-icons.net SVG icons
- **Improved Placement**: Ghost image previews now work for both tiles and regions

### Added

- **Region Creation Mode**: All tile dialogs now offer a "Create as Region" toggle to use FoundryVTT v13 Regions instead of Monk's Active Tiles
- **Trap Regions**: Create trap regions using the Enhanced Region Behaviors module for damage, saving throws, and status effects
- **Teleport Regions**: Create teleport regions using native FoundryVTT teleport behavior with optional return teleports
- **Elevation Region Dialog**: New dialog for creating regions that automatically adjust token elevation on enter/exit (requires Enhanced Region Behaviors module)
- **Ghost Image Preview for Regions**: Drag-to-place now shows colored rectangle preview when creating regions
- **Cross-Scene Teleport Regions**: Full support for teleporting tokens between scenes using regions
- **Sound Behaviors for Regions**: Play sounds when tokens enter teleport or trap regions

### Changed

- **Complete Icon Overhaul**: Replaced all Font Awesome icons with game-icons.net SVG icons throughout the module
  - Tile Manager toolbar and buttons
  - All dialog headers and action buttons
  - Form controls and file pickers
- **Improved Dialog Positioning**: Dialogs now center on screen properly
- **Canvas Layer Switching**: Automatically switch to the appropriate canvas layer (tiles or regions) when placing

### Fixed

- Race condition in scene switching now uses proper `canvasReady` hooks instead of timeouts
- Checkbox changes now use targeted DOM updates instead of full dialog re-renders
- String values in generated macro scripts are now properly escaped to prevent injection
- Improved error messages when Enhanced Region Behaviors module is missing
- Consistent snap mode (TOP_LEFT_VERTEX) across all placement operations
- Potential memory leak fixed by properly unloading textures on error

### Technical

- Added `Hooks.off()` to TypeScript type definitions
- New region behavior builders in `src/utils/builders/region-behavior-builder.ts`
- New region creators in `src/utils/creators/` for trap, teleport, and elevation regions
- Comprehensive test coverage for all new region functionality (827 tests total)

### Dependencies

- **Required**: FoundryVTT v13+, Monk's Active Tiles v11.0+
- **Optional**: Enhanced Region Behaviors (required for trap and elevation regions)

## [1.19.0] - 2026-01-05

### Added

- Ghost tile preview for single-click placement - shows semi-transparent preview following cursor when placing Switch, Light, and Reset tiles
- Ghost tile preview for drag-to-place - shows resizable semi-transparent preview when placing Teleport and Trap tiles
- TilePreviewManager utility class for managing click-to-place tile preview lifecycle
- DragPlacePreviewManager utility class for managing drag-to-place tile preview lifecycle
- Half-grid snapping for more flexible tile placement (at grid corners and centers)
- ESC key cancels placement and restores dialog for all tile types

### Changed

- Switch, Light, and Reset dialogs now use ghost tile preview instead of blind click placement
- Teleport and Trap dialogs now show ghost image during drag-to-place instead of rectangle outline
- Improved user feedback with notification hints during tile placement

## [1.18.2] - 2025-12-02

### Fixed

- Scene Variables panel now groups variables by tile name (Issue #42)

## [1.18.1] - 2025-11-22

### Fixed

- Form state management - React-style state pattern (Issue #38) (#39)

## [1.18.0] - 2025-11-18

### Added

- Add add/remove toggle for Additional Effects
- add Heal result type to trap dialog
- make Custom Tags section sticky at bottom with Create/Cancel buttons
- add FormStateManager utility for form state preservation (Issue #38 Phase 1)
- test: add selectOptions helper mock for Foundry multi-select tests

### Fixed

- Fix switch tile image toggle not working (missing entity field, wrong comparison type, invalid Handlebars helper)
- Fix invalid Patreon menu registration causing console error on module load
- Fix setvariable actions missing entity field for proper variable scoping
- Fix checkvariable using wrong comparison type ('eq' instead of 'all')
- Fix missing Handlebars 'default' helper by using standard {{#if}} syntax
- Restore Setup Tasks list and remove Tagger sticky positioning
- Remove accordion from Tagger section in trap dialog
- Sync radio button UI with state + remove accordion + full-width footer
- Change Setup Tasks from fixed to sticky positioning
- make Setup Tasks fixed at bottom (not scrollable)
- reorder sticky sections - Setup Tasks now directly above buttons
- preserve visibility radio button state and make setup tasks sticky
- accordion and radio button state preservation (Issue #38 Phase 1 improvements)
- replace custom additional effects dropdown with Foundry multi-select element
- replace custom additional effects dropdown with native multi-select

### Changed

- Condense CLAUDE.md documentation from 1,825 to 865 lines (53% reduction)
- Add comprehensive tile-helpers refactoring documentation to CLAUDE.md
- claude settings
- replace FormStateManager with React-style state pattern (Issue #38)
- Complete React-style state refactoring - remove FormStateManager
- convert TrapDialog to React-style state (Part 2)
- convert TrapDialog to React-style component state (Part 1)

### Other

- test: add regression tests for switch setvariable entity field and checkvariable type
- test: improve teleport-dialog coverage from 33.47% to 65.25%
- test: improve light-dialog.ts coverage from 85.45% to 97.57%
- test: improve dialog and utility test coverage to 75%+

## [1.17.0] - 2025-11-17

### Added

- Fix: Redesign trap visibility UI and add bug report template (Issue #28) (#32)

### Fixed

- v1.16.2: Fix teleport dialog scrolling, improve dialog UX, and centralize positions (#35)
- v1.15.3: Fix pause game checkbox not being read from trap dialog (#31)

### Other

- v1.16.0: Trap dialog accordion UI with setup tasks guide (#33)

## [1.16.2] - 2025-11-17

### Added

- style: add sticky footer positioning to all dialogs
- Fix: Redesign trap visibility UI and add bug report template (Issue #28) (#32)

### Fixed

- make Tagger accordion only in trap dialog, always visible in others
- enable scrolling for teleport dialog (Issue #34)
- v1.15.3: Fix pause game checkbox not being read from trap dialog (#31)

### Changed

- bump version to 1.16.1

### Other

- docs: update CHANGELOG with Tagger fix
- v1.16.0: Trap dialog accordion UI with setup tasks guide (#33)

## [1.16.1] - 2025-11-17

### Fixed

- enable scrolling for teleport dialog to fix inaccessible Create button (Issue #34)
- make Tagger section accordion only in trap dialog, always visible in other dialogs
- move Tagger to last section in all dialogs for consistency

### Changed

- make Create/Cancel footer sticky and always visible at bottom of all dialogs

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
