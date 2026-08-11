# Testing

Jest + ts-jest, `node` test environment, no Foundry runtime — every Foundry global is mocked in `tests/mocks/foundry.ts`. The whole suite runs in about five seconds.

**As of v2.2.0: 993 tests across 28 suites, all passing.**

```bash
npm test                 # run everything
npm run test:watch       # watch mode
npm run test:coverage    # coverage report in coverage/
npm run test:ci          # what CI runs (coverage + --ci + --maxWorkers=2)
npm test -- tests/utils  # a single directory
npm test -- reset-dialog # a single suite by name fragment
```

## Layout

| Suite                                                    | Tests | What it covers                                                            |
| -------------------------------------------------------- | ----: | ------------------------------------------------------------------------- |
| `tests/main.test.ts`                                     |    30 | Init/ready hooks, settings registration, toolbar, teleport-pair cleanup   |
| `tests/localization.test.ts`                             |     6 | The `lang/en.json` contract (see below)                                   |
| `tests/dialogs/tile-manager.test.ts`                     |   106 | Listing, sorting, grouping, search, import/export                         |
| `tests/dialogs/reset-dialog.test.ts`                     |    84 | Target selection, per-tile state capture, form round-trip                 |
| `tests/dialogs/teleport-dialog.test.ts`                  |    53 | Same-scene and cross-scene config, return teleports, saves                |
| `tests/dialogs/light-dialog.test.ts`                     |    52 | Light properties, darkness triggers, overlay and sound                    |
| `tests/dialogs/trap-dialog.test.ts`                      |    43 | Result types, saving throws, DMG trap import                              |
| `tests/dialogs/elevation-dialog.test.ts`                 |    41 | Elevation region config                                                   |
| `tests/dialogs/check-state-dialog.test.ts`               |    32 | Conditions, operators, branch actions                                     |
| `tests/dialogs/switch-dialog.test.ts`                    |    32 | Defaults, name/variable generation, submission                            |
| `tests/dialogs/variables-viewer.test.ts`                 |    26 | Variable extraction and grouping                                          |
| `tests/dialogs/notify.test.ts`                           |    12 | The localize-vs-format branch in `notify.ts`                              |
| `tests/dialogs/switch-dialog-tags.test.ts`               |    11 | Custom tag entry                                                          |
| `tests/utils/creators.test.ts`                           |   164 | The tile and region creators                                              |
| `tests/utils/region-creators.test.ts`                    |    62 | Trap, teleport and elevation region creators                              |
| `tests/utils/tile-preview-helper.test.ts`                |    48 | Ghost preview and drag-to-place lifecycle                                 |
| `tests/utils/builders.test.ts`                           |    43 | Tile/region data and Monk's config builders                               |
| `tests/utils/dnd5e-activity.test.ts`                     |    33 | dnd5e 5.3.x activity parsing (save ability, DC, damage)                   |
| `tests/utils/tag-input-manager.test.ts`                  |    26 | Tag input widget, including keyboard-operable remove buttons              |
| `tests/utils/tag-helpers.test.ts`                        |    13 | Tag generation and uniqueness                                             |
| `tests/utils/active-effect-trap.test.ts`                 |    11 | Status-effect trap actions                                                |
| `tests/utils/helpers.test.ts`                            |    10 | Naming, grid and folder helpers                                           |
| `tests/integration/trap-dialog-rendering.test.ts`        |    21 | Renders the real `.hbs` and asserts on the produced HTML                  |
| `tests/integration/dialog-rendering-integration.test.ts` |    10 | Same, across the other dialogs                                            |
| `tests/integration/partial-registration.test.ts`         |     6 | Partials are registered in `init`, not `ready`                            |
| `tests/integration/reset-dialog-rendering.test.ts`       |     5 | Reset dialog control names carry the target tile id                       |
| `tests/integration/template-accessibility.test.ts`       |     6 | Accessible names, `label[for]` targets and unique ids across 11 renders   |
| `tests/styles.test.ts`                                   |     7 | Stylesheet scoping: no global `:valid`, no `!important` on Foundry chrome |

Support files: `tests/mocks/foundry.ts` (Foundry globals), `tests/helpers/template-helper.ts` (compile and render `.hbs` off disk), `tests/setup.ts`.

## The three kinds of test here

**Unit tests** (`tests/utils/`, `tests/dialogs/`) mock Foundry, call a creator or a dialog method, and assert on the object that comes back — most usefully on the Monk's Active Tiles action array, since that _is_ the behaviour the module ships.

**Integration tests** (`tests/integration/`) compile the actual Handlebars templates and assert against rendered HTML. They exist because a template can go wrong in ways no unit test sees. Two real examples:

- A result-type dropdown built from a string literal instead of the `TrapResultType` enum rendered a value the dialog's own conditionals never matched.
- The reset dialog named every per-tile control after an empty string, because `{{../tile.tileId}}` inside `{{#each tiles as |tile|}}` walks up a context frame looking for a _property_ named `tile` rather than using the block parameter. All five assertions in `reset-dialog-rendering.test.ts` fail against the unfixed template.

**The localization contract** (`tests/localization.test.ts`) is a structural guard rather than a behaviour test. It asserts that no bare string literal reaches `ui.notifications` in the migrated files, that nothing outside `src/dialogs/notify.ts` calls `ui.notifications` directly, that every `EMPUZZLES.*` key referenced in code or templates is defined in `lang/en.json`, that no key is orphaned, and that no value is empty. The list of migrated files is explicit and commented — `src/utils/{creators,helpers,builders,actions}` still carry raw literals and are deliberately excluded. Extend the list as those files are migrated. `tests/mocks/foundry.ts` resolves `game.i18n` against the real `lang/en.json`, so a missing key fails a test instead of quietly rendering a raw key name.

## Coverage

Measured with `npm run test:coverage`. `src/main.ts` and `src/types/` are excluded from collection.

| Area                      | Statements | Branches | Functions |  Lines |
| ------------------------- | ---------: | -------: | --------: | -----: |
| **Overall**               |     63.11% |   53.93% |    63.99% | 64.14% |
| `utils/builders`          |       100% |   94.69% |      100% |   100% |
| `utils/actions`           |     98.14% |      80% |    95.45% | 98.11% |
| `utils/tag-input-manager` |     95.58% |   85.18% |      100% | 95.23% |
| `utils/creators`          |     94.97% |   85.96% |    93.61% | 94.85% |
| `utils/helpers`           |     93.56% |   82.31% |      100% | 95.71% |
| `dialogs`                 |     48.63% |   35.48% |       50% | 49.42% |
| `settings`                |     33.33% |     100% |        0% | 33.33% |

The generation layer — the part that decides what actually gets written into a tile — is well covered. The dialogs are not, and the overall number is dominated by two files:

- `src/dialogs/trap-dialog.ts` — 13% statements over ~2,700 lines
- `src/dialogs/check-state-dialog.ts` — 11% statements over ~880 lines

Both used to be excluded from coverage collection as "hard to unit test" despite having suites; the exclusions were removed in v2.2.0, which is why the headline number dropped from a flattering 89% to a truthful 63%. Nothing regressed — the old number simply wasn't measuring the two largest files in the project.

`jest.config.js` enforces a **ratchet** at 61/52/61/62, a couple of points under the current numbers, so ordinary churn does not redden CI but a real regression does. Raise it as coverage improves; the long-term goal is 80/75/80/80. When you add tests to trap-dialog or check-state-dialog, bump the floor in the same PR.

## Writing a test

Mock Foundry **before** importing the module under test — the dialogs read Foundry globals at class-definition time:

Creators do not return the tile — they call `scene.createEmbeddedDocuments`, so assert on what was passed to the mock:

```typescript
import { mockFoundry, createMockScene } from '../mocks/foundry';
mockFoundry();

import { createSwitchTile } from '../../src/utils/creators';

describe('createSwitchTile', () => {
  it('stores the switch state on its own tile', async () => {
    const scene = createMockScene();
    (global as any).canvas.scene = scene;

    await createSwitchTile(scene, switchConfig, 200, 200);

    const [, [tileData]] = scene.createEmbeddedDocuments.mock.calls[0];
    const actions = tileData.flags['monks-active-tiles'].actions;
    expect(actions.find((a: any) => a.action === 'setvariable').data.entity.id).toBe('tile');
  });
});
```

For a template test, render it off disk rather than asserting on the context object:

```typescript
import { renderDialogTemplate, getSelectOptionValues } from '../helpers/template-helper';

const html = await renderDialogTemplate(TrapDialog);
expect(getSelectOptionValues(html, 'resultType')).toContain(TrapResultType.COMBAT);
```

Assert on the emitted action data, not on internal dialog state. Every bug fixed in v2.2.0 that had a test at all had a test that checked the dialog remembered a value, not that the value reached Monk's Active Tiles in a form it could execute.

## CI

`.github/workflows/test.yml` runs three jobs on every PR: the suite on Node 22.x and 24.x with coverage uploaded to Codecov, a `quality` job (typecheck → lint → format check → build), and a `version-bump` job. See [GITHUB_SETUP.md](GITHUB_SETUP.md).
