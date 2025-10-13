# Integrating game-icons.net with FoundryVTT

This guide shows you how to replace Font Awesome icons with game-icons.net SVG icons.

## Approach 1: CSS Background Icons (Recommended for Simple Icons)

This approach uses CSS classes similar to Font Awesome, but with SVG backgrounds.

### Usage in Templates

```handlebars
<!-- Old Font Awesome -->
<i class='fas fa-lightbulb'></i>

<!-- New game-icon -->
<i class='game-icon game-icon-candle-flame'></i>
```

### Usage in ApplicationV2 Window Icons

The `icon` property in ApplicationV2 expects a Font Awesome class. To use game-icons there, we need to either:

**Option A: Create Font Awesome-compatible classes**

```css
/* In icons.css */
.fa-lever::before {
  content: '';
  display: inline-block;
  width: 1em;
  height: 1em;
  background-image: url('../icons/lever.svg');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
```

**Option B: Use direct icon references** (Preferred for v13)

```typescript
// Instead of:
icon: 'fa-solid fa-toggle-on';

// Use:
icon: 'game-icon game-icon-lever';
```

## Approach 2: Inline SVG Icons (Most Flexible)

For maximum control and best rendering, embed SVGs directly in templates:

```handlebars
<svg class='icon' width='16' height='16'>
  <use href='modules/em-tile-utilities/icons/lever.svg#icon'></use>
</svg>
```

## Approach 3: Helper Function (Recommended for Code)

Create a helper function to generate icon HTML:

```typescript
// In a utils file
export function gameIcon(iconName: string, size: string = '1em'): string {
  return `<i class="game-icon game-icon-${iconName}" style="width: ${size}; height: ${size};"></i>`;
}

// Usage
const iconHtml = gameIcon('lever', '1.5em');
```

## Icon Mapping Reference

| Old Font Awesome                | New game-icon                  | File                   |
| ------------------------------- | ------------------------------ | ---------------------- |
| `fa-solid fa-toggle-on`         | `game-icon-lever`              | lever.svg              |
| `fa-solid fa-lightbulb`         | `game-icon-candle-flame`       | candle-flame.svg       |
| `fa-solid fa-arrow-rotate-left` | `game-icon-clockwise-rotation` | clockwise-rotation.svg |
| `fa-solid fa-list`              | `game-icon-scroll-unfurled`    | scroll-unfurled.svg    |
| `fa-solid fa-layer-group`       | `game-icon-card-pile`          | card-pile.svg          |

## Styling Game Icons

### Changing Colors

```css
/* Make icons white on dark backgrounds */
.game-icon-white {
  filter: invert(1) brightness(2);
}

/* Tint icons to match theme */
.game-icon-primary {
  filter: invert(0.5) sepia(1) saturate(5) hue-rotate(175deg);
}
```

### Sizing

```html
<i class="game-icon game-icon-lever game-icon-lg"></i>
<!-- 1.33em -->
<i class="game-icon game-icon-lever game-icon-xl"></i>
<!-- 1.5em -->
<i class="game-icon game-icon-lever game-icon-2x"></i>
<!-- 2em -->
```

## Testing Icons

After making changes:

1. Reload FoundryVTT (F5)
2. Open the Tile Manager
3. Verify icons display correctly
4. Check all dialogs (Switch, Light, Reset, Variables)

## Attribution

Remember to credit game-icons.net authors. Add to your README:

```markdown
## Attribution

Icons from [game-icons.net](https://game-icons.net) by various authors,
licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

- Lever icon by [Delapouite](https://game-icons.net/1x1/delapouite/lever.html)
- Candle Flame icon by [Lorc](https://game-icons.net/1x1/lorc/candle-flame.html)
- Clockwise Rotation icon by [Delapouite](https://game-icons.net/1x1/delapouite/clockwise-rotation.html)
- Scroll Unfurled icon by [Lorc](https://game-icons.net/1x1/lorc/scroll-unfurled.html)
- Card Pile icon by [Delapouite](https://game-icons.net/1x1/delapouite/card-pile.html)
```
