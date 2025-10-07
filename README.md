# EM Puzzle and Trap Tiles

A FoundryVTT module that adds switch sequence puzzle functionality to Monk's Active Tiles.

## Requirements

- Foundry VTT v11 or higher
- Monk's Active Tiles module

## Installation

1. Download the module zip file
2. Extract to your Foundry `Data/modules/em-puzzle-and-trap-tiles` folder
3. Create a `templates` folder inside and place `switch-puzzle-dialog.html` there
4. Enable both "Monk's Active Tiles" and "EM Puzzle and Trap Tiles" in your world

## Quick Start - Create a Puzzle in 30 Seconds

1. Open your scene
2. Click the **Tiles** layer
3. Click the new **Toggle On** button (Create Switch Puzzle)
4. In the dialog:
   - Enter a unique Puzzle ID (e.g., "throne_room")
   - Choose number of switches (2-10)
   - Check "Reset on Wrong Switch" if you want mistakes to restart the puzzle
5. Click **Create Switches**
6. Three (or more) switch tiles appear on your map - move them into position!

The switches are automatically configured to work in sequence order (left to right).

## Customization After Creation

After creating switches, double-click each one to:
- Add the statue/tile that should toggle when pulled
- Change the door that opens when the puzzle completes
- Adjust sound effects or chat messages
- Link to other puzzle elements

The sequence logic is already set up - you just connect the visual elements!

This module adds three new actions to Monk's Active Tiles for creating sequence-based switch puzzles where players must activate switches in a specific order.

### Actions Added

#### 1. Switch: Sequence Step
Check if a switch is being activated at the correct step in the sequence.

**Parameters:**
- **Puzzle ID**: Unique identifier for your puzzle (e.g., "throne_room")
- **Expected Step**: What step should the puzzle be at? (0 = start)
- **Next Step**: What step to advance to if correct
- **Reset on Failure**: Reset to step 0 if wrong switch pulled

**Landings:**
- `success` - This switch was pulled at the correct time
- `failure` - Wrong switch or wrong order

#### 2. Switch: Check Sequence Complete
Check if the entire puzzle sequence has been completed.

**Parameters:**
- **Puzzle ID**: Same ID used in Sequence Step actions
- **Completed Step**: What step number means the puzzle is solved

**Landings:**
- `complete` - Puzzle is solved
- `incomplete` - Still in progress

#### 3. Switch: Reset Sequence
Manually reset a puzzle back to step 0.

**Parameters:**
- **Puzzle ID**: Which puzzle to reset

## Example Setup

Create a puzzle where switches must be pulled in order: 2 → 1 → 3

### Switch 2 Tile (First in sequence)
1. **Toggle** This Tile (visual feedback)
2. **Play Sound** "Lever.ogg"
3. **Switch: Sequence Step**
   - Puzzle ID: `myPuzzle`
   - Expected Step: `0`
   - Next Step: `1`
   - Reset on Failure: ✓
4. **Landing: success** → **Chat Message** "You hear a click..."
5. **Landing: failure** → **Chat Message** "Something resets with a grinding sound"

### Switch 1 Tile (Second in sequence)
1. **Toggle** This Tile
2. **Play Sound** "Lever.ogg"
3. **Switch: Sequence Step**
   - Puzzle ID: `myPuzzle`
   - Expected Step: `1`
   - Next Step: `2`
   - Reset on Failure: ✓
4. **Landing: success** → **Chat Message** "Another click echoes..."
5. **Landing: failure** → **Chat Message** "Something resets..."

### Switch 3 Tile (Final in sequence)
1. **Toggle** This Tile
2. **Play Sound** "Lever.ogg"
3. **Switch: Sequence Step**
   - Puzzle ID: `myPuzzle`
   - Expected Step: `2`
   - Next Step: `3`
   - Reset on Failure: ✓
4. **Landing: success** → **Chat Message** "CLUNK! The door unlocks!"
5. **Landing: success** → **Change Wall/Door** [Your reward door] OPEN

## How It Works

The module tracks puzzle progress using Foundry flags on the tile. Each puzzle is identified by a unique ID you provide, allowing multiple independent switch puzzles in the same scene.

When a switch is activated:
1. Check current step against expected step
2. If correct: advance to next step, trigger "success" landing
3. If wrong: optionally reset to step 0, trigger "failure" landing

## Tips

- Use the same **Puzzle ID** for all switches in one puzzle
- Start with Expected Step 0 for the first switch
- Each subsequent switch expects the previous step number
- Players can toggle switches freely for visual feedback - only the sequence matters
- Use Chat Messages or sounds on success/failure landings for feedback

## Norse Campaign Use

Perfect for Norrundar-style puzzles! Set up rune stones, statue levers, or ancient mechanisms that must be activated in the correct order to open vault doors, reveal hidden passages, or disable magical wards.

## License

GNU GPLv3.0, supplemented by Commons Clause
