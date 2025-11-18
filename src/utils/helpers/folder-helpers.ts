/**
 * Foundry VTT folder management utilities
 */

/**
 * Get or create the "Dorman Lakely's Tile Utilities" folder for trap actors
 * @returns The folder ID
 */
export async function getOrCreateTrapActorsFolder(): Promise<string> {
  // Check if folder already exists
  const existingFolder = (game as any).folders.find(
    (f: any) => f.name === "Dorman Lakely's Tile Utilities" && f.type === 'Actor'
  );

  if (existingFolder) {
    return existingFolder.id;
  }

  // Create the folder
  const folder = await (game as any).folders.documentClass.create({
    name: "Dorman Lakely's Tile Utilities",
    type: 'Actor',
    parent: null
  });

  return folder.id;
}
