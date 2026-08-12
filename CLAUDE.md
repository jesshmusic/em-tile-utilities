# CLAUDE.md — developer reference

Technical notes for working on Dorman Lakely's Tile Utilities. **README.md is the user-facing doc** (benefits, no jargon); this file is implementation detail. [TESTING.md](TESTING.md) covers the test suite, [GITHUB_SETUP.md](GITHUB_SETUP.md) covers CI and releases.

## Project overview

A **FoundryVTT v14** module (v14-only — `module.json` declares `compatibility.minimum: "14"`) that provides point-and-click dialogs for building interactive tiles and regions on top of Monk's Active Tiles. TypeScript, ApplicationV2, bundled by Vite into a single IIFE.

| Dependency                | Role                                   | Floor |
| ------------------------- | -------------------------------------- | ----- |
| FoundryVTT                | required                               | 14    |
| Monk's Active Tiles       | required                               | 14.01 |
| Tagger                    | required                               | 1.6.0 |
| Monk's Token Bar          | suggested — saving throws              | 14.01 |
| Enhanced Region Behaviors | suggested — trap and elevation regions | 1.5.0 |

There is deliberately **no `relationships.systems` entry**. Foundry's `_testSupportedSystems` marks a package unavailable when none of its declared systems is installed, so declaring dnd5e would lock the module out entirely for non-dnd5e worlds — including the switch, light, reset, teleport and check-state tools, which are system-agnostic. dnd5e-specific code sits behind `isDnd5eSystem()` instead.

## Commands

```bash
npm run build       # vite build → dist/main.js. Does NOT type check.
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit. This is the only thing that type checks.
npm run lint        # eslint src/ tests/ scripts/, --max-warnings 0
npm run lint:fix
npm run format      # prettier --write over src, tests, **/*.json, **/*.md
npm run format:check
npm test            # jest — 993 tests, 28 suites
npm run test:coverage
npm run release:patch|minor|major
```

CI runs `typecheck → lint → format:check → build` plus the suite on Node 22.x and 24.x, and blocks any PR that does not bump the version. Run all four locally before pushing; `npm run build` alone proves nothing.

## Architecture

```
src/
├── main.ts                      # init/ready hooks, settings, toolbar, teleport-pair cleanup
├── dialogs/                     # 9 ApplicationV2 dialogs + 2 support modules
│   ├── switch-dialog.ts             SwitchConfigDialog
│   ├── light-dialog.ts              LightConfigDialog
│   ├── trap-dialog.ts               TrapDialog          (largest file, ~2.7k lines)
│   ├── teleport-dialog.ts           TeleportDialog
│   ├── reset-dialog.ts              ResetTileConfigDialog
│   ├── elevation-dialog.ts          ElevationDialog     (region-only)
│   ├── check-state-dialog.ts        CheckStateDialog    (experimental)
│   ├── tile-manager.ts              TileManagerDialog
│   ├── tile-manager-state.ts        shared open-dialog handle
│   ├── variables-viewer.ts          SceneVariablesViewer
│   └── notify.ts                    the ONLY module allowed to call ui.notifications
├── settings/settings-menus.ts   # Patreon / DM Guru settings-menu entries
├── types/{module.ts,foundry.d.ts,dialog-positions.ts}
└── utils/
    ├── helpers/     # naming, tag, grid, folder, module-checks, rollback, tile-preview, dnd5e-activity
    ├── actions/     # 21 Monk's Active Tiles action builders across 7 modules
    ├── builders/    # base-tile, base-region, monks-config, entity, region-behavior
    └── creators/    # 7 tile creators + 3 region creators
```

Four layers, bottom-up: **helpers** (pure utilities) → **actions** (typed Monk's Active Tiles action objects) → **builders** (document data and flag envelopes) → **creators** (the whole create-a-thing flow). Dialogs collect input and call a creator; creators are where the behaviour actually lives, and where the tests are.

Creators exported from `utils/creators/index.ts`: `createSwitchTile`, `createLightTile`, `createResetTile`, `createTeleportTile`, `createTrapTile`, `createCombatTrapTile`, `createCheckStateTile`, `createTrapRegion`, `createTeleportRegion`, `createElevationRegion`. All are `async` and create documents on the scene; they do not return the document.

Shared creator utilities (use these rather than re-inlining):

- `applyEMTags()` (`helpers/tag-helpers.ts`) — the Tagger epilogue: active-module guard, `globalThis.Tagger` lookup, custom-tag parsing, optional warning. Regions add `EM_Region`, trap regions add `EM_Trap`, teleport destinations take a `_Dest` suffix.
- `resolveTargetEntity()` (`builders/entity-builders.ts`) — the trap target-type switch. Do not hand-roll it; the copy that was missing the `PLAYER_TOKENS` case shipped a bug for months.
- `requireEnhancedRegionBehaviors()` (`helpers/module-checks.ts`) — ERB guard with a user-facing error.
- `createRollbackTracker()` (`helpers/rollback-helpers.ts`) — records created documents so a later failure can unwind them. Note the deliberate asymmetry: `createLightTile` throws (the dialog guards the call), `createCombatTrapTile` returns null (it does not).

## Build system

Vite library mode → one IIFE at `dist/main.js`, source maps with inline sources, `emptyOutDir` on. A custom plugin increments `build-info.json`, which is **untracked and generated**; `src/` reads `__MODULE_VERSION__` and `__BUILD_NUMBER__` from Vite `define` constants (declared in `env.d.ts`, mirrored into `jest.config.js` globals) rather than importing `package.json`. A fresh clone with no `build-info.json` must still pass typecheck, tests and build.

`.prettierignore` excludes `module.json` and `CHANGELOG.md` because `scripts/release.js` rewrites both with its own formatting. Match the existing CHANGELOG style by hand.

## Foundry v14

Verified against 14.364. `loadTemplates`, `renderTemplate`, `FilePicker`, `SearchFilter`, `ContextMenu` and `TextEditor` still resolve as flat globals, but only through `addBackwardsCompatibilityReferences` getters marked _"since 13, until 15"_ — every access logs a deprecation and they stop working in v15. `AudioHelper` is already gone. The module uses none of them.

| Removed / deprecated global | Use instead                                      |
| --------------------------- | ------------------------------------------------ |
| `loadTemplates`             | `foundry.applications.handlebars.loadTemplates`  |
| `renderTemplate`            | `foundry.applications.handlebars.renderTemplate` |
| `FilePicker`                | `foundry.applications.apps.FilePicker`           |
| `AudioHelper` (gone)        | `foundry.audio.AudioHelper`                      |
| `Dialog`                    | `foundry.applications.api.DialogV2`              |

`src/types/foundry.d.ts` deliberately **does not declare** the removed globals, so reintroducing one fails `npm run typecheck` instead of failing at runtime. `tests/mocks/foundry.ts` mirrors this — it mocks the v14 namespaces only.

Two more v14 details: `SceneControlTool` fires `onChange`, not `onClick`, for `button: true` tools; and ApplicationV2's root element carries the class `.application`, not ApplicationV1's `.window-app`, which is what CSS must target.

`loadTemplates`'s `Record<partialId, path>` form both preloads and registers each named partial (it calls `getTemplate` → `Handlebars.registerPartial`), so there is no need for manual `fetch()` + `registerPartial()` — and a route-relative `fetch` breaks under a Foundry route prefix anyway. Partials are registered in `init`, not `ready`; `tests/integration/partial-registration.test.ts` enforces that.

## ApplicationV2 dialog pattern

```typescript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MyDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'unique-id',
    classes: ['my-dialog', 'em-puzzles'],
    window: { contentClasses: ['standard-form'], icon: 'gi-icon', title: 'EMPUZZLES.Title' },
    position: { width: 480 },
    form: { closeOnSubmit: true, handler: MyDialog.#onSubmit },
    actions: { cancel: MyDialog.#onCancel }
  };

  static PARTS = {
    form: { template: 'modules/em-tile-utilities/templates/my-dialog.hbs', root: true },
    footer: { template: 'modules/em-tile-utilities/templates/form-footer.hbs' }
  };

  async _prepareContext(options: any): Promise<any> {
    const context = await super._prepareContext(options);
    return { ...context, myData: 'value' };
  }

  _onRender(context: any, options: any): void {
    super._onRender(context, options);
    // DOM listeners, file pickers
  }

  _onClose(options: any): void {
    super._onClose(options);
    // cleanup — hooks off, previews destroyed
  }
}
```

**Never wire `_onClose` as a button action.** It is the ApplicationV2 close lifecycle callback; wiring it to Cancel as well makes it call `this.close()` re-entrantly and never reach `super`. Cancel gets its own `_onCancel(event, target)` which calls `this.close()`; `_onClose(options)` does the cleanup and runs on every close path. All eight affected dialogs were split this way in v2.2.0 — do not merge them back.

File pickers resolve through the v14 namespace; there is no `globalThis.FilePicker` fallback any more:

```typescript
const FilePickerClass = foundry.applications.apps.FilePicker;
const fp = new FilePickerClass({ type, current: input.value, callback: (path: string) => { … } });
return fp.browse();
```

## Monk's Active Tiles integration

Verified against MATT 14.01. The flag envelope:

```typescript
flags: {
  'monks-active-tiles': {
    name, active, record, restriction, controlled, trigger: ['dblclick'],
    allowpaused, pointer, vision, minrequired, cooldown, chance,
    fileindex,        // 0-based index into files[]
    actions: [],      // each { action, data, id: foundry.utils.randomID() }
    files: [],
    variables: {}
  }
}
```

Property names inside `data` are **lowercase** (`minrequired`, `allowpaused`, `rollattack`); the builders handle this.

Entity references:

| Target               | `data.entity`                                    |
| -------------------- | ------------------------------------------------ |
| Running tile         | `{ id: 'tile', name: 'This Tile' }`              |
| Another tile         | `{ id: 'Scene.<sceneId>.Tile.<tileId>' }`        |
| Light / wall / token | `Scene.<sceneId>.{AmbientLight,Wall,Token}.<id>` |
| Triggering token     | `{ id: 'token', name: 'Triggering Token' }`      |

### Hard-won rules — every one of these was a shipped bug

1. **`{ id: 'tile' }` means the tile _running_ the action**, not the tile you are configuring. `createSetVariableAction` defaults to it, which is right for switches and combat traps (they set their own variables) and catastrophically wrong for the Reset tile, which must pass `Scene.<sceneId>.Tile.<tileId>` for each target.
2. **Clearing a variable uses MATT's `_null` sentinel**, emitted as `'"_null"'`. `setvariable.fn` compares against it and calls `unsetFlag`. The literal string `"null"` gets eval'd into a live value and clears nothing.
3. **`tileimage.select` is 1-based** for numeric values (`Math.clamp(position, 1, images.length)`, with `"first"` mapping to 1) while `fileindex` is 0-based. Converting between them is a real off-by-one, not a style choice.
4. **Only Foundry's own Handlebars helpers exist** when MATT compiles an action value: `eq/ne/lt/gt/lte/gte/not/and/or`, plus MATT's `selectGroups` and dnd5e's `getProperty`. `{{default …}}` and `{{add …}}` are not registered, and `helperMissing` _throws_ when an unknown helper is called with arguments. Counters are `setvariable` with `'+ 1'` and a compare-mode value like `'> 3'`.
5. **`checkvariable.data.type` accepts only `all | any | none`.** It is not a comparison operator. Comparison lives inside `data.value`, which `getValue` evaluates in compare mode. Keep numeric operands unquoted so they compare numerically rather than lexicographically.
6. **`hurtheal` values must be plain formulas** (`-3d6`), never inline-roll syntax (`-[[3d6]]`). The bracketed form routes through `inlineRoll → doRoll → ChatMessage#applyMode`, which throws inside midi-qol's `ChatMessageMidi` on v14 — after the roll posts to chat and before `applyDamage`, so the damage silently never lands. Still true, and still the path non-dnd5e worlds take — but on dnd5e the creators now emit `em-tile-utilities.applydamage` instead (see below).
7. **Roll requests are namespaced.** Monk's Token Bar resolves `save:` / `ability:` / `skill:` / `misc:` against its per-system request options, and `findBestRequest` reaches `ability` before `save`. A saving throw is `save:dex`; `ability:dex` and a bare `dex` both produce an ability check.
8. **dnd5e attack actions need `rollattack: 'true'`.** MATT 14.01 gives dnd5e a dedicated branch where only that value resolves a callable; the other path exists for other systems and falls through to bare targeting with no roll.
9. **`GRID_SNAPPING_MODES` is a bit field, not an enum** (`CENTER 0x1`, `EDGE_MIDPOINT 0x2`, `TOP_LEFT_VERTEX 0x10`). Document `x`/`y` are top-left, so tile and region placement snaps to `TOP_LEFT_VERTEX`. The mode-1 calls in `trap-dialog` are correct and intentional: those points feed MATT teleport/movetoken, which treats a location as a centre.

### Custom MATT action: `em-tile-utilities.applydamage`

`src/utils/actions/apply-damage-tile-action.ts` registers one custom action so tile-trap damage behaves like region-trap damage: typed, and routed through whatever automation the GM already runs. Prefer registering an action over generating code strings — the logic stays in typed, testable module code instead of `escapeJsString` codegen.

- **Registration hook.** `MonksActiveTiles.registerTileAction(namespace, name, action)` (monks-active-tiles.js:3391) is driven by the `setupTileActions` hook MATT calls from its own `init` (monks-active-tiles.js:2368). Because MATT is a declared dependency, Foundry registers its `init` handler first — so the listener must be attached at **script-evaluation** time, not inside our `init`. `registerEmTileActions()` is called at the top level of `main.ts` for exactly that reason, and swallows every failure so it can never abort the settings registration below it.
- **Group first.** `registerTileAction` defaults `action.group` to the namespace and silently refuses any group not already in `triggerGroups`. Call `registerTileGroup` first and fall back to MATT's built-in `'actions'` group if it is missing or did not take.
- **`values` vs `list`.** `getListFieldData` (apps/action-config.js:601) keys an object list by its own property names, but keys an _array_ by `g.id ?? g`. A `{ value, label }` array renders as `[object Object]`; hand MATT a `Record<id, label>` instead. `ctrl.list` may be a function, which MATT calls lazily at render time — that is how the damage type list reads a `CONFIG.DND5E` that does not exist yet during `init`.
- **`name` is a key, `help` is not.** Action and ctrl names go through `i18n()` / `{{localize name}}`; `help` is rendered raw (`{{{help}}}`) and read as a plain property, so localize it in a getter rather than eagerly at registration.
- **Sign convention.** `hurtheal` wants damage negative and flips it internally (`val = val * -1`). `applydamage` takes both damage and healing as positive formulas and distinguishes them by damage type — `healing` is a real dnd5e type whose sign `Actor5e#calculateDamage` inverts.
- **Application chain**, mirroring Enhanced Region Behaviors exactly: midi-qol → `MidiQOL.applyTokenDamage(detail, total, targets, item, saves, { forceApply })` with `forceApply` read from the GM's own `autoApplyDamage` setting rather than overridden; no midi → `actor.applyDamage([{ value, type, properties: new Set() }])`; non-dnd5e → the bare-number form. `properties` must be a real `Set` — dnd5e calls `Set#intersection` on it for physical damage types.
- **Old tiles keep working.** Existing tiles carry `hurtheal`, MATT's own action is untouched, and nothing rewrites saved tiles. The change affects newly created tiles only.

## dnd5e integration

All of it lives in `src/utils/helpers/dnd5e-activity.ts`, behind `isDnd5eSystem()`, with source citations inline. Verified against dnd5e 5.3.3:

- `activity.save.ability` is a **`SetField`** — index access (`[0]`) is always `undefined`. That bug made every DMG trap import silently fall back to Dexterity.
- `save.dc.formula` is populated only for a manually entered flat DC; for `calculation: 'spellcasting'` it is blank. Read `save.dc.value`, which `BaseSaveActivityData#prepareFinalData` computes.
- Damage comes from `DamageData#formula`, which already resolves custom-vs-automatic and includes the bonus.
- Use `ActivityCollection#getByType` to find activities. Iterating a Map subclass with `for..in` or `Object.values` yields nothing.
- Filter to save activities deliberately — only they carry `save.ability`, `save.dc` and `damage.onSave`.
- Damage type names come from `CONFIG.DND5E.damageTypes` (already localized) with an SRD fallback for other systems.
- **Damage bypass properties are not their own config list.** They are the `CONFIG.DND5E.itemProperties` entries flagged `isPhysical` — `ada` (dnd5e.mjs:45403), `mgc` (dnd5e.mjs:45823), `sil` (dnd5e.mjs:45841). dnd5e derives them the same way in three places (dnd5e.mjs:54124, 75009, 12582); `src/utils/helpers/damage-properties.ts` copies that. Beware the key name: `isPhysical` on `damageTypes` means physical damage TYPE (bludgeoning/piercing/slashing), not bypass.
- **`properties` must be a real `Set` and cannot be persisted as one.** dnd5e reads `damage.properties?.size` and calls `bypasses.intersection(...)` (dnd5e.mjs:36926-36928, 36828-36833); midi-qol does the same (midi-qol.js:14012, 14026-14059). MATT stores action data as plain JSON, where a `Set` serializes to `{}` — so the tile flags hold an ARRAY and the `Set` is rebuilt in the action `fn`. Both halves live in `damage-properties.ts`.
- **`temphp` and `maximum` live in `CONFIG.DND5E.healingTypes`, not `damageTypes`** (dnd5e.mjs:45870-45890, shape `{ label, labelShort, icon, color }`). `calculateDamage` branches on them by id (dnd5e.mjs:36859-36864): `temphp` becomes `damages.temp`, `maximum` becomes `damages.tempMax`. Neither is sign-inverted by default — only `healing` is, and `maximum` only when `treatAs === "healing"` (dnd5e.mjs:36850-36855) — so both keep this module's positive-value convention.
- **Exhaustion is an actor field, not an effect.** `toggleStatusEffect` can only ever produce level 1. Write `system.attributes.exhaustion`; `Actor5e#_onUpdateExhaustion` (dnd5e.mjs:39498-39511) creates, re-levels or deletes the effect in response. The max is `CONFIG.DND5E.conditionTypes.exhaustion.levels` (6 under the 2024 rules, dnd5e.mjs:47205); the schema field has **no maximum** (dnd5e.mjs:25837-25839), so clamp it yourself as dnd5e does (dnd5e.mjs:25321).
- **Timed conditions:** `ActiveEffect.implementation.fromStatusEffect(id)` → `updateSource({ duration })` → `create(effect, { parent, keepId: true })`, the shape from `_onToggleCondition` (dnd5e.mjs:51286-51291). `keepId` is mandatory — condition ids are deterministic `staticID`s and every "already applied?" lookup depends on it. Duration units follow `DurationField.getEffectDuration` (dnd5e.mjs:11264-11276): rounds/turns for combat-relative, seconds for minute-and-up. Never both — a minute is 60 seconds, not 10 rounds, and the difference is whether it expires out of combat.

## Localization

`lang/en.json`, everything under the `EMPUZZLES` namespace. **`src/dialogs/notify.ts` is the only module permitted to call `ui.notifications`** — use `notifyInfo` / `notifyWarn` / `notifyError`, which localize a key or format it when given data (so keys containing literal braces survive). Settings names and hints, validation messages and dialog prompts are keys too.

`tests/localization.test.ts` enforces this: no bare literal reaching `ui.notifications` in the migrated files, no direct `ui.notifications` outside `notify.ts`, every referenced key defined, no orphaned keys, no empty values. The migrated-file allow-list is explicit and commented — `src/utils/{creators,helpers,builders,actions}` still carry raw literals and are excluded pending a follow-up pass; extend the list when you migrate them.

Long help text belongs in a template (`templates/variables-help.hbs`), not in one giant key holding HTML. Translators should not be handed markup they can break.

## Experimental features

New features start behind the `experimentalFeatures` world setting (`requiresReload: true`). Gate the Tile Manager card with `{{#if experimentalFeatures}}`, pass the flag through `_prepareContext`, and remove the wrapper only once the feature is complete, tested and documented — that removal is a minor version bump. **Currently experimental:** the Check State tile.

## Workflow

Branch from `main` with a `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` or `test/` prefix and a kebab-case description. Conventional commit messages, present tense, first line under 72 characters.

**Every PR must bump the version.** `npm run release:patch|minor|major` updates `package.json` and `module.json` together; CI's `version-bump` job compares against the base branch with a real semver comparison and fails on an unchanged or lowered version, or on the two manifests disagreeing. On merge, `auto-release.yml` tags, zips, publishes the GitHub release and notifies the FoundryVTT package API with the compatibility range read out of `module.json`.

Do **not** put AI attribution in PR titles or descriptions.

## Gotchas

1. `(foundry as any)` / `(canvas as any)` — the ambient types are incomplete by design.
2. Action IDs must be unique: `foundry.utils.randomID()` on every action object.
3. Scene variables always use `scope: 'scene'`.
4. Light position is centred: add `gridSize / 2` to the tile's `x`/`y`.
5. `TileDocument.occlusion` is `modes` (a `SetField`) in v14, and `0` is no longer a valid choice — "no occlusion" is an empty set. `createBaseTileData` emits `{ modes: [], alpha: 0 }`.
6. Tile placement needs a canvas click handler set up in the submit handler; minimize the dialog first so the user can see the map, and restore the Tile Manager afterwards.
7. Inside `{{#each items as |item|}}`, `item` is a **block parameter** — lexically scoped and reachable at any depth. `{{../item.id}}` walks up a context frame looking for a _property_ named `item`, finds nothing, and renders empty.
8. Reference code as `path/to/file.ts:123` so it is clickable.

Always run the suite before finishing, and add tests for new behaviour — assert on the emitted action data, not on dialog state.
