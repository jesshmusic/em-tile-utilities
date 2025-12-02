# CLAUDE.md - Technical Reference for AI Assistants

This document contains technical notes, patterns, and conventions for working on Dorman Lakely's Tile Utilities.

> **Note**: This is **developer documentation**. README.md is for end users.
>
> - **README.md**: User-focused, benefits-oriented, no technical jargon
> - **CLAUDE.md**: Developer-focused, implementation details, code patterns

## Project Overview

**Dorman Lakely's Tile Utilities** is a FoundryVTT v13 module providing UI tools for creating interactive tiles using Monk's Active Tiles. Built with TypeScript using Foundry's ApplicationV2 API.

**Key Dependencies:**

- FoundryVTT v13+ (ApplicationV2 API)
- Monk's Active Tiles v11.0+ (required)

## Quick Start for AI Assistants

**Essential Commands:**

```bash
npm run build          # Build TypeScript → dist/main.js
npm run watch          # Auto-rebuild on changes
npm run lint           # Check code style
npm run lint -- --fix  # Auto-fix issues
npm test               # Run 544 Jest unit tests
npm run test:watch     # Watch mode
npm run test:coverage  # Generate coverage report
```

**Key Patterns:**

- Dialogs extend `HandlebarsApplicationMixin(ApplicationV2)`
- Tile creation uses modular creators (switch, light, trap, etc.)
- Action builders create type-safe Monk's Active Tiles actions
- All files in `src/` directory (TypeScript)
- Tests in `tests/` directory (Jest + ts-jest)

## Architecture

### File Structure

```
src/
├── main.ts                    # Module entry, hooks, toolbar
├── dialogs/                   # ApplicationV2 dialog implementations
│   ├── switch-dialog.ts
│   ├── light-dialog.ts
│   ├── trap-dialog.ts
│   ├── teleport-dialog.ts
│   ├── reset-dialog.ts
│   ├── combat-trap-dialog.ts
│   ├── check-state-dialog.ts
│   ├── tile-manager.ts
│   └── variables-viewer.ts
├── utils/
│   ├── helpers/              # Utility functions
│   │   ├── naming-helpers.ts
│   │   ├── tag-helpers.ts
│   │   ├── grid-helpers.ts
│   │   ├── folder-helpers.ts
│   │   └── module-checks.ts
│   ├── actions/              # Action builders (21+)
│   │   ├── tile-actions.ts
│   │   ├── combat-actions.ts
│   │   ├── variable-actions.ts
│   │   ├── flow-control-actions.ts
│   │   ├── common-actions.ts
│   │   ├── door-actions.ts
│   │   └── monks-tokenbar-actions.ts
│   ├── builders/             # Data structure builders
│   │   ├── base-tile-builder.ts
│   │   ├── monks-config-builder.ts
│   │   └── entity-builders.ts
│   └── creators/             # Tile creation (7 creators)
│       ├── switch-creator.ts
│       ├── light-creator.ts
│       ├── trap-creator.ts
│       ├── teleport-creator.ts
│       ├── reset-creator.ts
│       ├── combat-trap-creator.ts
│       ├── check-state-creator.ts
│       └── index.ts
└── types/
    ├── foundry.d.ts          # Foundry API types
    └── module.ts             # Module types

templates/                    # Handlebars templates
styles/dialogs.css           # All dialog styles
lang/en.json                 # Localization
dist/main.js                 # Build output (IIFE)
```

### Build System

- **Vite** bundles TypeScript → single IIFE at `dist/main.js`
- Configuration in `vite.config.ts` (library mode, IIFE format)
- Custom plugin increments build number on each build
- `build-info.json` tracks build number (auto-generated)
- Source maps enabled with inline sources
- Scripts: `build`, `watch`, `clean`, `release:patch|minor|major`

## Tile-Helpers Refactoring - Modular Architecture

### Before & After

**Before (v1.15.x):**

- Single `tile-helpers.ts` file: 2,502 lines
- All tile creation in one monolithic file
- Significant code duplication
- Hard to maintain and extend

**After (v1.16.0+):**

- Modular 4-layer architecture: helpers → actions → builders → creators
- 7 creator modules (1,523 lines total)
- 21+ reusable action builders
- Net deletion: 1,026 lines of code
- Zero code duplication

### Module Organization

**Layer 1: Helpers** (5 modules)

- `naming-helpers.ts` - Tile numbering, name generation
- `tag-helpers.ts` - Tagger integration, unique tag generation
- `grid-helpers.ts` - Grid sizing, position calculations
- `folder-helpers.ts` - Folder creation, organization
- `module-checks.ts` - Check for Monk's Token Bar, Tagger, etc.

**Layer 2: Action Builders** (21+ builders in 7 modules)

- Type-safe functions that return Monk's Active Tiles action objects
- Examples: `createPlaySoundAction`, `createHurtHealAction`, `createTeleportAction`
- Enforce correct data structure and provide defaults
- Import from `utils/actions`

**Layer 3: Builders** (3 modules)

- `base-tile-builder.ts` - Base tile data structure
- `monks-config-builder.ts` - Monk's Active Tiles flags
- `entity-builders.ts` - Ambient lights, sounds, tokens, actors

**Layer 4: Creators** (7 creators)

- High-level tile creation functions
- Combine helpers, builders, and actions
- Handle complete tile creation flow
- Examples: `createSwitchTile`, `createTrapTile`, `createCombatTrapTile`

### Common Action Builder Patterns

```typescript
// Simple action - use builder
import { createPlaySoundAction } from '../actions';
actions.push(createPlaySoundAction('sound.ogg'));

// Action with options - use builder with config
import { createHurtHealAction } from '../actions';
actions.push(
  createHurtHealAction('-[[2d6]]', {
    entity: { id: 'token', name: 'Triggering Token' },
    chatmessage: true
  })
);

// Complex action with unsupported fields - use raw object
actions.push({
  action: 'teleport',
  data: {
    entity: { id: 'token', name: 'Triggering Token' },
    location: { x, y, sceneId: scene.id },
    position: 'random', // Not supported by builder
    avoidtokens: true // Not supported by builder
  },
  id: foundry.utils.randomID()
});
```

### Key Action Builders Reference

**Tile Actions:**

- `createActivateAction(entityId, mode, options)` - Activate/deactivate/toggle
- `createShowHideAction(entityId, hidden, options)` - Show/hide/toggle
- `createTileImageAction(entityId, select)` - Change tile image ('next', 'previous', index)
- `createMoveTokenAction(entityId, x, y, options)` - Move tile/token

**Combat Actions:**

- `createHurtHealAction(amount, options)` - Damage/heal (negative = damage)
- `createTeleportAction(x, y, sceneId, options)` - Teleport to position
- `createAttackAction(target, targetName, actor, actorName, itemId, name)` - Run attack
- `createApplyEffectAction(entityId, name, effectId, action, alter)` - Apply/remove effect

**Variable Actions:**

- `createSetVariableAction(name, value, scope)` - Set variable (supports Handlebars)
- `createCheckVariableAction(name, value, failAnchor, comparison)` - Conditional check

**Flow Control:**

- `createAnchorAction(tag, stop)` - Jump target
- `createStopAction()` - Stop execution
- `createPauseAction(pause)` - Pause game
- `createTriggerAction(entityId, options)` - Trigger another tile

**Common Actions:**

- `createChatMessageAction(text, options)` - Send chat message
- `createPlaySoundAction(path, options)` - Play sound
- `createChangeDoorAction(wallId, state)` - Open/close/lock door

**Monk's Token Bar Actions:**

- `createRequestRollAction(type, dc, options)` - Saving throw/ability check
- `createFilterRequestAction(options)` - Split tokens by pass/fail

### Refactoring Gotchas

1. **Action Builder Signatures Must Match Exactly**
   - `createTriggerAction` takes `(entityId, options)` not `(entityId, name, id)`
   - `createActivateAction` collection goes in options: `{collection: 'tiles'}`
   - `createFilterRequestAction` takes object with `{passed, failed, resume}` anchors

2. **Property Names Are Lowercase in Monk's Config**
   - Use `minrequired` not `minRequired`
   - Use `allowpaused` not `allowPaused`
   - Builders handle this automatically

3. **Some Actions Need Raw Objects**
   - Complex teleport with `position: 'random'` not supported by builder
   - Move token with `position` field not in builder options
   - Use raw action object with `foundry.utils.randomID()`

4. **Test Imports Must Update**
   - Change `from '../../src/utils/tile-helpers'` to `from '../../src/utils/creators'`
   - Helper functions like `getNextTileNumber` moved to `utils/helpers/naming-helpers`
   - Mock `ModuleChecks` not `TileHelpers` for `hasMonksTokenBar`

5. **Dynamic Imports in Tests**
   ```typescript
   // Update all dynamic imports
   const { createTrapTile } = await import('../../src/utils/creators');
   const { getNextTileNumber } = await import('../../src/utils/helpers/naming-helpers');
   ```

### Adding New Tile Types

When adding a new tile creator:

1. **Create action sequence** using action builders
2. **Build tile data** using `createBaseTileData`
3. **Build Monk's config** using `createMonksConfig`
4. **Create entities** if needed (lights, sounds) using entity builders
5. **Add Tagger integration** using tag helpers
6. **Export from `creators/index.ts`**
7. **Update imports** in dialogs to use new creator
8. **Add tests** following existing patterns

## Experimental Features Policy

**IMPORTANT**: All new features MUST start behind the experimental features flag.

### Why Experimental Features

- Allows testing without affecting stable users
- Safe iteration on incomplete implementations
- Users opt-in knowingly
- Easier to deprecate features that don't work

### Implementation

```typescript
// 1. Setting already registered in main.ts
game.settings.get('em-tile-utilities', 'experimentalFeatures') as boolean

// 2. Pass to template
async _prepareContext(_options: any): Promise<any> {
  const experimentalFeatures = game.settings.get('em-tile-utilities', 'experimentalFeatures');
  return { ...context, experimentalFeatures };
}

// 3. Conditionally render in template
{{#if experimentalFeatures}}
  <button data-action="newFeature">New Feature</button>
{{/if}}

// 4. Add localization in lang/en.json
```

### When to Remove Flag

Remove experimental flag when:

- Feature fully implemented and tested
- Beta tested without major issues
- Stable enough for general use
- Documentation complete

Then: Remove `{{#if}}` wrapper, update CHANGELOG, increment minor version.

**Current Experimental Features:**

- Check State Tile (complex conditional branching)

## Development Workflow

### Branch Naming

Use prefixes:

- `feat/` - New features
- `enhancement/` - Improvements
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation
- `test/` - Tests

Always branch from `main`, use descriptive kebab-case names.

### Version Bumps

**IMPORTANT**: Version must be bumped BEFORE creating PR using release scripts.

```bash
npm run release:patch  # Bug fixes (1.16.1 → 1.16.2)
npm run release:minor  # New features (1.16.1 → 1.17.0)
npm run release:major  # Breaking changes (1.16.1 → 2.0.0)
```

This updates `package.json`, `module.json`, generates CHANGELOG from commits.

### Commit Messages

Follow conventional format:

- `feat: description` - New features
- `fix: description` - Bug fixes
- `refactor: description` - Code refactoring
- `test: description` - Testing
- `docs: description` - Documentation
- `chore: description` - Build, dependencies

Use present tense, keep first line under 72 characters.

### Pull Requests

**IMPORTANT**: Do NOT include "Generated with Claude Code" or similar AI attribution in PR titles, descriptions, or commit messages. Some users may be turned off by AI-generated content attribution.

### Automated Releases

When PR merges to `main`:

1. GitHub Actions reads version from `package.json`
2. Verifies version was bumped
3. Builds project (`npm run build`)
4. Creates `module.zip`
5. Creates git tag (e.g., `v1.17.0`)
6. Creates GitHub Release with changelog
7. Notifies FoundryVTT Package API

**No commits pushed to main** - version bump is part of your PR.

Manual release: Go to Actions → Manual Release → Run workflow on `main`.

## Foundry VTT v13 Patterns

### ApplicationV2 Best Practices

1. **Use private static methods for handlers** (`#methodName`)
2. **Minimize dialog during canvas placement** so user can see
3. **Clean up event handlers** after use (canvas clicks)
4. **Restore parent dialog** if opened from Tile Manager
5. **Use form-footer.hbs** for consistent buttons

### ApplicationV2 Dialog Pattern

```typescript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'unique-id',
    classes: ['my-dialog', 'em-puzzles'],
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-icon',
      title: 'EMPUZZLES.Title'
    },
    position: { width: 480 },
    form: {
      closeOnSubmit: true,
      handler: MyDialog.#onSubmit  // Private static method
    },
    actions: {
      myAction: MyDialog.#onMyAction
    }
  };

  static PARTS = {
    form: {
      template: 'modules/em-tile-utilities/templates/my-dialog.hbs',
      root: true
    },
    footer: {
      template: 'modules/em-tile-utilities/templates/form-footer.hbs'
    }
  };

  async _prepareContext(_options: any): Promise<any> {
    const context = await super._prepareContext(_options);
    return { ...context, myData: 'value', buttons: [...] };
  }

  _onRender(context: any, options: any): void {
    super._onRender(context, options);
    // Set up event listeners, file pickers, etc.
  }

  static async #onSubmit(event: SubmitEvent, form: HTMLFormElement, formData: any): Promise<void> {
    const data = formData.object;
    // Handle form submission
  }
}
```

**Key Points:**

- Private static methods (`#methodName`)
- Always call `super._prepareContext()` and spread
- `_onRender` for DOM event listeners
- `formData.object` contains form values

### File Pickers

```typescript
_onRender(context: any, options: any): void {
  super._onRender(context, options);
  this.element.querySelectorAll('.file-picker').forEach((button: Element) => {
    (button as HTMLElement).onclick = this._onFilePicker.bind(this);
  });
}

async _onFilePicker(event: Event): Promise<void> {
  event.preventDefault();
  const button = event.currentTarget as HTMLElement;
  const target = button.dataset.target;  // Input name
  const type = button.dataset.type;      // 'imagevideo' or 'audio'

  const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
  const fp = new (FilePicker as any)({
    type,
    current: input.value,
    callback: (path: string) => {
      input.value = path;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  return fp.browse();
}
```

### Canvas Click Placement

```typescript
static async #onSubmit(this: MyDialog, _event: SubmitEvent, _form: HTMLFormElement, formData: any): Promise<void> {
  const scene = canvas.scene;
  const data = formData.object;

  this.minimize();  // IMPORTANT: Let user see canvas
  ui.notifications.info('Click on canvas to place tile...');

  const handler = async (clickEvent: any) => {
    const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
    const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

    await createTile(scene, data, snapped.x, snapped.y);

    // Clean up
    (canvas as any).stage.off('click', handler);
    this.close();

    // Restore parent if exists
    const tileManager = getActiveTileManager();
    if (tileManager) tileManager.maximize();
  };

  (canvas as any).stage.on('click', handler);
}
```

## Monk's Active Tiles Integration

### Tile Data Structure

```typescript
flags: {
  "monks-active-tiles": {
    name: "Tile Name",
    active: true,
    record: false,
    restriction: "all",        // "all", "gm", "player"
    controlled: "all",
    trigger: ["dblclick"],     // "dblclick", "click", "enter", "darkness"
    allowpaused: false,
    pointer: true,             // Show cursor on hover
    vision: true,
    minrequired: null,         // Minimum tokens to trigger
    cooldown: null,
    chance: 100,
    fileindex: 0,              // Current image index
    actions: [],               // Array of action objects
    files: [],                 // Array of images
    variables: {}              // Scene variables
  }
}
```

### Common Actions (Use Builders)

**Play Sound:**

```typescript
createPlaySoundAction('path.ogg', {
  volume: 1,
  loop: false,
  fade: 0.25
});
```

**Set Variable:**

```typescript
createSetVariableAction('myVar', '{{not variable.myVar}}', 'scene');
```

**Check Variable:**

```typescript
createCheckVariableAction('variable.myVar', 'true', 'failAnchor', 'eq');
```

**Anchor:**

```typescript
createAnchorAction('anchorTag', false); // false = don't stop
```

**Change Tile Image:**

```typescript
createTileImageAction('tile', 'next'); // 'next', 'previous', or index
```

### Entity ID Format

- Current tile: `{ id: "tile", name: "This Tile" }`
- Other tile: `{ id: "Scene.{sceneId}.Tile.{tileId}" }`
- Light: `{ id: "Scene.{sceneId}.AmbientLight.{lightId}" }`
- Wall: `{ id: "Scene.{sceneId}.Wall.{wallId}" }`
- Token: `{ id: "Scene.{sceneId}.Token.{tokenId}" }`

## Tile Creation Patterns

### Standard Tile Data

Use `createBaseTileData` builder:

```typescript
const baseTile = createBaseTileData({
  textureSrc: imagePath,
  width: gridSize,
  height: gridSize,
  x: tileX,
  y: tileY,
  hidden: false
});
```

### Grid Sizing

```typescript
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

const gridSize = getGridSize(); // 1 grid square
const largeSize = gridSize * 2; // 2x2 grid squares
const position = getDefaultPosition(x, y); // Scene center if undefined
```

### Creating Lights

Use `createAmbientLightData` builder:

```typescript
const lightData = createAmbientLightData(centerX, centerY, {
  color: '#ffffff',
  dimLight: 40,
  brightLight: 20,
  colorIntensity: 0.5,
  useDarkness: false,
  darknessMin: 0,
  hidden: false
});

const [light] = await scene.createEmbeddedDocuments('AmbientLight', [lightData]);
```

## Testing & Development

### Test Organization

```
tests/
├── dialogs/          # Unit tests for ApplicationV2 dialogs (9 files)
├── utils/            # Unit tests for tile helpers (2 files)
├── integration/      # Template rendering integration tests (3 files)
├── helpers/          # Test utilities (template-helper.ts)
├── mocks/            # Foundry VTT mocks (foundry.ts)
├── setup.ts          # Jest setup
└── README.md         # Test documentation
```

**Test Infrastructure:**

- Jest 30.2.0 with ts-jest
- Node environment (not jsdom)
- 544 tests total
- Coverage: 34% overall, 83% on core utilities

### Unit Testing Pattern

```typescript
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();  // Set up before imports

import { createSwitchTile } from '../../src/utils/creators';

describe('Switch Tile', () => {
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
  });

  it('should create tile with correct structure', () => {
    const config = { name: 'Test', variableName: 'test_var', ... };
    const tile = createSwitchTile(scene, config, 0, 0);

    expect(tile.flags['monks-active-tiles'].name).toBe('Test');
  });
});
```

### Integration Testing (Template Rendering)

```typescript
import { renderDialogTemplate, htmlContainsSelector } from '../helpers/template-helper';
import { TrapDialog } from '../../src/dialogs/trap-dialog';

it('should compile template', async () => {
  const html = await renderDialogTemplate(TrapDialog);
  expect(html).toBeTruthy();
  expect(htmlContainsSelector(html, 'input[name="trapName"]')).toBe(true);
});
```

### Running Tests

```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage
npm run test:ci          # CI mode (GitHub Actions)
```

## Common Patterns

### Auto-Incrementing IDs

```typescript
const counter = game.settings.get('em-tile-utilities', 'switchCounter') as number;
const nextId = `switch_${counter}`;
await game.settings.set('em-tile-utilities', 'switchCounter', counter + 1);
```

### Hook Registration with Cleanup

```typescript
_onRender(context: any, options: any): void {
  super._onRender(context, options);
  if (!(this as any)._hooksRegistered) {
    (this as any)._updateHook = (doc: any) => this._onUpdate(doc);
    Hooks.on('updateTile', (this as any)._updateHook);
    (this as any)._hooksRegistered = true;
  }
}

_onClose(options: any): void {
  super._onClose(options);
  if ((this as any)._hooksRegistered) {
    Hooks.off('updateTile', (this as any)._updateHook);
    (this as any)._hooksRegistered = false;
  }
}
```

### Scene Access

```typescript
const scene = canvas.scene;
if (!scene) {
  ui.notifications.error('No active scene!');
  return;
}
```

## Handlebars Template Patterns

### Standard Form Structure

```handlebars
<div class='form-group'>
  <label for='fieldName'>{{localize 'EMPUZZLES.Label'}}</label>
  <input type='text' name='fieldName' value='{{defaultValue}}' />
  <p class='hint'>{{localize 'EMPUZZLES.Hint'}}</p>
</div>
```

### File Picker Button

```handlebars
<div class='file-picker-group'>
  <input type='text' name='imagePath' value='{{imagePath}}' />
  <button type='button' class='file-picker' data-target='imagePath' data-type='imagevideo'>
    <i class='fas fa-file-image'></i>
  </button>
</div>
```

### Action Buttons

```handlebars
<button type='button' data-action='actionName' data-tile-id='{{tile.id}}'>
  <i class='fas fa-icon'></i>
  {{localize 'EMPUZZLES.ButtonLabel'}}
</button>
```

## Settings Management

### Registering Settings

```typescript
game.settings.register('em-tile-utilities', 'settingName', {
  name: 'Display Name',
  hint: 'Help text',
  scope: 'world', // 'world' or 'client'
  config: true, // Show in module settings UI
  type: String, // String, Number, Boolean
  default: 'value',
  requiresReload: true // Prompt user to reload when changed
});
```

### Accessing Settings

```typescript
const value = game.settings.get('em-tile-utilities', 'settingName') as string;
await game.settings.set('em-tile-utilities', 'settingName', newValue);
```

## Localization

All user-facing strings in `lang/en.json` under `EMPUZZLES` key:

```json
{
  "EMPUZZLES": {
    "KeyName": "Display Text",
    "KeyNameHint": "Help text"
  }
}
```

In templates: `{{localize "EMPUZZLES.KeyName"}}`
In code: `game.i18n.localize('EMPUZZLES.KeyName')`

## Toolbar Integration

```typescript
Hooks.on('getSceneControlButtons', (controls: any) => {
  const tilesControl = controls.tiles;
  if (!tilesControl) return;

  tilesControl.tools['tool-id'] = {
    name: 'tool-id',
    title: 'EMPUZZLES.ToolTitle',
    icon: 'fas fa-icon',
    button: true,
    onClick: () => showDialog(),
    order: 1000
  };
});
```

## Common Gotchas

1. **Always use `(foundry as any)` and `(canvas as any)`** - Foundry types aren't fully typed
2. **Action IDs must be unique** - Always use `foundry.utils.randomID()`
3. **Tile placement needs canvas click handler** - Set up in form submit
4. **ApplicationV2 form handlers are private static** - Use `#methodName`
5. **Handlebars expressions in action values** - Use `{{variable.name}}`
6. **File index is 0-based** - First file in `files` array is fileindex 0
7. **Grid coordinates vs pixel coordinates** - Always snap to grid
8. **Scene variables scope** - Always use `scope: "scene"`
9. **Entity references need full path** - `Scene.{id}.Type.{id}`
10. **Light position centering** - Add `gridSize / 2` to tile x/y

## Type Definitions

Basic types in `src/types/module.ts`:

```typescript
export interface SwitchConfig {
  name: string;
  variableName: string;
  onImage: string;
  offImage: string;
  sound: string;
}

export interface TrapConfig {
  name: string;
  resultType: TrapResultType;
  targetType: TrapTargetType;
  startingImage: string;
  triggeredImage?: string;
  hidden?: boolean;
  pauseGameOnTrigger?: boolean;
  // ... many more fields
}
```

## Style Guide

### Linting Commands

```bash
npm run lint              # Check for issues
npm run lint -- --fix     # Auto-fix issues
npm run format            # Format with Prettier
```

### Key Linting Issues

- Import formatting (keep imports on one line when possible)
- Return type formatting (multi-line for object returns)
- Unused parameters (prefix with underscore: `_event`)
- Long lines (break onto multiple lines)
- Template HTML (include `alt` attributes for images)

### Before Committing

Always run:

```bash
npm run lint -- --fix
npm run build
npm test
```

## Version Management

Custom build increment system:

- `build-info.json` contains `buildNumber`
- Auto-increments on each `npm run build`
- Version displayed in console on init

Release commands:

```bash
npm run release:patch  # 1.1.2 → 1.1.3
npm run release:minor  # 1.1.2 → 1.2.0
npm run release:major  # 1.1.2 → 2.0.0
```

Updates `module.json`, `package.json`, generates CHANGELOG from commit messages.

## Code References

When referencing code, use pattern `file_path:line_number` for navigation:

```
Clients fail in connectToServer function in src/services/process.ts:712
```
