# Copilot Code Review Instructions

## Project Overview

This is **Dorman Lakely's Tile Utilities**, a FoundryVTT v13 module providing UI tools for creating interactive tiles using Monk's Active Tiles. Built with TypeScript using Foundry's ApplicationV2 API.

## Code Review Focus Areas

When performing a code review, please focus on:

### TypeScript & Type Safety
- Ensure proper TypeScript types are used (avoid excessive `any` types)
- Check for proper null/undefined handling
- Verify async/await patterns are used correctly

### FoundryVTT Patterns
- Dialogs must extend `HandlebarsApplicationMixin(ApplicationV2)`
- Use `(canvas as any)` and `(game as any)` for Foundry globals (types are incomplete)
- Action IDs must be unique - always use `foundry.utils.randomID()`
- Form handlers should be private static methods (`#methodName`)

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
