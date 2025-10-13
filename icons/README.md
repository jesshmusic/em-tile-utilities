# Game Icons

This directory contains SVG icons from [game-icons.net](https://game-icons.net).

## License

All icons are licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and require attribution to the original authors.

## How to Download Icons

### Method 1: Individual Icons from Website

1. Visit [game-icons.net](https://game-icons.net)
2. Search for the icon you want
3. Click the icon to open the detail page
4. Click "Download SVG" or use the Studio to customize
5. Save the SVG file to this directory

### Method 2: From GitHub Repository

```bash
# Clone the entire repository
git clone https://github.com/game-icons/icons.git temp-icons

# Copy specific icons you need
cp temp-icons/delapouite/originals/svg/000000/transparent/lever.svg icons/
cp temp-icons/lorc/originals/svg/000000/transparent/candle-flame.svg icons/

# Clean up
rm -rf temp-icons
```

### Method 3: Direct Download via CLI

```bash
# Download from GitHub repository (recommended)
curl -sL "https://raw.githubusercontent.com/game-icons/icons/master/lorc/lever.svg" -o lever.svg
curl -sL "https://raw.githubusercontent.com/game-icons/icons/master/lorc/candle-flame.svg" -o candle-flame.svg
curl -sL "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/clockwise-rotation.svg" -o clockwise-rotation.svg
curl -sL "https://raw.githubusercontent.com/game-icons/icons/master/lorc/scroll-unfurled.svg" -o scroll-unfurled.svg
curl -sL "https://raw.githubusercontent.com/game-icons/icons/master/delapouite/stack.svg" -o card-pile.svg
```

## Current Icons

| Icon File                | Used For         | Author     | Original Name      |
| ------------------------ | ---------------- | ---------- | ------------------ |
| `lever.svg`              | Switch Tile      | Lorc       | lever              |
| `candle-flame.svg`       | Light Tile       | Lorc       | candle-flame       |
| `clockwise-rotation.svg` | Reset Tile       | Delapouite | clockwise-rotation |
| `scroll-unfurled.svg`    | Variables Viewer | Lorc       | scroll-unfurled    |
| `card-pile.svg`          | Tile Manager     | Delapouite | stack              |

## Attribution

Icons from game-icons.net by various authors, licensed under CC BY 3.0. See individual icon pages on game-icons.net for specific attribution.

## Customizing Icons

You can use the [game-icons.net Studio](https://game-icons.net/studio.html) to:

- Change colors
- Rotate icons
- Add effects
- Resize
- Export in SVG or PNG format
