/**
 * The one-line `game.i18n` wrapper the non-dialog layers use.
 *
 * `src/dialogs/notify.ts` owns everything that reaches `ui.notifications`; this
 * is the other half — text that is rendered rather than notified (chat message
 * bodies, Monk's Active Tiles action labels, region behavior field help). It is
 * deliberately null-safe: actions and region behavior types are registered
 * during `init`, before `game.i18n` is guaranteed to exist, and a missing
 * translator must return the key rather than throw inside a hook.
 *
 * @param key - Localization key
 * @param data - Interpolation data; when present, `format` is used
 * @returns The localized string, or the key itself when i18n is unavailable
 */
export function localize(key: string, data?: Record<string, unknown>): string {
  const i18n = (globalThis as any).game?.i18n;
  if (!i18n) return key;
  return data ? (i18n.format?.(key, data) ?? key) : (i18n.localize?.(key) ?? key);
}
