# Copilot Code Review Instructions

## Project Overview

This is **Dorman Lakely's Tile Utilities**, a FoundryVTT **v14** module providing UI tools for creating interactive tiles and regions using Monk's Active Tiles. Built with TypeScript using Foundry's ApplicationV2 API. Requires Monk's Active Tiles 14.01+ and Tagger 1.6.0+; Monk's Token Bar and Enhanced Region Behaviors are optional. Trap and combat features assume dnd5e (verified against 5.3.3) behind a system guard.

See [CLAUDE.md](../CLAUDE.md) for the full developer reference.

## Code Review Focus Areas

When performing a code review, please focus on:

### TypeScript & Type Safety

- Ensure proper TypeScript types are used (avoid excessive `any` types)
- Check for proper null/undefined handling
- Verify async/await patterns are used correctly

### FoundryVTT v14 Patterns

- Dialogs must extend `HandlebarsApplicationMixin(ApplicationV2)`
- Use `(canvas as any)` and `(game as any)` for Foundry globals (types are incomplete)
- Action IDs must be unique - always use `foundry.utils.randomID()`
- Form handlers should be private static methods (`#methodName`)
- Flag any reintroduction of the deprecated flat globals `loadTemplates`, `renderTemplate`, `FilePicker`, `SearchFilter`, `ContextMenu`, `TextEditor` or `AudioHelper`. They resolve only through v14 backwards-compatibility getters marked "until 15" (`AudioHelper` is already gone). The v14 homes are `foundry.applications.handlebars.*`, `foundry.applications.apps.FilePicker` and `foundry.audio.AudioHelper`.
- `_onClose(options)` is the ApplicationV2 close lifecycle callback. It must not also be wired as a button action - Cancel gets its own `_onCancel`.
- CSS targets ApplicationV2's `.application` root class, not ApplicationV1's `.window-app`.

### Localization

- `src/dialogs/notify.ts` is the only module allowed to call `ui.notifications`. Flag any bare user-facing string literal that reaches it, and any new UI text that is not an `EMPUZZLES.*` key in `lang/en.json`.

### Security

- Check for command injection vulnerabilities
- Ensure user inputs are sanitized before embedding in scripts
- Validate file paths come from FilePicker or trusted sources

### Code Quality

- Avoid over-engineering - only make changes directly requested
- Don't add unnecessary comments, docstrings, or type annotations
- Prefer editing existing files over creating new ones
- Keep solutions simple and focused

### Testing

- New functionality should have corresponding tests
- Tests should use the mock patterns in `tests/mocks/foundry.ts`
- Verify all tests pass before approving

### Module Architecture

- **Helpers** (`src/utils/helpers/`) - Utility functions
- **Actions** (`src/utils/actions/`) - Monk's Active Tiles action builders
- **Builders** (`src/utils/builders/`) - Data structure builders
- **Creators** (`src/utils/creators/`) - High-level tile/region creation

## Common Issues to Flag

- Missing cleanup of event handlers or PIXI resources
- Race conditions in async code (especially scene switching)
- Hardcoded timeouts instead of proper event hooks
- Full re-renders when targeted DOM updates would suffice
- Unescaped strings embedded in generated JavaScript code

## Commit Message Format

Follow conventional commit format:

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `test:` - Testing
- `docs:` - Documentation
- `chore:` - Build, dependencies
