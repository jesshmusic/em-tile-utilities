# Dorman Lakely's Tile Utilities

**Transform your maps into interactive adventures.** Create puzzles, traps, and dynamic lighting in seconds with intuitive point-and-click tools—no complex configuration needed.

Built as a companion to [Monk's Active Tiles](https://foundryvtt.com/packages/monks-active-tiles), Dorman Lakely's Tile Utilities gives you ready-to-use templates for the most common interactive elements game masters need.

---

## 🎯 What Can You Create?

### Interactive Switches & Levers

Place toggleable switches that control doors, traps, lights, or any other element in your scene. Perfect for puzzle rooms where players must flip switches in the right sequence, or simple levers that open secret passages.

- **Visual feedback**: Switches change appearance when activated
- **Sound effects**: Add satisfying clicks, cranks, or magical chimes
- **Track state**: Each switch remembers if it's ON or OFF
- **Link to anything**: Connect switches to doors, lights, traps, or other tiles

### Dynamic Lighting

Create torches, lanterns, candles, and magical lights that players can interact with—or that respond automatically to darkness.

- **Manual control**: Double-click to toggle lights on/off
- **Automatic activation**: Lights turn on when darkness falls, off at dawn
- **Customizable glow**: Choose colors, brightness, and light radius
- **Realistic behavior**: Each light creates an actual light source with proper shadows

### Pressure Plate Traps

Design dangerous floors, tripwires, and hidden hazards that trigger when tokens enter their space.

**Choose your trap style:**

- **Disappearing**: Trap vanishes after triggering (pit traps, collapsing floors)
- **Switching**: Trap changes appearance when activated (pressure plate depresses, tripwire breaks)
- **Activating**: Trap triggers other elements (fires arrows, opens doors, releases gas)

**Add consequences:**

- **Damage**: Roll dice for damage with optional saving throws
- **Teleportation**: Transport unlucky characters to another location
- **Status effects**: Apply conditions like poisoned, stunned, or blinded
- **Chain reactions**: Activate multiple tiles, open/close doors, show/hide objects

### Puzzle Reset Tiles

Save hours of manual work resetting puzzle rooms between game sessions. Place a reset tile that restores everything to its starting state with one click.

- **Restore positions**: Moves tiles back to where they started
- **Reset switches**: Returns all levers to their initial position
- **Fix puzzle state**: Resets all tracked variables to default values
- **Reset doors**: Closes, opens, or locks doors as needed
- **Clear history**: Wipes trigger memory so traps can fire again

### Scene Management Tools

**Variables Viewer**: See all puzzle variables in your scene at a glance—which switches are on, which traps have triggered, which doors are locked. Real-time display updates as your players interact with elements.

**Tile Manager**: Browse every interactive tile on your map with thumbnails. Quickly select, edit, or delete tiles. See which tiles are active and how many actions they contain. Auto-refreshes when tiles change.

---

## 📋 Requirements

- **FoundryVTT v13** or higher
- **[Monk's Active Tiles](https://foundryvtt.com/packages/monks-active-tiles)** (required)
- **[Tagger](https://foundryvtt.com/packages/tagger)** (required)
- **[Monk's Token Bar](https://foundryvtt.com/packages/monks-tokenbar)** (optional, for saving throw features in traps and teleports)

---

## 🚀 Quick Start

### Installation

1. Open Foundry VTT
2. Go to **Add-on Modules** → **Install Module**
3. Search for "**Dorman Lakely's Tile Utilities**"
4. Click **Install**
5. Enable **Monk's Active Tiles**, **Tagger**, and **Dorman Lakely's Tile Utilities** in your world
6. _(Optional)_ Enable **Monk's Token Bar** if you want to use saving throw features in traps and teleports

### First Use

1. **Switch to the Tiles layer** in your scene
2. Look for **new toolbar buttons** with icons for switches, lights, traps, etc.
3. **Click any button** to open its creation dialog
4. **Fill in the form** with your preferred images and settings
5. **Click Create** and then **click on your map** to place the element

That's it! Your interactive element is ready to use.

---

## 📖 Creating Your First Puzzle

Let's create a simple puzzle: three switches that open a door.

### Step 1: Create the Switches

1. Click the **Toggle Switch** button (🔀 icon) in the Tiles toolbar
2. Configure your first switch:
   - Name: "Switch 1"
   - Variable: "switch_1" (leave default)
   - Choose ON/OFF images (or use defaults)
   - Choose a sound effect
3. Click **Create** and place on your map
4. Repeat for switches 2 and 3

### Step 2: Test the Switches

Double-click each switch to test it. You should see:

- The image changes between ON and OFF states
- A sound effect plays
- A GM message shows the switch state

### Step 3: Link to a Door (Optional)

Open the **Variables Viewer** (📋 icon) to see your switch states, then use Monk's Active Tiles to create logic that checks if all three switches are ON before opening a door.

---

## 🎨 Examples & Use Cases

### Classic Dungeon Puzzles

- **Torch puzzle**: Four torches must be lit in the correct sequence
- **Pressure plates**: Step on plates to open passages or trigger traps
- **Lever maze**: Pull levers to rotate walls and create a path through

### Dynamic Environments

- **Campfire**: Players can light/extinguish fires at campsites
- **Street lamps**: City lights that turn on at dusk, off at dawn
- **Magical barriers**: Shimmering walls that appear/disappear when touched

### Dramatic Encounters

- **Collapsing floor**: Tiles disappear as characters walk across them
- **Arrow traps**: Hidden pressure plates that deal damage to the unwary
- **Gas vents**: Poison clouds that apply conditions to anyone nearby

### Session Management

- **Puzzle reset**: One-click restoration of complex puzzle rooms
- **Trap rearm**: Reset all traps between encounters
- **Scene cleanup**: Restore doors, lights, and objects to defaults

---

## ⚙️ Configuration

Access module settings from **Game Settings → Module Settings → Dorman Lakely's Tile Utilities**.

**Customize defaults** for faster creation:

- Default switch images (ON/OFF)
- Default light images (ON/OFF)
- Default trap images (armed/triggered)
- Default sound effects

Set these once, and every new element you create will use your preferred assets.

---

## 🎓 Tips for Game Masters

### Organize Your Assets

- Create a dedicated folder for puzzle assets (switches, levers, plates, etc.)
- Name files clearly: `lever-up.png` and `lever-down.png`
- Set defaults in module settings to match your asset library

### Plan Before You Build

- Sketch out puzzle logic on paper first
- Decide which switches control what
- Plan trap placement before creating tiles

### Test Everything

- Always test your puzzles before the session
- Try unexpected interactions (what if they flip switches backwards?)
- Use the **Variables Viewer** to verify puzzle state

### Use the Tile Manager

- Name your tiles descriptively: "North Door Switch", "Hidden Trap 1"
- The Tile Manager shows all tiles with their names and positions
- Quickly find and edit specific elements during your session

### Start Simple

- Begin with one switch and one door
- Add complexity once you're comfortable
- Combine tools to create elaborate scenarios

---

## 🤝 Support & Community

- **Issues**: Report bugs on [GitHub Issues](https://github.com/jesshmusic/em-tile-utilities/issues)
- **Discussions**: Ask questions in the [Foundry VTT Discord](https://discord.gg/foundryvtt) (#module-development or #modules-troubleshooting channels)

---

## 📜 Attribution

Icons from [game-icons.net](https://game-icons.net) by various artists, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/):

- [Lever](https://game-icons.net/1x1/lorc/lever.html) by Lorc
- [Candle Flame](https://game-icons.net/1x1/lorc/candle-flame.html) by Lorc
- [Clockwise Rotation](https://game-icons.net/1x1/delapouite/clockwise-rotation.html) by Delapouite
- [Scroll Unfurled](https://game-icons.net/1x1/lorc/scroll-unfurled.html) by Lorc
- [Stack](https://game-icons.net/1x1/delapouite/stack.html) by Delapouite

---

## 📄 License

ISC
