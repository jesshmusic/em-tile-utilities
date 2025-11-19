/**
 * Monk's Token Bar action builders
 */

/**
 * Create a request roll action (saving throw via Monk's Token Bar)
 * @param rollType - Type of roll (e.g., "save:dex", "check:str")
 * @param dc - Difficulty class
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createRequestRollAction(
  rollType: string,
  dc: number,
  options?: {
    flavor?: string;
    rollmode?: string;
    silent?: boolean;
    fastforward?: boolean;
    usetokens?: string;
    continue?: string;
  }
): any {
  return {
    action: 'monks-tokenbar.requestroll',
    data: {
      entity: { id: 'token', name: 'Triggering Token' },
      request: rollType,
      dc: dc.toString(),
      flavor: options?.flavor || '',
      rollmode: options?.rollmode || 'roll',
      silent: options?.silent ?? false,
      fastforward: options?.fastforward ?? false,
      usetokens: options?.usetokens ?? 'fail',
      continue: options?.continue ?? 'failed'
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a filter request action (conditional based on roll result)
 * @param saveName - Saving throw name (e.g., "dex", "str")
 * @param failAnchor - Anchor to jump to on failure
 * @returns Monk's Active Tiles action object
 */
export function createFilterRequestAction(saveName: string, failAnchor: string): any {
  return {
    action: 'monks-tokenbar.filterrequest',
    data: {
      entity: { id: '' },
      collection: '',
      for: saveName,
      unpass: 'fail',
      pass: failAnchor
    },
    id: foundry.utils.randomID()
  };
}
