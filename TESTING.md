# Testing Summary - Dorman Lakely's Tile Utilities

## Test Suite Status

✅ **463 tests passing** across 14 test suites (including 19 integration tests)

## Coverage Report

| File                                | Statements | Branches | Functions | Lines  |
| ----------------------------------- | ---------- | -------- | --------- | ------ |
| **Overall**                         | 34%        | 26.61%   | 33.64%    | 33.91% |
| **src/main.ts**                     | 86.48%     | 100%     | 37.5%     | 85.71% |
| **src/utils/tile-helpers.ts**       | 83.01%     | 50%      | 100%      | 83.01% |
| **src/dialogs/variables-viewer.ts** | 97.14%     | 94.11%   | 88.88%    | 97.05% |
| **src/dialogs/switch-dialog.ts**    | 31.25%     | 0%       | 25%       | 32.6%  |
| **src/dialogs/tile-manager.ts**     | 24.24%     | 23.07%   | 29.03%    | 22.66% |
| **src/dialogs/light-dialog.ts**     | 17.39%     | 0%       | 15.38%    | 17.91% |
| **src/dialogs/reset-dialog.ts**     | 13.68%     | 12.14%   | 18.75%    | 13.58% |

## What's Tested

### Core Utilities (tile-helpers.ts) - 22 tests ✅

Comprehensive coverage of tile creation functions:

#### Switch Tile Creation

- ✅ Creates correct data structure and positioning
- ✅ Includes proper Monk's Active Tiles configuration
- ✅ Generates all required actions (playsound, setvariable, checkvalue, tileimage, etc.)
- ✅ Sets up ON/OFF image files correctly
- ✅ Initializes variables properly
- ✅ Handles default positioning

#### Light Tile Creation

- ✅ Creates both AmbientLight and Tile documents
- ✅ Configures light properties (dim, bright, color, alpha)
- ✅ Centers light on tile position
- ✅ Handles both manual (dblclick) and darkness-based triggers
- ✅ Sets correct initial visibility
- ✅ Includes toggle actions only for manual lights

#### Reset Tile Creation

- ✅ Creates proper 2x2 grid tile
- ✅ Generates setvariable actions for each variable
- ✅ Creates activate actions when needed
- ✅ Creates tileimage actions for tile state restoration
- ✅ Includes confirmation chat message
- ✅ Uses dblclick trigger
- ✅ Handles wall/door state resets

### Tile Manager (tile-manager.ts) - 34 tests ✅

#### Initialization

- ✅ Default sort and search values
- ✅ Correct dialog options (resizable, etc.)

#### Context Preparation

- ✅ Sorts tiles by: name, X position, Y position, elevation, sort order
- ✅ Includes all tile metadata
- ✅ Detects video files (.webm, .mp4, .ogg, .ogv) for proper rendering
- ✅ Distinguishes between video and image files
- ✅ Handles empty scenes gracefully
- ✅ Handles missing canvas scene
- ✅ Preserves search query and sort option
- ✅ Extracts Monk's Active Tiles data (actions, variables, active state)
- ✅ Uses fallback names (Monks name → "Unnamed Tile")
- ✅ Defaults active state to true when not specified
- ✅ Handles tiles without Monk's Active Tiles data

#### Tile Count

- ✅ Reports correct tile count
- ✅ Handles empty scenes

#### Video Detection

- ✅ Detects all video extensions (case-insensitive)
- ✅ Doesn't misidentify image files as videos

## Integration Tests (NEW) - 19 tests ✅

**Purpose:** Catch bugs that unit tests miss by actually compiling and rendering Handlebars templates with real context data.

### TrapDialog Template Rendering Integration

These integration tests verify that the trap dialog template compiles correctly and renders the expected HTML structure. **These tests would have caught the production bug** where `'combat'` string literal was used instead of `TrapResultType.COMBAT` enum constant.

#### Template Compilation (2 tests)

- ✅ Template compiles without errors
- ✅ Renders valid HTML output

#### Critical Form Elements (5 tests)

- ✅ Trap type select element exists
- ✅ Image behavior select element exists
- ✅ Result type select element exists
- ✅ Trap name input exists
- ✅ Starting image input exists

#### Result Type Dropdown - CRITICAL BUG PREVENTION (4 tests)

- ✅ **Has correct enum values** (would catch string literal bugs)
- ✅ **No duplicate combat options** (regression prevention)
- ✅ **Localization keys present** (prevents missing translations)
- ✅ **Prevents combat string literal vs enum bug** (explicit regression test)

#### Trap Type & Image Behavior Options (2 tests)

- ✅ IMAGE and ACTIVATING trap types present
- ✅ HIDE, SWITCH, and NOTHING behaviors present

#### Conditional Rendering (2 tests)

- ✅ Damage fields appear when damage result type selected
- ✅ Combat fields appear when combat result type selected

#### File Picker Buttons (1 test)

- ✅ File picker buttons have correct data attributes

#### Localization (1 test)

- ✅ Uses EMPUZZLES localization namespace

#### Template Syntax Validation (2 tests)

- ✅ No undefined variables in rendered HTML
- ✅ All HTML tags properly closed

### Integration Test Helpers

Located in `tests/helpers/template-helper.ts`:

- **`loadTemplate(path)`** - Load `.hbs` files from disk
- **`compileTemplate(source)`** - Compile Handlebars templates
- **`registerHandlebarsHelpers()`** - Register Foundry helpers (`localize`, `eq`, `and`, `or`, `not`)
- **`registerHandlebarsPartials()`** - Register partial templates
- **`renderTemplate(path, context)`** - Render template with context
- **`renderDialogTemplate(DialogClass)`** - Render dialog with `_prepareContext()` data
- **`htmlContainsSelector(html, selector)`** - Check if HTML contains selector
- **`getSelectOptionValues(html, name)`** - Extract option values from select
- **`getSelectOptionLabels(html, name)`** - Extract option labels from select

### Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration/

# Run specific integration test
npm test -- tests/integration/trap-dialog-rendering.test.ts

# Watch mode for integration tests
npm run test:watch -- tests/integration/
```

### Why Integration Tests Matter

**Example: The Combat Enum Bug**

Before integration tests, this bug passed all unit tests but failed in production:

```typescript
// Bug: Using string literal instead of enum
const resultTypeOptions = [
  { value: 'combat', label: 'EMPUZZLES.ResultCombat' } // ❌ Wrong
];

// Fixed: Using enum constant
const resultTypeOptions = [
  { value: TrapResultType.COMBAT, label: 'EMPUZZLES.ResultCombat' } // ✅ Correct
];
```

**What unit tests checked:**

- ✅ `dialog.resultType` property exists
- ✅ Context includes `resultTypeOptions` array

**What unit tests MISSED:**

- ❌ Template actually renders
- ❌ Dropdown options match enum values
- ❌ Conditional logic works with enum comparison

**What integration tests catch:**

- ✅ Template compiles without errors
- ✅ Dropdown has correct option values
- ✅ Only ONE 'combat' option exists (from enum)
- ✅ Enum constants used consistently throughout

## Test Infrastructure

### Mock System

- Complete Foundry VTT global mocks
- `mockFoundry()` - Sets up all Foundry globals
- `createMockScene()` - Creates test scenes with tiles
- `createMockTile()` - Creates mock tile documents
- `createMockLight()` - Creates mock light documents

### Configuration

- Jest with ts-jest for TypeScript support
- Coverage reporting (text, lcov, html)
- Proper TypeScript configuration

### CI/CD Integration

- GitHub Actions workflow (`test.yml`)
- Runs on Node.js 18.x and 20.x
- Automatic coverage upload to Codecov
- Build verification

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage

# CI mode (for GitHub Actions)
npm run test:ci
```

### Dialog Tests

#### Switch Dialog (switch-dialog.ts) - 13 tests ✅

- ✅ Dialog initialization and configuration
- ✅ Context preparation with default settings
- ✅ Auto-generation of switch names and variable IDs
- ✅ Settings integration for default images and sounds
- ✅ Form submission handler

#### Light Dialog (light-dialog.ts) - 21 tests ✅

- ✅ Dialog initialization and configuration
- ✅ Context preparation with light settings
- ✅ Darkness trigger vs manual toggle configuration
- ✅ Default light color and intensity values
- ✅ Settings integration for default images
- ✅ Light property validation

#### Reset Dialog (reset-dialog.ts) - 25 tests ✅

- ✅ Dialog initialization with action handlers
- ✅ Selected tile state management
- ✅ Variable extraction and type detection (boolean vs non-boolean)
- ✅ File path extraction from full paths
- ✅ Wall/door action detection
- ✅ Tile action type detection (activate, movement, tileimage, showhide)
- ✅ Form capture functionality

#### Variables Viewer (variables-viewer.ts) - 25 tests ✅

- ✅ Dialog initialization and title generation
- ✅ Variable extraction from all scene tiles
- ✅ Boolean value display with color formatting
- ✅ Tile association tracking
- ✅ Alphabetical variable sorting
- ✅ Fallback naming for unnamed tiles
- ✅ Empty scene handling

#### Main Module (main.ts) - 20 tests ✅

- ✅ Init hook registration
- ✅ Settings registration (6 settings)
- ✅ Ready hook and dependency checking
- ✅ Toolbar integration with 5 tools
- ✅ Graceful handling of missing controls

## Future Test Expansion

### Integration Tests (Future)

- End-to-end tile creation workflows
- Dialog interactions (file pickers, form submissions)
- Hook system integration
- Settings management

## Best Practices Followed

1. **Test Isolation** - Each test is independent with proper setup/teardown
2. **Descriptive Names** - Clear test descriptions explain what's being tested
3. **AAA Pattern** - Arrange-Act-Assert structure throughout
4. **Edge Cases** - Tests for empty states, missing data, null values
5. **Mocking** - Comprehensive Foundry VTT mocks prevent external dependencies
6. **Coverage Goals** - Aiming for >80% coverage on critical paths
7. **CI Integration** - Automated testing on every push/PR

## Key Testing Achievements

✅ **100% function coverage** on tile-helpers.ts
✅ **83% statement coverage** on tile-helpers.ts
✅ **Zero external dependencies** - All Foundry APIs mocked
✅ **Fast execution** - All tests run in <1 second
✅ **Type-safe** - Full TypeScript support in tests
✅ **CI-ready** - GitHub Actions workflow configured
✅ **Documentation** - Comprehensive test README included

## Next Steps for Developers

1. Add tests for remaining dialog components
2. Increase branch coverage on tile-helpers.ts
3. Add integration tests for dialog workflows
4. Set up Codecov integration for coverage tracking
5. Add performance benchmarks for tile creation

---

**Test framework**: Jest 30.2.0 + ts-jest 29.4.5
**Last updated**: 2025-10-13
**Total tests**: 167 passing
**Test suites**: 7 passing
**Overall coverage**: 34% statements, 26.61% branches, 33.64% functions
