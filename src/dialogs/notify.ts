/**
 * Localized wrappers around `ui.notifications`.
 *
 * Every user-facing notification in this module goes through here so the
 * strings live in `lang/en.json` instead of inline in the dialogs. Pass a
 * localization key and, when the message interpolates values, a data object
 * whose properties match the `{placeholders}` in the string —
 * `game.i18n.format` does the substitution, so a translator can reorder the
 * placeholders without touching any TypeScript.
 *
 *   notifyInfo('EMPUZZLES.NotifyTileListRefreshed');
 *   notifyInfo('EMPUZZLES.NotifySelected', { name: tile.name });
 */

/** Values substituted into `{placeholder}` tokens by `game.i18n.format`. */
export type NotifyData = Record<string, string | number>;

/** Subset of Foundry's notification options this module uses. */
export interface NotifyOptions {
  permanent?: boolean;
}

type NotifyLevel = 'info' | 'warn' | 'error';

/**
 * Resolve a key to display text, formatting it only when data is supplied.
 * `localize` is used for the no-data case so keys containing literal braces
 * (e.g. Handlebars examples) survive untouched.
 */
function localizeMessage(key: string, data?: NotifyData): string {
  const i18n = (game as any).i18n;
  return data ? i18n.format(key, data) : i18n.localize(key);
}

function emit(level: NotifyLevel, key: string, data?: NotifyData, options?: NotifyOptions): void {
  const message = localizeMessage(key, data);
  const notifications = ui.notifications as any;
  // Only forward `options` when there is something to forward — Foundry
  // treats a trailing `undefined` the same way, but callers (and tests)
  // reading the call signature see the simple one-argument form.
  if (options) notifications?.[level](message, options);
  else notifications?.[level](message);
}

/** Show a localized info notification. */
export function notifyInfo(key: string, data?: NotifyData, options?: NotifyOptions): void {
  emit('info', key, data, options);
}

/** Show a localized warning notification. */
export function notifyWarn(key: string, data?: NotifyData, options?: NotifyOptions): void {
  emit('warn', key, data, options);
}

/** Show a localized error notification. */
export function notifyError(key: string, data?: NotifyData, options?: NotifyOptions): void {
  emit('error', key, data, options);
}
