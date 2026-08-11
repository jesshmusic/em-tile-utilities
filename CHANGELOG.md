# Changelog

All notable changes to this project will be documented in this file.

## [2.2.0] - 2026-08-11

A correctness release. Three features that appeared to work in the UI never actually did anything at the table — saving throws, trap damage under midi-qol, and the Reset tile — and this release fixes all three, along with the dnd5e 5.3.3 and Monk's Active Tiles 14.01 integration points that had silently drifted out of date.

### ⚠️ Upgrade note: rebuild traps and teleports that use saving throws

Saving throws were never saving throws (see below). The fix changes what new tiles emit, but **tiles created before 2.2.0 already have the old request baked into their Monk's Active Tiles action data and will keep rolling ability checks**. There is no migration — Foundry has no safe way to tell an intentional ability check apart from this bug. To get real saves, delete and recreate any trap or teleport that requests one. Everything else carries forward unchanged.

### Fixed

- **Saving throws rolled ability checks, not saving throws.** Monk's Token Bar namespaces roll requests as `save:`/`ability:`/`skill:`/`misc:` and resolves them against its per-system request options. Every option in this module labelled "… Save" emitted `ability:<abbr>`, which is an ability _check_ — so save proficiency never applied and characters proficient in the save gained nothing from it. The teleport dialog was worse: it emitted a bare `dex` that matched no option in its own template, and Monk's Token Bar's `findBestRequest` scans groups in order and reaches `ability` before `save`, so it silently resolved to a Dexterity check. Traps, teleports and the dnd5e activity import path now all emit `save:<abbr>`.
- **Traps rolled damage but never applied it when midi-qol is installed.** The GM saw the save resolve, saw a damage roll post to chat, saw no error — and the token kept every hit point. Monk's Active Tiles resolves a hurt/heal value through `MonksActiveTiles.getValue`, and a value wrapped in Foundry inline-roll brackets (`-[[3d6]]`) routes into `inlineRoll` → `doRoll` → `ChatMessage#applyMode`, which throws inside midi-qol's `ChatMessageMidi` subclass on v14. The throw lands _after_ the roll is posted and _before_ `actor.applyDamage`, which is why the failure was invisible. Traps now emit plain formulas (`-3d6`, `-floor((3d6) / 2)`, `2d10`) instead of bracketed ones.
- **The Reset tile never reset anything.** Four independent defects, all confirmed against a real switch on Foundry 14.364 / Monk's Active Tiles 14.01:
  - Variables were written to the wrong tile. The set-variable action hardcoded the entity `This Tile`, which Monk's Active Tiles resolves to the tile _running_ the action — so every value was stored on the Reset tile's own flags and the target switch was never touched. Reset actions now address each target tile explicitly, and variables are tracked per target rather than in one flat map that silently collided when two tiles used the same variable name.
  - A null reset value was emitted as the literal string `"null"`, which Monk's Active Tiles evaluated and stored as a live value rather than clearing anything. It has a dedicated sentinel for this; null now clears the variable back to its never-set state.
  - The image index was off by one. Monk's Active Tiles treats a numeric image selection as 1-based, and the dialog captured a 0-based index, so a reset could only ever restore the _first_ image and the second was unreachable.
  - Every per-tile control in the reset dialog was named after an empty string (`fileindex_`, `var__switch_1`, `walldoor__0`). With one selected tile this round-tripped by accident; with two, all of their controls collided. Door resets separately looked up a key the template never emitted, so every door reset submitted an undefined state, and re-rendering the dialog reverted each tile's captured image, visibility, rotation, position, variables and door states.
- **Combat trap trigger limits did nothing.** The "trigger at most N times" counter was built from Handlebars helpers that are not registered in the context Monk's Active Tiles compiles action values in, and calling an unknown helper with arguments throws. The paired check also passed a comparison mode that is not one of the three legal values, so the filter always took the failure branch. Both are rewritten in terms Monk's Active Tiles actually evaluates.
- **Combat traps produced no attack roll.** Monk's Active Tiles 14.01 gives dnd5e a dedicated attack branch in which only "roll the attack" resolves a callable; this module emitted the other mode, so execution fell through to bare targeting with fast-forward and damage both gated off and only the chat card rendered.
- **Traps imported from a DMG trap item always used Dexterity, and spell-derived traps always used DC 14.** In dnd5e 5.3.3 the activity's save ability is a `Set`, and the code read it by index — which is always `undefined` on a `Set` — so every import fell back to Dexterity regardless of what the source item said. The DC formula field is only populated for a manually entered flat DC and is blank for spellcasting-derived DCs, so those fell back to the hardcoded 14. Both now read the fields dnd5e actually computes, and all dnd5e access sits behind a system guard so other systems degrade cleanly.
- **Traps set to affect "player tokens" hit the wrong targets**, applying their status effects to every token standing on the tile instead. One copy of the target-type switch was missing the player-tokens case and fell through to "within tile".
- **Foundry v14 deprecated-global cleanup.** `loadTemplates`, `renderTemplate`, `FilePicker`, `SearchFilter`, `ContextMenu` and `TextEditor` still resolve in 14.364, but only through backwards-compatibility getters marked "since 13, until 15" — they log a deprecation on every access and stop working in v15. The module is now off all of them. `AudioHelper` genuinely is gone, which is why teleport region sounds failed at trigger time; that call is now namespaced correctly.
- **Paired teleport cleanup never fired.** Deleting one half of a linked pair was supposed to offer to delete the other, but the matching logic looked for hyphenated tag prefixes that the tag generator never produces, so the partner was silently orphaned. The deletion prompt also rendered the tile's name as an empty string, because these tiles carry their label in a module flag rather than in the document name.
- **Grid snapping used raw mode numbers against a bit field**, so regions could start and end on half-square offsets and imported tiles landed half a square off.
- **Check State tiles honoured only the "equals" operator.** Not-equals, greater/less-than and the AND/OR connector were silently dropped, leaving the branch to run unconditionally. All six operators now map explicitly, multi-condition branches are emitted as real control flow, and numeric operands compare numerically rather than lexicographically. Branch anchor tags are index-suffixed, so two similarly-named branches no longer collide.
- **Dialogs cleaned up twice or not at all.** `_onClose` was wired both as the Cancel button action and as the ApplicationV2 close lifecycle callback, so it re-entered itself and never reached `super`. Split across all eight affected dialogs; cleanup now runs exactly once on every close path.
- **Dialog height guard was inert.** The stylesheet scoped its flex layout and `max-height: 90vh` to the ApplicationV1 root class, which ApplicationV2 does not use — which is why the fixed dialog heights could overflow small viewports.
- Combat traps discarded any custom tags entered in the dialog, revealed their token on the map even when configured hidden, and left an orphaned Actor, Item and Token behind if tile creation failed partway.
- Tag uniqueness scanned only tiles and lights, so a new tag could collide with an existing region, sound or token.
- Return teleports landed on the outbound pad's top-left corner rather than its centre.

### Changed

- **Dependency floors now match what the code requires**: Monk's Active Tiles 14.01, Tagger 1.6.0, Monk's Token Bar 14.01. Enhanced Region Behaviors is declared as a _suggestion_ rather than a requirement — trap and elevation regions need it and say so with a clear error, but requiring it would make Foundry refuse to enable the module at all for GMs who only use tiles.
- **User-facing strings are localizable.** 108 notification literals, every settings name and hint, the trap dialog's validation messages, the teleport deletion prompts and the variables help text now go through `lang/en.json`. The rendered English is unchanged. Damage type names now come from the dnd5e system's own localized list, with an SRD fallback for non-dnd5e worlds, replacing a hardcoded parallel list that would silently drift.
- **CI actually checks the code now.** The job named "Lint & Type Check" ran neither: it ran `npm run build`, which is an esbuild transpile with no type checking. `tsc` had never been run against this project. The quality job now runs type check → lint → format check → build, lint fails on any warning, and a pre-merge job requires a real semver version bump with `package.json` and `module.json` in agreement. Jest now enforces a coverage floor.
- **Releases register the correct Foundry compatibility.** Both release workflows hardcoded v13 in the FoundryVTT package API payload while `module.json` declared v14, so every release since v2.1.0 was published to the package listing with the wrong core version range. Compatibility is now read from `module.json`. A LICENSE file was also being zipped into every release archive without existing — `zip` warns and exits 0 — so releases shipped without one; the file now exists and the archive step fails loudly on a missing path.
- **~127 KB of dead code removed**: an unused base dialog class, seven orphaned templates, nine unreferenced exports, their tests, the CSS that styled the deleted templates, and 59 orphaned localization keys.
- Test suite grown to 993 tests across 28 suites, including new coverage for the reset dialog template, the dnd5e activity parser, the localization contract, template accessibility and the stylesheet's scoping rules.

## [2.1.3] - 2026-04-08

### Added

- Branded `dungeonmaster.guru` cross-promotion link in the Tile Manager footer, using the DM Guru logo. Patreon + DM Guru buttons are now equal-width in a shared footer-links row, with version info below. Shortened Patreon link text. Module chrome now picks up DM Guru brand accent colors on card titles, borders, and hover states (background and text colors unchanged).
- **Version display now baked at build time** via a `package.json` import. Previously the Tile Manager footer read `game.modules.get(...).version`, which Foundry caches at world startup and doesn't refresh on hot-reload, so the footer could show a stale version after a rebuild.

## [2.1.2] - 2026-04-07

### Added

- **Runtime dependency version warnings**. When Monk's Active Tiles, Tagger, or Monk's Token Bar is installed and active but its manifest declares itself incompatible with the running Foundry version (i.e. `compatibility.maximum` is below the current Foundry major, or `compatibility.verified` is behind), a notification now fires on `ready` naming the specific dep and its declared max/verified version. Hard-cap mismatches are permanent notifications; stale-verified mismatches are transient. Only fires for deps that are present and active — the existing "not installed" error paths are untouched.
- **`dungeonmaster.guru` link in the Tile Manager footer**, alongside the existing Patreon link and version info. Links to Jess's SRD rules and DM tools site.

## [2.1.1] - 2026-04-07

### Fixed

- **Tile creation failed for every tile type on Foundry v14** with the error `[TileDocument] validation errors: occlusion: SchemaField#_validateRecursive modes: ArrayField#_validateRecursive 0: 0 is not a valid choice`. Foundry v14 renamed `TileDocument.occlusion.mode` (singular `NumberField`) to `TileDocument.occlusion.modes` (`SetField` of `NumberField`s) and removed `OCCLUSION_MODES.NONE` (`0`) from the valid choices — "no occlusion" is now represented by an empty set. Foundry's compatibility migration `_addDataFieldMigration("occlusion.mode", "occlusion.modes", d => [d.occlusion.mode])` wraps the legacy `mode: 0` value into `modes: [0]`, which then fails validation because `0` is no longer in the allowed choices for the new `SetField`. `createBaseTileData` now emits `occlusion: { modes: [], alpha: 0 }` directly, fixing tile creation for all seven tile types (switch, light, trap, teleport, reset, combat trap, check state).
- **Cascading `Tagger | setTags | Invalid object provided` error**: when tile creation failed, `createLightTile` passed the `undefined` result to `Tagger.setTags`, which threw a confusing second error that masked the original validation error. `createLightTile` now wraps its document creation in a try/catch that **rolls back** any previously-created `AmbientLight` / `AmbientSound` / overlay `Tile` and **re-throws** the original error so callers (e.g. `LightConfigDialog`) can avoid showing a misleading "Light tile created!" notification on failure.

## [2.1.0] - 2026-04-06

### Added

- Foundry VTT v14 compatibility (`compatibility.verified` bumped to `14`). **Minimum Foundry version bumped to 14**. Earlier versions of this module remain available for v13 users from the GitHub releases page; this version is v14-only by design.

### Fixed

- **`Dialog.confirm` removed in v14**: Migrated the two teleport-cleanup confirmation dialogs in `src/main.ts` from the legacy `Dialog.confirm` API to `foundry.applications.api.DialogV2.confirm`. The `defaultYes: true` option is replaced with the v14 `yes: { default: true }` shape.
- **`FilePicker` global removed in v14**: All seven dialog file pickers (switch, light, reset, check-state, base-trap, teleport, trap) now resolve `FilePicker` via `foundry.applications.apps.FilePicker`. (A `(globalThis as any).FilePicker` fallback is retained as a safety net so the resolution chain doesn't throw `ReferenceError` if a future v14 release reshapes the namespace, but this release is v14-only — v13 users should stay on the previous tagged release.)
- **SceneControlTool `onClick` → `onChange`**: The toolbar button registration in `src/main.ts` previously used `onClick`, which v14's SceneControls no longer fires for `button: true` tools. Switched to `onChange`, matching the v14 SceneControlTool shape.

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
