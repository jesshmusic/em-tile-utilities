# CLAUDE.md - Technical Reference for AI Assistants

This document contains technical notes, patterns, and conventions for working on the Dorman Lakely's Tile Utilities project.

> **Note**: This is the **developer documentation**. The README.md is written for end users and contains no implementation details. Keep them separate:
>
> - **README.md**: User-focused, benefits-oriented, no technical jargon
> - **CLAUDE.md**: Developer-focused, implementation details, code patterns

## Project Overview

**Dorman Lakely's Tile Utilities** is a FoundryVTT v13 module that provides UI tools for creating interactive tiles using Monk's Active Tiles. Built with TypeScript, uses Foundry's ApplicationV2 API.

**Key Dependencies:**

- FoundryVTT v13+ (uses ApplicationV2 API)
- Monk's Active Tiles v11.0+ (required module)

## Experimental Features Policy

**IMPORTANT**: All new features MUST start under the experimental features flag.

### Why Use Experimental Features?

- Allows testing new features without affecting stable users
- Provides a safe way to iterate on incomplete implementations
- Users can opt-in to try new features while understanding they may change
- Easier to deprecate or remove features that don't work out

### Implementation Steps

When creating a new feature (dialog, tile type, tool, etc.):

1. **Check the Setting** - The experimental features flag is already registered in `src/main.ts`:

   ```typescript
   game.settings.register('em-tile-utilities', 'experimentalFeatures', {
     name: 'Experimental Features',
     hint: 'Enable experimental features...',
     scope: 'world',
     config: true,
     type: Boolean,
     default: false, // OFF by default
     requiresReload: true // Prompts user to reload when toggled
   });
   ```

2. **Hide UI Elements** - In `tile-manager.ts`, pass the setting to the template:

   ```typescript
   async _prepareContext(_options: any): Promise<any> {
     const experimentalFeatures = game.settings.get(
       'em-tile-utilities',
       'experimentalFeatures'
     ) as boolean;

     return {
       ...context,
       experimentalFeatures: experimentalFeatures
     };
   }
   ```

3. **Conditionally Render** - In `tile-manager.hbs`, wrap the feature button:

   ```handlebars
   {{#if experimentalFeatures}}
     <button type='button' class='create-tile-card' data-action='createNewFeature'>
       <div class='card-icon'>
         <i class='fa-solid fa-icon'></i>
       </div>
       <div class='card-content'>
         <h3 class='card-title'>{{localize 'EMPUZZLES.CreateNewFeature'}}</h3>
         <p class='card-description'>{{localize 'EMPUZZLES.CreateNewFeatureDesc'}}</p>
       </div>
     </button>
   {{/if}}
   ```

4. **Add Localization** - In `lang/en.json`:

   ```json
   {
     "EMPUZZLES": {
       "CreateNewFeature": "New Feature Name",
       "CreateNewFeatureDesc": "Description of what the feature does"
     }
   }
   ```

5. **Document as Experimental** - In code comments and commit messages, clearly mark the feature as experimental.

### When to Remove Experimental Flag

Remove the experimental flag when:

- Feature is fully implemented and tested
- Feature has been used by beta testers without major issues
- Feature is stable enough for general use
- Documentation is complete

To remove the flag:

1. Remove the `{{#if experimentalFeatures}}` wrapper from templates
2. Remove the experimental note from documentation
3. Update CHANGELOG to indicate the feature is now stable
4. Increment minor version (e.g., 1.6.0 → 1.7.0)

### Current Experimental Features

- **Check State Tile** - Complex conditional tile that monitors variables and executes different actions based on conditions

## Feature Development Workflow

**IMPORTANT**: All new features must be developed in a feature branch and start behind the experimental features flag.

### Starting a New Feature

1. **Create a Feature Branch from Main**

   Always branch from `main` to ensure you have the latest stable code:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/feature-name
   ```

2. **Branch Naming Conventions**

   Use prefixes to categorize your work:
   - `feat/` - New features (e.g., `feat/teleport-tile`, `feat/multi-state-switch`)
   - `enhancement/` - Improvements to existing features (e.g., `enhancement/switch-animations`)
   - `fix/` - Bug fixes (e.g., `fix/light-toggle-bug`)
   - `refactor/` - Code refactoring without behavior changes (e.g., `refactor/tile-helpers`)
   - `docs/` - Documentation updates (e.g., `docs/api-reference`)
   - `test/` - Adding or updating tests (e.g., `test/switch-dialog`)

   Use descriptive kebab-case names that clearly indicate what the branch contains.

3. **Put Feature Behind Experimental Flag**

   See the [Experimental Features Policy](#experimental-features-policy) section above for detailed implementation steps. Every new feature MUST:
   - Be hidden behind the `experimentalFeatures` setting
   - Be conditionally rendered in templates using `{{#if experimentalFeatures}}`
   - Be documented as experimental in code comments and commit messages

4. **Development Best Practices**
   - **Make Small, Focused Commits** - Each commit should represent a single logical change
   - **Write Descriptive Commit Messages** - Follow the existing style (see `git log` for examples):
     - Format: `type: description` (e.g., `feat: adds teleport tile`, `fix: resolves switch toggle bug`)
     - Use present tense ("add" not "added")
     - Keep first line under 72 characters
     - Add bullet points for details if needed
   - **Run Tests Frequently** - Use `npm run watch` and test in Foundry as you develop
   - **Lint and Format** - Run `npm run lint` and `npm run format` before committing
   - **Keep CLAUDE.md Updated** - Document new patterns, gotchas, or architectural decisions

5. **Testing Your Feature**

   Before creating a pull request:

   ```bash
   # Run linting and formatting
   npm run lint
   npm run format

   # Build the project
   npm run build

   # Test in Foundry
   # 1. Enable experimental features in module settings
   # 2. Test the new feature thoroughly
   # 3. Test with experimental features disabled to ensure nothing breaks
   # 4. Test existing features to ensure no regressions
   ```

6. **Bump Version Before Creating PR**

   **IMPORTANT**: Version must be bumped as part of your PR, not by the workflow.

   ```bash
   # Determine the version bump type:
   # - patch: Bug fixes, documentation (1.6.1 → 1.6.2)
   # - minor: New features, enhancements (1.6.1 → 1.7.0)
   # - major: Breaking changes (1.6.1 → 2.0.0)

   # Run the release script
   npm run release:patch   # or release:minor or release:major

   # This will:
   # - Update package.json and module.json versions
   # - Generate CHANGELOG.md entry from commit messages
   # - Update build-info.json

   # Commit the version bump
   git add package.json module.json CHANGELOG.md build-info.json
   git commit -m "chore: bump version to X.X.X"

   # Make sure all changes are committed
   git status
   ```

7. **Creating a Pull Request**

   ```bash
   # Push your branch to GitHub
   git push -u origin feat/feature-name
   ```

   Then on GitHub:
   - Create a pull request from your feature branch to `main`
   - Write a clear PR description explaining:
     - What the feature does
     - Why it's needed
     - How to test it
     - Any breaking changes or dependencies
   - Add screenshots or GIFs if the feature has UI changes
   - Mark as "experimental" in the PR title if applicable
   - **Optional**: Add a version label for documentation:
     - `patch` - Bug fixes, documentation
     - `minor` - New features, enhancements
     - `major` - Breaking changes

8. **Pull Request Best Practices**
   - **Keep PRs Focused** - One feature per PR makes review easier
   - **Respond to Feedback** - Address review comments promptly
   - **Update Documentation** - Ensure README.md, CLAUDE.md, and code comments are current
   - **Squash If Needed** - Consider squashing commits if the history is messy

9. **After Merging**

   Once the PR is merged:

   ```bash
   # Switch back to main and pull the latest changes
   git checkout main
   git pull origin main

   # Delete the local feature branch (optional)
   git branch -d feat/feature-name

   # Delete the remote feature branch (optional)
   git push origin --delete feat/feature-name
   ```

### Feature Branch Examples

**Good branch names:**

- `feat/teleport-tile` - Adding a new teleport tile type
- `enhancement/switch-sound-effects` - Improving switch audio options
- `fix/light-color-picker` - Fixing color picker bug in light dialog
- `refactor/tile-creation-logic` - Refactoring tile helper functions
- `docs/handlebars-patterns` - Adding Handlebars documentation

**Bad branch names:**

- `new-stuff` - Too vague
- `john-working` - Not descriptive
- `fix` - What are you fixing?
- `tile` - Which tile? What about it?

### When Features Become Stable

When a feature has been tested and is ready to be promoted from experimental to stable:

1. Remove the `{{#if experimentalFeatures}}` wrapper from templates
2. Update CLAUDE.md to remove it from "Current Experimental Features"
3. Update CHANGELOG to note the feature is now stable
4. Create a PR with these changes
5. After merge, a minor version release will be created automatically (e.g., 1.6.0 → 1.7.0)

## Automated Releases

**IMPORTANT**: Releases are automated via GitHub Actions when PRs are merged to `main`. Version bumps must be done BEFORE creating the PR.

### How It Works

When a pull request is merged into `main`:

1. The `auto-release.yml` workflow automatically triggers
2. It reads the version from `package.json` (which you already bumped)
3. It verifies the version is newer than the last tag
4. The workflow automatically:
   - Builds the project (`npm run build`)
   - Creates a `module.zip` archive
   - Creates a git tag (e.g., `v1.7.0`)
   - Pushes the tag to GitHub
   - Creates a GitHub Release with changelog from CHANGELOG.md
   - Notifies FoundryVTT Package API

**Note**: No commits are pushed to `main` - the version bump is already part of your PR.

### Optional: Repository Labels for Documentation

Labels are **optional** but helpful for documenting what type of change a PR contains:

1. Go to `https://github.com/YOUR-USERNAME/em-tile-utilities/labels`
2. Create these labels if they don't exist:
   - **patch** - Color: `#d4c5f9` (purple) - "Bug fixes and minor improvements"
   - **minor** - Color: `#0e8a16` (green) - "New features and enhancements"
   - **major** - Color: `#d93f0b` (red) - "Breaking changes"

Alternatively, create them via CLI:

```bash
gh label create "patch" --description "Bug fixes and minor improvements" --color "d4c5f9"
gh label create "minor" --description "New features and enhancements" --color "0e8a16"
gh label create "major" --description "Breaking changes" --color "d93f0b"
```

### Adding Labels to PRs (Optional)

Labels don't control the version bump (you do that with `npm run release:X`), but they're useful for documentation:

**On GitHub.com:**

1. Open your pull request
2. On the right sidebar, click "Labels"
3. Select the label that matches your version bump:
   - `patch` if you ran `npm run release:patch`
   - `minor` if you ran `npm run release:minor`
   - `major` if you ran `npm run release:major`

### Version Bump Guidelines

**Use `patch` (1.6.1 → 1.6.2) for:**

- Bug fixes
- Performance improvements
- Documentation updates
- Code cleanup/refactoring
- Minor UI tweaks

**Use `minor` (1.6.1 → 1.7.0) for:**

- New tile types
- New features
- New dialogs or tools
- Promoting experimental features to stable
- Adding new configuration options

**Use `major` (1.6.1 → 2.0.0) for:**

- Breaking API changes
- Removing features
- Foundry version requirement changes
- Major architectural changes
- Changes that require user migration

### Manual Releases

If you need to trigger a release manually (e.g., after merging without auto-release):

1. Ensure the version has been bumped and merged to `main`
2. Go to GitHub Actions in your repository
3. Select "Manual Release" workflow
4. Click "Run workflow" on the `main` branch
5. The workflow will create a release from the current version in `package.json`

**Note**: This only works if the version in `package.json` hasn't been released yet. If the tag already exists, the workflow will fail.

### Changelog Generation

The `scripts/release.js` script automatically generates changelog entries from git commit messages:

- **feat:** commits → "Added" section
- **fix:** commits → "Fixed" section
- **chore:**, **refactor:**, **update:** commits → "Changed" section
- Other commits → "Other" section

This is why descriptive commit messages following the conventional format are important!

### Example Workflow

```bash
# 1. Create feature branch
git checkout main
git pull origin main
git checkout -b feat/teleport-tile

# 2. Develop feature
# ... make changes ...
git add .
git commit -m "feat: adds teleport tile with sound effects"

# 3. Bump version before creating PR
npm run release:minor

# This generates CHANGELOG from commits and updates versions
git add package.json module.json CHANGELOG.md build-info.json
git commit -m "chore: bump version to 1.7.0"

# 4. Push to GitHub
git push -u origin feat/teleport-tile

# 5. Create PR on GitHub (optionally add 'minor' label for documentation)

# 6. After review, merge PR → Auto-release triggers!

# 7. GitHub Actions automatically:
#    - Reads version 1.7.0 from package.json
#    - Builds the project
#    - Creates git tag v1.7.0
#    - Creates GitHub Release with your CHANGELOG
#    - Publishes to Foundry Package API
```

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

### ApplicationV2 Best Practices

**Key Principles:**

1. **Use Private Static Methods for Handlers** - Form submission and action handlers should be private static methods using `#` syntax
2. **Minimize on Placement** - When waiting for canvas click, minimize the dialog so user can see
3. **Clean Up Event Handlers** - Always remove canvas event listeners after use
4. **Restore Parent Dialog** - If dialog was opened from Tile Manager, restore it after creation
5. **Consistent Button Structure** - Use form-footer.hbs with button array for consistency

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
      handler: MyDialog.#onSubmit // Private static method
    },
    actions: {
      actionName: MyDialog.#onActionName // For data-action buttons
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

**Form Footer Pattern:**

Use a reusable footer template for consistent buttons:

```typescript
// In _prepareContext:
return {
  ...context,
  buttons: [
    {
      type: 'submit',
      icon: 'fa-solid fa-check',
      label: 'EMPUZZLES.Create'
    },
    {
      type: 'button',
      action: 'cancel',
      icon: 'fa-solid fa-times',
      label: 'EMPUZZLES.Cancel'
    }
  ]
};
```

```handlebars
{{!-- templates/form-footer.hbs --}}
<footer class="form-footer">
  {{#each buttons as |button|}}
  <button type="{{button.type}}" {{#if button.action}}data-action="{{button.action}}"{{/if}}>
    {{#if button.icon}}<i class="{{button.icon}}"></i>{{/if}}
    {{localize button.label}}
  </button>
  {{/each}}
</footer>
```

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
static async #onSubmit(
  this: SwitchConfigDialog, // Type the 'this' context
  _event: SubmitEvent,
  _form: HTMLFormElement,
  formData: any
): Promise<void> {
  const scene = canvas.scene;
  if (!scene) {
    ui.notifications.error('No active scene!');
    return;
  }

  const data = formData.object;

  // IMPORTANT: Minimize dialog so user can see canvas
  this.minimize();

  ui.notifications.info('Click on the canvas to place the tile...');

  const handler = async (clickEvent: any) => {
    const position = clickEvent.data.getLocalPosition((canvas as any).tiles);
    const snapped = (canvas as any).grid.getSnappedPoint(position, { mode: 2 });

    await createTile(scene, data, snapped.x, snapped.y);

    ui.notifications.info('Tile created!');

    // Clean up: Remove event listener
    (canvas as any).stage.off('click', handler);

    // Close this dialog
    this.close();

    // Restore parent dialog if it exists
    const tileManager = getActiveTileManager();
    if (tileManager) {
      tileManager.maximize();
    }
  };

  (canvas as any).stage.on('click', handler);
}
```

**Key Points:**

- Type `this` in the handler signature for proper context
- Always minimize dialog before canvas placement
- Use `getSnappedPoint` with `{ mode: 2 }` for center snapping
- Clean up event listeners with `.off()` after placement
- Close dialog and restore parent (Tile Manager) after creation

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
    fit: 'fill',
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    tint: '#ffffff',
    alphaThreshold: 0.75
  },
  width: gridSize,
  height: gridSize,
  x: tileX,
  y: tileY,
  elevation: 0,
  sort: 0, // Z-order for rendering
  occlusion: { mode: 0, alpha: 0 },
  rotation: 0,
  alpha: 1,
  hidden: false,
  locked: false,
  restrictions: { light: false, weather: false },
  video: { loop: true, autoplay: true, volume: 0 },
  flags: {
    'monks-active-tiles': {
      /* ... */
    }
  },
  visible: true,
  img: imagePath
};

await scene.createEmbeddedDocuments('Tile', [tileData]);
```

### Grid Sizing

```typescript
const gridSize = (canvas as any).grid.size; // 1 grid square
const largeSize = gridSize * 2; // 2x2 grid squares
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
    color: '#ffffff', // null for no color
    dim: 40, // Dim light radius
    bright: 20, // Bright light radius
    alpha: 0.5, // Color intensity
    negative: false,
    priority: 0,
    coloration: 1,
    attenuation: 0.5,
    luminosity: 0.5,
    saturation: 0,
    contrast: 0,
    shadows: 0,
    animation: { type: null, speed: 5, intensity: 5, reverse: false },
    darkness: { min: 0, max: 1 } // Darkness range for activation
  },
  hidden: false
};

const [light] = await scene.createEmbeddedDocuments('AmbientLight', [lightData]);
const lightId = (light as any).id;
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
<div class='form-group'>
  <label for='imagePath'>{{localize 'EMPUZZLES.Image'}}</label>
  <div class='file-picker-group'>
    <input type='text' name='imagePath' value='{{imagePath}}' />
    <button type='button' class='file-picker' data-target='imagePath' data-type='imagevideo'>
      <i class='fas fa-file-image'></i>
    </button>
  </div>
</div>
```

### Conditional Content

```handlebars
{{#if hasTiles}}
  <div class='tile-list'>
    {{#each tiles as |tile|}}
      <div class='tile-entry' data-tile-id='{{tile.id}}'>
        {{#if tile.image}}
          <img src='{{tile.image}}' class='tile-thumbnail' alt='' />
        {{else}}
          <img
            src='icons/svg/hazard.svg'
            class='tile-thumbnail tile-thumbnail-placeholder'
            alt=''
          />
        {{/if}}
        <span>{{tile.name}}</span>
      </div>
    {{/each}}
  </div>
{{else}}
  <p class='no-content'>{{localize 'EMPUZZLES.NoTiles'}}</p>
{{/if}}
```

### Action Buttons (ApplicationV2)

```handlebars
<button type='button' data-action='actionName' data-tile-id='{{tile.id}}'>
  <i class='fas fa-icon'></i>
  {{localize 'EMPUZZLES.ButtonLabel'}}
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
  scope: 'world', // 'world' or 'client'
  config: true, // Show in module settings UI
  type: String, // String, Number, Boolean
  default: 'default value',
  filePicker: 'imagevideo', // Optional: adds file picker button
  requiresReload: true // Optional: prompts user to reload when changed
});
```

**Important Options:**

- `requiresReload: true` - When set, Foundry will automatically show a dialog asking the user to reload when the setting is changed. Use this for settings that affect UI rendering, feature visibility, or other aspects that require a fresh initialization.

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
    order: 1000 // Higher = appears later in toolbar
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
tile.id;
tile.name;
tile.texture.src;
(tile.x, tile.y);
(tile.width, tile.height);
tile.elevation;
tile.sort;
tile.hidden;
tile.locked;
tile.flags['monks-active-tiles'];

// Monks data
const monksData = tile.flags['monks-active-tiles'];
monksData.active;
monksData.actions;
monksData.variables;
monksData.files;
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

## Style and Best Practices

- When you make changes to the module, please run `npm run lint` and `npm run format` to check for style and best practices. Change any issues that are reported.
- When you create a new file, add it to the VSC.
- Add JSDoc comments to all public methods and properties.

### Linting Best Practices

**Always run linting before committing:**

```bash
npm run lint        # Check for issues
npm run lint -- --fix  # Auto-fix issues
npm run format      # Format code with Prettier
```

**Common Linting Issues and Fixes:**

1. **Import Formatting** - Keep imports on one line when possible:

   ```typescript
   // Good
   import type { SwitchConfig, LightConfig, TrapConfig } from '../types/module';

   // Bad (triggers prettier/prettier warning)
   import type { SwitchConfig, LightConfig, TrapConfig } from '../types/module';
   ```

2. **Return Type Formatting** - Multi-line object return types:

   ```typescript
   // Good
   protected _validateFields(form: HTMLFormElement): {
     valid: boolean;
     message?: string;
   } {
     // ...
   }

   // Bad (triggers prettier/prettier warning)
   protected _validateFields(form: HTMLFormElement): { valid: boolean; message?: string } {
     // ...
   }
   ```

3. **Long String Selectors** - Break onto multiple lines:

   ```typescript
   // Good
   const element = this.element.querySelector(
     '[data-action="selectPosition"]'
   ) as HTMLButtonElement;

   // Bad (triggers prettier/prettier warning)
   const element = this.element.querySelector(
     '[data-action="selectPosition"]'
   ) as HTMLButtonElement;
   ```

4. **Function Parameters** - Keep short, break if long:

   ```typescript
   // Good (short)
   async _onSubmit(_event: SubmitEvent, form: HTMLFormElement, _formData: any): Promise<void> {

   // Good (long - use multi-line)
   async _onSubmit(
     _event: SubmitEvent,
     form: HTMLFormElement,
     _formData: any
   ): Promise<void> {
   ```

5. **Unused Parameters** - Prefix with underscore:

   ```typescript
   // Good
   const handler = (_clickEvent: any) => {
     // Not using clickEvent
   };

   // Bad (triggers @typescript-eslint/no-unused-vars)
   const handler = (clickEvent: any) => {
     // Not using clickEvent
   };
   ```

6. **Union Types** - Multi-line for readability:

   ```typescript
   // Good
   target:
     | Element
     | HTMLInputElement
     | HTMLSelectElement;

   // Bad (triggers prettier/prettier warning)
   target: Element | HTMLInputElement | HTMLSelectElement;
   ```

7. **Grid Position Calculations** - Break long method calls:

   ```typescript
   // Good
   const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);

   // Bad (triggers prettier/prettier warning)
   const snapped = (canvas as any).grid.getSnappedPosition(position.x, position.y);
   ```

**Template HTML Validation:**

- The Handlebars linter may warn about `<div>` elements in certain contexts - these are usually safe to ignore if the template renders correctly
- Always include `alt` attributes for `<img>` tags (use `alt=""` for decorative images)
- For placeholder images like `icons/svg/hazard.svg`, these come from Foundry core and don't need path validation

**Auto-Fix Workflow:**

```bash
# Make changes
npm run lint -- --fix  # Auto-fix most issues
npm run build          # Verify build succeeds
# Manually fix remaining warnings
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
