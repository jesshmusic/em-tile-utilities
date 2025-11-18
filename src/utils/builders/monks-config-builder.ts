/**
 * Monk's Active Tiles configuration builder
 */

/**
 * Create Monk's Active Tiles flags configuration
 * @param config - Monks configuration
 * @returns Monks flags object
 */
export function createMonksConfig(config: {
  name: string;
  actions: any[];
  trigger?: string[];
  active?: boolean;
  record?: boolean;
  restriction?: string;
  controlled?: string;
  allowpaused?: boolean;
  usealpha?: boolean;
  pointer?: boolean;
  vision?: boolean;
  pertoken?: boolean;
  minrequired?: null | number;
  cooldown?: null | number;
  chance?: number;
  fileindex?: number;
  files?: Array<{ id: string; name: string }>;
  variables?: Record<string, any>;
}): any {
  return {
    'monks-active-tiles': {
      name: config.name,
      active: config.active ?? true,
      record: config.record ?? false,
      restriction: config.restriction ?? 'all',
      controlled: config.controlled ?? 'all',
      trigger: config.trigger ?? ['dblclick'],
      allowpaused: config.allowpaused ?? false,
      usealpha: config.usealpha ?? false,
      pointer: config.pointer ?? true,
      vision: config.vision ?? true,
      pertoken: config.pertoken ?? false,
      minrequired: config.minrequired ?? null,
      cooldown: config.cooldown ?? null,
      chance: config.chance ?? 100,
      fileindex: config.fileindex ?? 0,
      actions: config.actions,
      files: config.files ?? [],
      variables: config.variables ?? {}
    }
  };
}
