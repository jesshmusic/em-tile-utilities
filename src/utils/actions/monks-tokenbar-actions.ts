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
 * Create a filter request action (splits tokens into passed/failed saving throw branches)
 * @param options - Filter options with passed, failed, and resume anchors
 * @returns Monk's Active Tiles action object
 */
export function createFilterRequestAction(options: {
  passed: string;
  failed: string;
  resume: string;
}): any {
  return {
    action: 'monks-tokenbar.filterrequest',
    data: {
      passed: options.passed,
      failed: options.failed,
      resume: options.resume
    },
    id: foundry.utils.randomID()
  };
}
