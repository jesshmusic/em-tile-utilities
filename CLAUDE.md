# CLAUDE.md - Technical Reference for AI Assistants

This document contains technical notes, patterns, and conventions for working on the EM Tile Utilities project.

## Project Overview

**EM Tile Utilities** is a FoundryVTT v13 module that provides UI tools for creating interactive tiles using Monk's Active Tiles. Built with TypeScript, uses Foundry's ApplicationV2 API.

**Key Dependencies:**
- FoundryVTT v13+ (uses ApplicationV2 API)
- Monk's Active Tiles v11.0+ (required module)

## Architecture

### File Structure
```
src/
├── main.ts                    # Module entry point, hooks, toolbar registration
├── dialogs/                   # ApplicationV2 dialog implementations
│   ├── switch-dialog.ts       # Switch tile creator
│   ├── light-dialog.ts        # Light tile creator
│   ├── reset-dialog.ts        # Reset tile creator
│   ├── variables-viewer.ts    # Scene variables viewer
│   └── tile-manager.ts        # Tile management UI
├── utils/
│   └── tile-helpers.ts        # Core tile creation functions
└── types/
    ├── foundry.d.ts           # Foundry API type definitions
    └── module.ts              # Module-specific types

templates/                     # Handlebars templates (one per dialog)
styles/dialogs.css            # All dialog styles
lang/en.json                  # Localization strings
dist/main.js                  # Build output (IIFE bundle)
```

### Build System
- **Rollup** bundles TypeScript → single IIFE at `dist/main.js`
- Custom plugin `rollup-plugin-increment-build.mjs` increments build number
- `build-info.json` tracks build number (auto-generated)
- Scripts: `npm run build`, `npm run watch`, `npm run clean`
- Release scripts: `npm run release:patch|minor|major`

## Foundry VTT v13 Patterns

### ApplicationV2 Dialogs
All dialogs extend `HandlebarsApplicationMixin(ApplicationV2)`:

```typescript
const { ApplicationV2, HandlebarsApplicationMixin } = (foundry as any).applications.api;

export class MyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'unique-id',
    classes: ['my-dialog', 'em-puzzles'],
    window: {
      contentClasses: ['standard-form'],
      icon: 'fa-solid fa-icon',
      title: 'EMPUZZLES.LocalizationKey'
    },
    position: { width: 480 },
    form: {
      closeOnSubmit: true,
      handler: MyDialog.#onSubmit  // Private static method
    },
    actions: {
      actionName: MyDialog.#onActionName  // For data-action buttons
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
    return { ...context, myData: 'value' };
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
- Use private static methods (`#methodName`) for form handlers and actions
- Always call `super._prepareContext()` and spread the result
- `_onRender` is where you set up DOM event listeners
- `formData.object` contains form field values as an object

### File Pickers
Standard pattern for file picker buttons:

```typescript
_onRender(context: any, options: any): void {
  super._onRender(context, options);

  const filePickerButtons = this.element.querySelectorAll('.file-picker');
  filePickerButtons.forEach((button: Element) => {
    (button as HTMLElement).onclick = this._onFilePicker.bind(this);
  });
}

async _onFilePicker(event: Event): Promise<void> {
  event.preventDefault();
  const button = event.currentTarget as HTMLElement;
  const target = button.dataset.target;  // Input name to update
  const type = button.dataset.type;      // 'imagevideo' or 'audio'

  const input = this.element.querySelector(`input[name="${target}"]`) as HTMLInputElement;
  const fp = new (FilePicker as any)({
    type: type,
    current: input.value,
    callback: (path: string) => {
      input.value = path;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  return fp.browse();
}
```

### Canvas Click Placement Pattern
For placing tiles on canvas after dialog submission:

```typescript
static async #onSubmit(event: SubmitEvent, form: HTMLFormElement, formData: any): Promise<void> {
  const data = formData.object;

  ui.notifications.info('Click on the canvas to place the tile...');

  const handler = async (clickEvent: any) => {
    const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
    const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

    await createTile(canvas.scene, data, snapped.x, snapped.y);

    ui.notifications.info('Tile created!');
    (canvas as any).stage.off('click', handler);
  };

  (canvas as any).stage.on('click', handler);
}
```

## Monk's Active Tiles Integration

### Tile Data Structure
All created tiles include `flags['monks-active-tiles']` with this structure:

```typescript
flags: {
  "monks-active-tiles": {
    name: "Tile Name",
    active: true,                    // Whether tile is active
    record: false,
    restriction: "all",              // Who can trigger: "all", "gm", "player"
    controlled: "all",
    trigger: ["dblclick"],           // Trigger types: "dblclick", "click", "darkness"
    allowpaused: false,
    usealpha: false,
    pointer: true,                   // Show pointer cursor on hover
    vision: true,
    pertoken: false,
    minrequired: null,
    cooldown: null,
    chance: 100,
    fileindex: 0,                    // Current file index for tile image
    actions: [],                     // Array of action objects
    files: [],                       // Array of images for tile states
    variables: {}                    // Scene variables used by this tile
  }
}
```

### Common Actions

**Play Sound:**
```typescript
{
  action: "playsound",
  data: {
    audiofile: "path/to/sound.ogg",
    audiofor: "everyone",
    volume: 1,
    loop: false,
    fade: 0.25
  },
  id: foundry.utils.randomID()
}
```

**Set Variable:**
```typescript
{
  action: "setvariable",
  data: {
    name: "variableName",
    value: "{{not variable.variableName}}",  // Handlebars expression
    scope: "scene"
  },
  id: foundry.utils.randomID()
}
```

**Check Value (Conditional):**
```typescript
{
  action: "checkvalue",
  data: {
    name: "variable.variableName",
    value: "true",
    fail: "anchorTag"  // Jump to anchor if false
  },
  id: foundry.utils.randomID()
}
```

**Anchor (Jump Target):**
```typescript
{
  action: "anchor",
  data: {
    tag: "anchorTag",
    stop: false
  },
  id: foundry.utils.randomID()
}
```

**Change Tile Image:**
```typescript
{
  action: "tileimage",
  data: {
    entity: { id: "tile", name: "This Tile" },  // "tile" = current tile
    select: "next",  // "next", "previous", or numeric fileindex
    transition: "none"
  },
  id: foundry.utils.randomID()
}
```

**Toggle Entity Active State:**
```typescript
{
  action: "activate",
  data: {
    entity: {
      id: "Scene.{sceneId}.AmbientLight.{lightId}",
      name: "Light Name"
    },
    activate: "toggle",  // "activate", "deactivate", "toggle"
    collection: "lights"
  },
  id: foundry.utils.randomID()
}
```

**Move Token/Tile:**
```typescript
{
  action: "movetoken",
  data: {
    entity: { id: "Scene.{sceneId}.Tile.{tileId}" },
    duration: 0,
    x: "100",
    y: "200",
    location: { id: "", x: 100, y: 200, name: "[x:100 y:200]" },
    snap: true,
    speed: 6,
    trigger: false
  },
  id: foundry.utils.randomID()
}
```

**Show/Hide Entity:**
```typescript
{
  action: "showhide",
  data: {
    entity: { id: "Scene.{sceneId}.Tile.{tileId}" },
    collection: "tiles",
    hidden: "hide",  // "hide" or "show"
    fade: 0
  },
  id: foundry.utils.randomID()
}
```

**Change Door State:**
```typescript
{
  action: "changedoor",
  data: {
    entity: { id: "Scene.{sceneId}.Wall.{wallId}" },
    type: "nothing",
    state: "open",  // "open", "closed", "locked"
    movement: "nothing",
    light: "nothing",
    sight: "nothing",
    sound: "nothing"
  },
  id: foundry.utils.randomID()
}
```

**Chat Message:**
```typescript
{
  action: "chatmessage",
  data: {
    text: "Message text with {{variable.name}}",
    flavor: "",
    whisper: "gm",  // "gm", "token", or ""
    language: ""
  },
  id: foundry.utils.randomID()
}
```

### Entity ID Format
When referencing entities in actions:
- Current tile: `{ id: "tile", name: "This Tile" }`
- Other tile: `{ id: "Scene.{sceneId}.Tile.{tileId}", name: "Tile: {tileId}" }`
- Light: `{ id: "Scene.{sceneId}.AmbientLight.{lightId}" }`
- Wall: `{ id: "Scene.{sceneId}.Wall.{wallId}" }`

## Tile Creation Patterns

### Standard Tile Data Template
```typescript
const tileData = {
  texture: {
    src: imagePath,
    anchorX: 0.5,
    anchorY: 0.5,
    fit: "fill",
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    tint: "#ffffff",
    alphaThreshold: 0.75
  },
  width: gridSize,
  height: gridSize,
  x: tileX,
  y: tileY,
  elevation: 0,
  sort: 0,                           // Z-order for rendering
  occlusion: { mode: 0, alpha: 0 },
  rotation: 0,
  alpha: 1,
  hidden: false,
  locked: false,
  restrictions: { light: false, weather: false },
  video: { loop: true, autoplay: true, volume: 0 },
  flags: { "monks-active-tiles": { /* ... */ } },
  visible: true,
  img: imagePath
};

await scene.createEmbeddedDocuments('Tile', [tileData]);
```

### Grid Sizing
```typescript
const gridSize = (canvas as any).grid.size;  // 1 grid square
const largeSize = gridSize * 2;              // 2x2 grid squares
```

### Creating Lights
```typescript
const lightData = {
  x: centerX,
  y: centerY,
  rotation: 0,
  elevation: 0,
  walls: true,
  vision: false,
  config: {
    angle: 360,
    color: "#ffffff",      // null for no color
    dim: 40,              // Dim light radius
    bright: 20,           // Bright light radius
    alpha: 0.5,           // Color intensity
    negative: false,
    priority: 0,
    coloration: 1,
    attenuation: 0.5,
    luminosity: 0.5,
    saturation: 0,
    contrast: 0,
    shadows: 0,
    animation: { type: null, speed: 5, intensity: 5, reverse: false },
    darkness: { min: 0, max: 1 }  // Darkness range for activation
  },
  hidden: false
};

const [light] = await scene.createEmbeddedDocuments('AmbientLight', [lightData]);
const lightId = (light as any).id;
```

## Handlebars Template Patterns

### Standard Form Structure
```handlebars
<div class="form-group">
  <label for="fieldName">{{localize "EMPUZZLES.Label"}}</label>
  <input type="text" name="fieldName" value="{{defaultValue}}" />
  <p class="hint">{{localize "EMPUZZLES.Hint"}}</p>
</div>
```

### File Picker Button
```handlebars
<div class="form-group">
  <label for="imagePath">{{localize "EMPUZZLES.Image"}}</label>
  <div class="file-picker-group">
    <input type="text" name="imagePath" value="{{imagePath}}" />
    <button type="button" class="file-picker" data-target="imagePath" data-type="imagevideo">
      <i class="fas fa-file-image"></i>
    </button>
  </div>
</div>
```

### Conditional Content
```handlebars
{{#if hasTiles}}
  <div class="tile-list">
    {{#each tiles as |tile|}}
      <div class="tile-entry" data-tile-id="{{tile.id}}">
        {{#if tile.image}}
          <img src="{{tile.image}}" class="tile-thumbnail" />
        {{else}}
          <img src="icons/svg/hazard.svg" class="tile-thumbnail tile-thumbnail-placeholder" />
        {{/if}}
        <span>{{tile.name}}</span>
      </div>
    {{/each}}
  </div>
{{else}}
  <p class="no-content">{{localize "EMPUZZLES.NoTiles"}}</p>
{{/if}}
```

### Action Buttons (ApplicationV2)
```handlebars
<button type="button" data-action="actionName" data-tile-id="{{tile.id}}">
  <i class="fas fa-icon"></i> {{localize "EMPUZZLES.ButtonLabel"}}
</button>
```

## Localization

All user-facing strings must be in `lang/en.json` under the `EMPUZZLES` key:

```json
{
  "EMPUZZLES": {
    "KeyName": "Display Text",
    "KeyNameHint": "Help text for the field"
  }
}
```

Access in templates: `{{localize "EMPUZZLES.KeyName"}}`
Access in code: `game.i18n.localize('EMPUZZLES.KeyName')`

## Settings Management

### Registering Settings
In `main.ts` during `init` hook:

```typescript
game.settings.register('em-tile-utilities', 'settingName', {
  name: 'Display Name',
  hint: 'Help text',
  scope: 'world',          // 'world' or 'client'
  config: true,            // Show in module settings UI
  type: String,            // String, Number, Boolean
  default: 'default value',
  filePicker: 'imagevideo' // Optional: adds file picker button
});
```

### Accessing Settings
```typescript
const value = game.settings.get('em-tile-utilities', 'settingName') as string;
await game.settings.set('em-tile-utilities', 'settingName', newValue);
```

## Toolbar Integration

Buttons are added via `getSceneControlButtons` hook in `main.ts`:

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
    order: 1000  // Higher = appears later in toolbar
  };
});
```

## Common Patterns

### Auto-Incrementing IDs
```typescript
// In _prepareContext:
const counter = game.settings.get('em-tile-utilities', 'switchCounter') as number;
const nextId = `switch_${counter}`;

// After creation:
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

### Tile Property Access
```typescript
// Get all tiles
const tiles = Array.from((scene.tiles as any).values());

// Tile properties
tile.id
tile.name
tile.texture.src
tile.x, tile.y
tile.width, tile.height
tile.elevation
tile.sort
tile.hidden
tile.locked
tile.flags['monks-active-tiles']

// Monks data
const monksData = tile.flags['monks-active-tiles'];
monksData.active
monksData.actions
monksData.variables
monksData.files
```

## Testing & Development

### Watch Mode
```bash
npm run watch  # Auto-rebuild on file changes
```

### Testing Workflow
1. Run `npm run watch`
2. Make changes in `src/`
3. Refresh FoundryVTT (F5)
4. Test in Tiles layer with Monk's Active Tiles enabled

### Console Debugging
```typescript
console.log('%c🧩 Debug:', 'color: #ff6b35;', data);
```

## Common Gotchas

1. **Always use `(foundry as any)` and `(canvas as any)`** - Foundry types aren't fully typed
2. **Action IDs must be unique** - Always use `foundry.utils.randomID()`
3. **Tile placement needs canvas click handler** - Set up in form submit handler
4. **ApplicationV2 form handlers are private static** - Use `#methodName` syntax
5. **Handlebars expressions in action values** - Use `{{variable.name}}` syntax
6. **File index is 0-based** - First file in `files` array is fileindex 0
7. **Grid coordinates vs pixel coordinates** - Always snap to grid for placement
8. **Scene variables scope** - Always use `scope: "scene"` for tile variables
9. **Entity references need full path** - Format: `Scene.{id}.Type.{id}`
10. **Light position centering** - Add `gridSize / 2` to tile x/y for center placement

## Type Definitions

Basic types are in `src/types/module.ts`:

```typescript
export interface SwitchConfig {
  name: string;
  variableName: string;
  onImage: string;
  offImage: string;
  sound: string;
}

export interface LightConfig {
  name: string;
  onImage: string;
  offImage: string;
  useDarkness: boolean;
  darknessMin: number;
  dimLight: number;
  brightLight: number;
  lightColor: string | null;
  colorIntensity: number;
}
```

## Version Management

The module uses a custom build increment system:
- `build-info.json` contains `buildNumber`
- `rollup-plugin-increment-build.mjs` increments on each build
- Version displayed in console banner on init

Release process:
```bash
npm run release:patch  # 1.1.2 → 1.1.3
npm run release:minor  # 1.1.2 → 1.2.0
npm run release:major  # 1.1.2 → 2.0.0
```

This updates `module.json`, `package.json`, and creates git tag.
