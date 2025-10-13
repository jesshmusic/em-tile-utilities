# EM Tile Utilities - Test Suite

This directory contains the Jest test suite for EM Tile Utilities.

## Structure

```
tests/
├── setup.ts                    # Jest setup and configuration
├── mocks/
│   └── foundry.ts             # Mock Foundry VTT globals and utilities
├── utils/
│   └── tile-helpers.test.ts   # Tests for tile creation utilities
└── dialogs/
    └── tile-manager.test.ts   # Tests for TileManagerDialog
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode (development)

```bash
npm run test:watch
```

### Run tests with coverage report

```bash
npm run test:coverage
```

### Run tests in CI mode

```bash
npm run test:ci
```

## Writing Tests

### Mocking Foundry VTT

The test suite includes comprehensive mocks for Foundry VTT globals:

- `foundry.utils.randomID()`
- `foundry.applications.api.ApplicationV2`
- `foundry.applications.api.HandlebarsApplicationMixin`
- `game` object (modules, settings, i18n, scenes)
- `canvas` object (scene, stage, grid, tiles)
- `ui.notifications`
- `Hooks`
- `Dialog`
- `FilePicker`

### Helper Functions

#### `createMockScene(id, tiles[])`

Creates a mock Scene document with a collection of tiles.

```typescript
const scene = createMockScene('test-scene', [createMockTile({ id: 'tile-1', name: 'Test Tile' })]);
```

#### `createMockTile(overrides)`

Creates a mock Tile document with default properties.

```typescript
const tile = createMockTile({
  name: 'Custom Tile',
  x: 200,
  y: 300,
  hidden: true
});
```

#### `createMockLight(overrides)`

Creates a mock AmbientLight document.

```typescript
const light = createMockLight({
  config: {
    dim: 40,
    bright: 20,
    color: '#ffa726'
  }
});
```

## Test Coverage

The test suite aims for high coverage of critical functionality:

### Core Utilities (tile-helpers.ts)

- ✅ Switch tile creation with proper Monk's Active Tiles configuration
- ✅ Light tile creation with both manual and darkness-based triggers
- ✅ Reset tile creation with variable and tile state management
- ✅ Proper action generation for all tile types
- ✅ Correct positioning and sizing

### Dialogs (tile-manager.ts)

- ✅ Tile listing and sorting (name, x, y, elevation, sort)
- ✅ Monk's Active Tiles data extraction
- ✅ Video file detection for thumbnails
- ✅ Search functionality (client-side)
- ✅ Proper handling of empty scenes
- ✅ Metadata extraction (action count, variable count)

## Best Practices

### 1. Isolation

Each test should be independent and not rely on the state from other tests.

```typescript
beforeEach(() => {
  mockScene = createMockScene();
  (global as any).canvas.scene = mockScene;
});
```

### 2. Clear Test Names

Use descriptive test names that explain what is being tested.

```typescript
it('should create a switch tile with correct data structure', async () => {
  // ...
});
```

### 3. Arrange-Act-Assert

Structure tests clearly:

```typescript
it('should sort tiles by name', async () => {
  // Arrange
  dialog.sortBy = 'name';

  // Act
  const context = await dialog._prepareContext({});

  // Assert
  expect(context.tiles[0].name).toBe('Alpha Tile');
});
```

### 4. Test Edge Cases

Don't just test the happy path:

```typescript
it('should handle scene with no tiles', async () => {
  mockScene.tiles.clear();
  const context = await dialog._prepareContext({});
  expect(context.hasTiles).toBe(false);
});
```

### 5. Use Matchers Appropriately

```typescript
// Specific matchers
expect(value).toBe(10);
expect(array).toHaveLength(3);
expect(object).toHaveProperty('name');

// Partial object matching
expect(tile).toEqual(
  expect.objectContaining({
    x: 200,
    y: 200
  })
);
```

## CI/CD Integration

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

The CI workflow:

1. Runs tests on Node.js 18.x and 20.x
2. Generates coverage reports
3. Uploads coverage to Codecov (optional)
4. Checks that the project builds successfully

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

Run `npm run test:coverage` to see current coverage metrics.

## Debugging Tests

### VSCode

Add this configuration to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Command Line

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## Troubleshooting

### Tests fail with "Cannot find module"

Make sure all dependencies are installed:

```bash
npm install
```

### TypeScript errors in tests

Check that `@types/jest` is installed and `jest.config.js` is properly configured.

### Mocks not working

Ensure `tests/setup.ts` is being loaded by Jest (check `setupFilesAfterEnv` in jest.config.js).

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Update this README if adding new test utilities
