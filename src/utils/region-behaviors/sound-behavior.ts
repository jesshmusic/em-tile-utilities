/**
 * `em-tile-utilities.SoundEffect` — play a sound file when a region fires.
 *
 * Foundry core has no "play a sound" region behavior, which is why the trap and
 * teleport region creators reached for Enhanced Region Behaviors' `SoundEffect`
 * for their optional sound. That was a soft dependency in the worst way: with
 * ERB missing, ticking "play a sound" produced a behavior document of an
 * unregistered type, which is silently inert. Owning the type removes the last
 * reason a region creator needs ERB at all.
 *
 * Field names (`soundPath`, `volume`) match ERB's
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:330-343).
 *
 * Playback differs deliberately. ERB ends in
 * `game.socket?.emit("playAudio", …)` (mjs:387), which reaches every OTHER
 * client but never the one that triggered the region — so the player who
 * stepped on the trap is the one person who does not hear it. This uses
 * `foundry.audio.AudioHelper.play(…, true)`, whose second argument broadcasts
 * to everyone INCLUDING the local client. Note the namespace: the flat
 * `AudioHelper` global is gone in v14.
 */

import { EM_SOUND_TYPE, REGION_L, getDataFields, getRegionBehaviorTypeBase } from './constants';

/** Localization prefix for the SoundEffect data model. */
export const SOUND_L = `${REGION_L}.SoundEffect`;

/**
 * The sound behavior's event handler.
 *
 * No `event.user.isSelf` guard, and that is the point: `AudioHelper.play` with
 * `push: true` already fans the sound out to every client, so running it on all
 * of them would play it once per connected user. The triggering client is the
 * one that broadcasts.
 *
 * @param soundBehavior - The behavior's data model (or a test double)
 * @param event - The region event
 */
export async function handleSoundRegionEvent(soundBehavior: any, event: any): Promise<void> {
  if (event?.user && event.user.isSelf === false) return;

  const src = String(soundBehavior?.soundPath ?? '').trim();
  if (!src) return;

  const rawVolume = Number(soundBehavior?.volume);
  const volume = Number.isFinite(rawVolume) ? Math.max(0, Math.min(1, rawVolume)) : 0.8;

  const AudioHelper = (globalThis as any).foundry?.audio?.AudioHelper;
  if (typeof AudioHelper?.play !== 'function') return;

  try {
    await AudioHelper.play({ src, volume, autoplay: true, loop: false }, true);
  } catch (err) {
    console.error(`Dorman Lakely's Tile Utilities | Could not play region sound "${src}"`, err);
  }
}

/**
 * Build the `em-tile-utilities.SoundEffect` data model class.
 *
 * @returns The class, or undefined when Foundry's base class is unavailable
 */
export function defineSoundRegionBehaviorType(): any {
  const Base = getRegionBehaviorTypeBase();
  const fields = getDataFields();
  if (!Base || !fields) return undefined;

  return class EMSoundRegionBehaviorType extends Base {
    static LOCALIZATION_PREFIXES = [SOUND_L];

    static defineSchema() {
      return {
        events: this._createEventsField({
          events: [
            'tokenEnter',
            'tokenExit',
            'tokenMoveIn',
            'tokenMoveOut',
            'tokenMoveWithin',
            'tokenTurnStart',
            'tokenTurnEnd',
            'tokenRoundStart',
            'tokenRoundEnd'
          ]
        }),
        soundPath: new fields.FilePathField({
          categories: ['AUDIO'],
          required: true,
          blank: true,
          initial: ''
        }),
        volume: new fields.NumberField({
          required: true,
          initial: 0.8,
          min: 0,
          max: 1,
          step: 0.01
        })
      };
    }

    async _handleRegionEvent(event: any): Promise<void> {
      await handleSoundRegionEvent(this, event);
    }
  };
}

export { EM_SOUND_TYPE };
