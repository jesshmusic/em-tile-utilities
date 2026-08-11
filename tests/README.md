# Test suite

Reference for the mocks and helpers in this directory. For what the suite covers, current counts and coverage numbers, see [`../TESTING.md`](../TESTING.md).

```
tests/
├── setup.ts                  # Jest setupFilesAfterEnv: calls mockFoundry(), clears mocks between tests
├── mocks/foundry.ts          # Foundry v14 globals
├── helpers/template-helper.ts# Compile and render .hbs files off disk
├── dialogs/                  # 11 suites — one per dialog, plus notify and switch tags
├── utils/                    # 9 suites — creators, builders, helpers, dnd5e parsing, previews
├── integration/              # 4 suites — real template rendering
├── localization.test.ts      # lang/en.json contract
└── main.test.ts              # hooks, settings, toolbar
```

## `mocks/foundry.ts`

`mockFoundry()` installs the globals the module touches. `tests/setup.ts` already calls it in a `beforeAll`, but suites that import a dialog at module scope call it again at the top of the file, **before** the import — dialog classes read `foundry.applications.api` at class-definition time, so an import that lands first sees an undefined global.

What it provides:

- `foundry.utils.randomID`
- `foundry.applications.api` — `ApplicationV2` (a minimal stub with `render`/`close`/`_prepareContext`/`_onRender`/`_onClose`), `HandlebarsApplicationMixin`, `DialogV2`
- `foundry.applications.apps.FilePicker`, `foundry.applications.handlebars.{loadTemplates,renderTemplate,getTemplate}`, `foundry.audio.AudioHelper` — the v14 homes for globals that were removed or deprecated. The old flat globals are **not** mocked, deliberately: reintroducing one should fail a test rather than silently resolve.
- `game` — modules (Monk's Active Tiles, Monk's Token Bar, Tagger and Enhanced Region Behaviors all report active), settings with the real registered defaults, scenes, and an `i18n` that resolves against the **real `lang/en.json`**. A missing localization key therefore fails a test instead of rendering a raw key name.
- `canvas`, `ui.notifications`, `Hooks`

Factories:

| Function                       | Returns                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `createMockScene(id?, tiles?)` | A Scene with `tiles`/`lights` collections and jest-mocked `createEmbeddedDocuments`, `setFlag`, etc. |
| `createMockTile(overrides?)`   | A TileDocument with sensible defaults                                                                |
| `createMockLight(overrides?)`  | An AmbientLightDocument                                                                              |

Assign the scene to `(global as any).canvas.scene` when the code under test reads the active scene rather than taking one as an argument.

## `helpers/template-helper.ts`

| Function                                    | Purpose                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `loadTemplate(path)`                        | Read a `.hbs` from disk, resolving `modules/<id>/…` paths            |
| `compileTemplate(source)`                   | Handlebars compile                                                   |
| `registerHandlebarsHelpers()`               | The Foundry helpers templates use (`localize`, `eq`, `and`, …)       |
| `registerHandlebarsPartials()`              | The three shared partials in `templates/partials/`                   |
| `renderTemplate(path, context)`             | Render a template with an explicit context                           |
| `renderDialogTemplate(DialogClass, extra?)` | Instantiate the dialog, run `_prepareContext()`, render `PARTS.form` |
| `htmlContainsSelector(html, selector)`      | Cheap selector presence check                                        |
| `getSelectOptionValues(html, name)`         | Option values from a `<select>`                                      |
| `getSelectOptionLabels(html, name)`         | Option labels from a `<select>`                                      |

`renderDialogTemplate` is the one that earns its keep: it goes through the dialog's own context preparation, so a mismatch between what the dialog computes and what the template expects shows up as wrong HTML rather than passing silently.

## Conventions

- Mock before import (see above).
- Assert on the emitted Monk's Active Tiles action data, not on dialog instance state. A dialog remembering a value proves nothing about whether Monk's Active Tiles can execute it.
- Keep suites independent; `setup.ts` clears mocks after each test, but scene fixtures are yours to rebuild in `beforeEach`.
- New localization keys need no test change — `localization.test.ts` picks them up automatically and will fail if a key is referenced but undefined, or defined but unreferenced.

## Debugging

```bash
node --inspect-brk node_modules/.bin/jest --runInBand   # then open chrome://inspect
npm test -- --verbose reset-dialog                       # one suite, per-test output
```

VS Code launch config:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```
