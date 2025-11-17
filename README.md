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
- **Custom tags**: Organize switches with custom tags for grouping and identification

### Dynamic Lighting

Create torches, lanterns, candles, and magical lights that players can interact with—or that respond automatically to darkness.

- **Manual control**: Double-click to toggle lights on/off
- **Automatic activation**: Lights turn on when darkness falls, off at dawn
- **Customizable glow**: Choose colors, brightness, and light radius
- **Realistic behavior**: Each light creates an actual light source with proper shadows
- **Overlay effects**: Add animated flames or glow effects on top of light tiles
- **Ambient sound**: Optional positional audio at the light source location

### Teleport Pads & Portals

Transport tokens instantly between locations on the same scene or across different scenes. Perfect for portals, trap doors, magical circles, or quick travel systems.

- **Same-scene or cross-scene**: Teleport within the current scene or to any other scene in your world
- **Drag-to-size placement**: Create teleport pads of any size to fit your map design
- **Bidirectional portals**: Automatically create return teleports that bring tokens back to the original location
- **Player confirmation**: Optional prompt asking players to confirm before teleporting
- **Saving throws**: Require saving throws before teleportation (requires Monk's Token Bar)
- **Visual & audio feedback**: Add teleport sounds and customize tile appearance
- **Cross-scene token handling**: Option to delete source token when teleporting to different scenes
- **Custom tags**: Organize teleports with tags for paired portals or portal networks

### Pressure Plate Traps

Design dangerous floors, tripwires, and hidden hazards that trigger when tokens enter their space.

**Choose your trap type:**

- **Disappearing**: Trap vanishes after triggering (pit traps, collapsing floors)
- **Switching**: Trap changes appearance when activated (pressure plate depresses, tripwire breaks)
- **Activating**: Trap triggers other tiles or elements (opens doors, activates mechanisms)
- **Combat**: Trap makes attack rolls against triggering tokens (dart traps, blade traps)

**Add consequences:**

- **Damage with saves**: Roll dice for damage with optional saving throws (Dexterity, Constitution, etc.)
- **Attack rolls**: Create traps that attack with weapons or features (requires item drag-and-drop)
- **Teleportation**: Transport unlucky characters to another location with optional saves
- **Status effects**: Apply conditions like poisoned, stunned, or blinded
- **Chain reactions**: Activate multiple tiles, open/close doors, show/hide objects
- **DMG trap integration**: Drag trap items from the Dungeon Master's Guide compendium to auto-populate settings
- **Trigger limits**: Set maximum number of times a trap can trigger (once, multiple times, or unlimited)
- **Token configuration**: Combat traps can have visible or hidden tokens on the map

**Organized interface with setup guidance:**

The trap creation dialog features an intuitive accordion interface that organizes options into collapsible sections:

- **Basic Information**: Trap type, name, trigger settings, and target type
- **Result Configuration**: Damage, teleport, effects, or combat settings based on your trap type
- **Visibility**: Starting image, triggered image, and visibility behavior
- **Tiles & Doors**: Select tiles to activate and door states (for activating traps)
- **Custom Tags**: Organize traps with tags for grouping and identification

Each section shows a **red indicator** when required fields are missing, and a **Setup Tasks** list at the bottom guides you through completion. When all required fields are filled, you'll see a green "All required tasks complete!" message. Only one section can be open at a time to keep the interface clean and focused.

### Puzzle Reset Tiles

Save hours of manual work resetting puzzle rooms between game sessions. Place a reset tile that restores everything to its starting state with one click.

- **Restore positions**: Moves tiles back to where they started
- **Reset switches**: Returns all levers to their initial position
- **Fix puzzle state**: Resets all tracked variables to default values
- **Reset doors**: Closes, opens, or locks doors as needed
- **Clear history**: Wipes trigger memory so traps can fire again

### Scene Management Tools

**Variables Viewer**: See all puzzle variables in your scene at a glance—which switches are on, which traps have triggered, which doors are locked. Real-time display updates as your players interact with elements.

**Tile Manager**: Browse every interactive tile on your map with thumbnails. Quickly select, edit, or delete tiles. See which tiles are active and how many actions they contain. Features include:

- **Tile grouping**: Tiles with matching custom tags are automatically grouped together for easy organization
- **Search & sort**: Find tiles by name and sort by position, elevation, or z-order
- **Import & export**: Save tile configurations to JSON and reuse them across scenes or worlds
- **Quick actions**: Toggle visibility, toggle active state, select on canvas, or delete with one click
- **Auto-refresh**: Automatically updates when tiles change during your session

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
2. Click the **Tile Manager** button (floor hatch icon) in the toolbar
3. The Tile Manager opens, showing cards for each tile type you can create
4. **Click any card** (Switch, Light, Trap, Teleport, Reset) to open its creation dialog
5. **Fill in the form** with your preferred images and settings
6. **Click Create** and then **click on your map** to place the element

That's it! Your interactive element is ready to use. The Tile Manager stays open so you can create multiple elements quickly.

---

## 📖 Creating Your First Puzzle

Let's create a simple puzzle: three switches that open a door.

### Step 1: Open the Tile Manager

1. Switch to the **Tiles layer** in your scene
2. Click the **Tile Manager** button (floor hatch icon) in the toolbar
3. The Tile Manager dialog opens, showing all creation options

### Step 2: Create the Switches

1. In the Tile Manager, click the **Create Switch** card (lever icon)
2. Configure your first switch:
   - Name: "Switch 1"
   - Variable: "switch_1" (leave default)
   - Choose ON/OFF images (or use defaults)
   - Choose a sound effect
   - (Optional) Add custom tags like "puzzle-1" to group related switches
3. Click **Create** and then click on your map to place the switch
4. Repeat for switches 2 and 3

### Step 3: Test the Switches

Double-click each switch to test it. You should see:

- The image changes between ON and OFF states
- A sound effect plays
- A GM message shows the switch state
- If you added custom tags, switches are grouped together in the Tile Manager

### Step 4: Link to a Door (Optional)

1. Click the **Variables Viewer** button (scroll icon) in the Tile Manager to see your switch states
2. Use Monk's Active Tiles to create logic that checks if all three switches are ON before opening a door
3. Or create a **Check State** tile (experimental feature) that monitors switch variables and triggers door actions

---

## 🎨 Examples & Use Cases

### Classic Dungeon Puzzles

- **Torch puzzle**: Four torches must be lit in the correct sequence
- **Pressure plates**: Step on plates to open passages or trigger traps
- **Lever maze**: Pull levers to rotate walls and create a path through
- **Portal network**: Interconnected teleport pads that transport characters through a dungeon

### Dynamic Environments

- **Campfire**: Players can light/extinguish fires at campsites with ambient crackling sounds
- **Street lamps**: City lights that turn on at dusk, off at dawn
- **Magical barriers**: Shimmering walls that appear/disappear when touched
- **Fast travel system**: Teleport pads at key locations that transport to other maps or scenes

### Dramatic Encounters

- **Collapsing floor**: Tiles disappear as characters walk across them
- **Arrow traps**: Combat traps with crossbow attacks that require Dexterity saves
- **Gas vents**: Poison traps that deal damage and apply the poisoned condition
- **Teleport trap**: Save-or-teleport traps that send characters to prison cells or monster lairs
- **Blade trap**: Switching trap that reveals triggered state after attacking

### Session Management

- **Puzzle reset**: One-click restoration of complex puzzle rooms
- **Trap rearm**: Reset all traps between encounters
- **Scene cleanup**: Restore doors, lights, and objects to defaults
- **Tile library**: Export configured tiles and import them into new scenes

---

## ⚙️ Configuration

Access module settings from **Game Settings → Module Settings → Dorman Lakely's Tile Utilities**.

**Customize defaults** for faster creation:

- Default switch images (ON/OFF)
- Default light images (ON/OFF)
- Default trap images (armed/triggered)
- Default teleport images
- Default sound effects

**Experimental Features**: Enable the experimental features flag to access new tiles that are still in testing:

- **Check State Tile**: Complex state machine that monitors variables and branches logic based on conditions

Set these once, and every new element you create will use your preferred assets.

---

## 🎓 Tips for Game Masters

### Organize Your Assets

- Create a dedicated folder for puzzle assets (switches, levers, plates, portals, etc.)
- Name files clearly: `lever-up.png` and `lever-down.png`, `portal-blue.webm` and `portal-red.webm`
- Set defaults in module settings to match your asset library
- Use custom tags to group related tiles: "puzzle-room-1", "portal-network", "traps-level-3"

### Plan Before You Build

- Sketch out puzzle logic on paper first
- Decide which switches control what
- Plan trap placement before creating tiles
- Map out teleport networks to avoid confusing portal connections

### Test Everything

- Always test your puzzles before the session
- Try unexpected interactions (what if they flip switches backwards?)
- Use the **Variables Viewer** to verify puzzle state
- Test teleports in both directions and across scenes

### Use the Tile Manager

- Name your tiles descriptively: "North Door Switch", "Hidden Trap 1", "Portal to Basement"
- Use custom tags to group tiles: all tiles tagged "room-1-puzzle" appear together
- The Tile Manager shows all tiles with their names, positions, and groupings
- Use search and sort to quickly find specific elements during your session
- Export commonly-used tiles to reuse in other scenes

### Leverage DMG Trap Integration

- Drag trap items from DMG compendiums to auto-populate save DCs and damage
- Adjust the level range to match your party's strength
- Mix and match: use DMG templates as starting points, then customize

### Start Simple

- Begin with one switch and one door
- Add complexity once you're comfortable
- Combine tools to create elaborate scenarios
- Try a simple two-way teleport before building portal networks

---

## 🤝 Support & Community

- **Issues**: Report bugs on [GitHub Issues](https://github.com/jesshmusic/em-tile-utilities/issues)
- **Discussions**: Ask questions in the [Foundry VTT Discord](https://discord.gg/foundryvtt) (#module-development or #modules-troubleshooting channels)

---

## 📜 Attribution

Icons from [game-icons.net](https://game-icons.net) by various artists, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/):

- [Lever](https://game-icons.net/1x1/lorc/lever.html) by Lorc (switch button)
- [Candle Flame](https://game-icons.net/1x1/lorc/candle-flame.html) by Lorc (light button)
- [Clockwise Rotation](https://game-icons.net/1x1/delapouite/clockwise-rotation.html) by Delapouite (reset button)
- [Scroll Unfurled](https://game-icons.net/1x1/lorc/scroll-unfurled.html) by Lorc (variables viewer)
- [Stack](https://game-icons.net/1x1/delapouite/stack.html) by Delapouite (tile manager)
- Floor Hatch (tile manager toolbar icon)
- Spikes (trap defaults)
- Broken Trap (trap defaults)

---

## 📄 License

ISC
