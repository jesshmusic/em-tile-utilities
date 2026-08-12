/**
 * `em-tile-utilities.Trap` — this module's own damaging trap region behavior.
 *
 * Field-for-field compatible with Enhanced Region Behaviors' `Trap`
 * (../enhanced-region-behavior/dist/enhanced-region-behavior.mjs:73-247): every
 * key ERB has, this has, spelled the same way. That is deliberate. It means an
 * existing ERB trap's `_source` is a valid source for this type, so a GM (or a
 * future migration) can retype a behavior without remapping any data, and it
 * means the two never disagree about what "savedDamage" means.
 *
 * What it adds over ERB
 * ---------------------
 * - `properties` — damage BYPASS ids (`mgc`, `sil`, `ada`). ERB always passes
 *   an empty `Set`, so an ERB trap can never bypass non-magical resistance.
 *   The tile-trap path has had these since v2.2.0; this closes the gap.
 * - Works outside dnd5e. ERB registers its Trap only when `game.system.id`
 *   is `dnd5e` (enhanced-region-behavior.mjs:993-996) and hard-refuses any
 *   actor that is not a character or npc (mjs:102-108). This rolls a save when
 *   the actor can roll one and otherwise applies the unsaved damage, so a trap
 *   region degrades instead of silently doing nothing.
 * - Damage lands through the same `applyRolledDamage` the custom
 *   `em-tile-utilities.applydamage` tile action uses, so a tile trap and a
 *   region trap dealing 2d6 fire behave identically.
 */

import { DEFAULT_DAMAGE_TYPE, getDamageTypeMap } from '../helpers/damage-types';
import { getDamagePropertyOptions, toDamagePropertySet } from '../helpers/damage-properties';
import { applyRolledDamage, rollDamageTotal } from '../helpers/damage-application';
import { localize } from '../helpers/localize';
import {
  ALL_TOKEN_REGION_EVENTS,
  EM_TRAP_TYPE,
  REGION_L,
  getDataFields,
  getRegionBehaviorTypeBase,
  toArray
} from './constants';

/** Localization prefix for the Trap data model's field labels and messages. */
export const TRAP_L = `${REGION_L}.Trap`;

/**
 * dnd5e ability ids as a `Record<id, label>` for a schema `choices` callback.
 *
 * A function, never a literal: `defineSchema` runs during `init`, before
 * `CONFIG.DND5E` is populated. Foundry calls `choices` lazily when the field is
 * validated or rendered, by which time it is.
 *
 * Returns an EMPTY object outside dnd5e, and a `StringField` with no usable
 * choices would reject every value — so the field below only sets `choices`
 * when there are some. That is the difference between a trap region that works
 * on Pathfinder and one that cannot be created at all.
 */
function abilityChoices(): Record<string, string> {
  const abilities = (globalThis as any).CONFIG?.DND5E?.abilities;
  if (!abilities || typeof abilities !== 'object') return {};
  return Object.fromEntries(
    Object.entries(abilities as Record<string, any>).map(([id, cfg]) => [
      id,
      cfg?.label ?? cfg?.abbreviation ?? id
    ])
  );
}

/** dnd5e skill ids as a `Record<id, label>`. See `abilityChoices`. */
function skillChoices(): Record<string, string> {
  const skills = (globalThis as any).CONFIG?.DND5E?.skills;
  if (!skills || typeof skills !== 'object') return {};
  return Object.fromEntries(
    Object.entries(skills as Record<string, any>).map(([id, cfg]) => [id, cfg?.label ?? id])
  );
}

/** Damage bypass ids as a `Record<id, label>`, sourced from the system. */
function propertyChoices(): Record<string, string> {
  return Object.fromEntries(getDamagePropertyOptions().map(({ value, label }) => [value, label]));
}

/**
 * Substitute `{name}`, `{damage}` and `{type}` into a GM-authored message.
 *
 * Same shape and same regex as ERB's `interpolate`
 * (enhanced-region-behavior.mjs:241-246), so messages copied off an existing
 * trap keep working verbatim.
 *
 * @param template - The GM's message, possibly containing `{placeholders}`
 * @param data - Values to substitute; an unknown key is left untouched
 * @returns The interpolated message
 */
export function interpolateTrapMessage(template: string, data: Record<string, string>): string {
  return template.replace(/\{(\w+)}/g, (full, key: string) => data[key] ?? full);
}

/**
 * Ask the player which ability or skill to roll, when the trap offers more than
 * one. Mirrors ERB's DialogV2 prompt (enhanced-region-behavior.mjs:117-133).
 *
 * @param options - Candidate ids
 * @param labels - `Record<id, label>` to render the buttons with
 * @param title - Dialog window title
 * @param content - Dialog body text
 * @returns The chosen id, or the first option if the dialog is unavailable
 */
async function chooseRoll(
  options: string[],
  labels: Record<string, string>,
  title: string,
  content: string
): Promise<string> {
  if (options.length <= 1) return options[0];
  const DialogV2 = (globalThis as any).foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return options[0];
  try {
    const choice = await DialogV2.wait({
      window: { title },
      content,
      buttons: options.map(id => ({ label: labels[id] ?? id, action: id }))
    });
    return typeof choice === 'string' && choice ? choice : options[0];
  } catch {
    // A dismissed dialog rejects. Falling back to the first option keeps the
    // trap firing rather than swallowing it on an accidental Escape.
    return options[0];
  }
}

/**
 * Roll the trap's saving throw or ability check.
 *
 * dnd5e 5.3 exposes `Actor5e#rollSavingThrow({ability})` and
 * `Actor5e#rollSkill({skill})`, both of which resolve to an ARRAY of rolls
 * (ERB reads `[0].total`, enhanced-region-behavior.mjs:139 and :156). Other
 * systems have neither, which is reported as `null` rather than as a failed
 * roll so the caller can tell "rolled badly" from "cannot roll".
 *
 * @returns The roll total, or null when the actor cannot make this roll
 */
async function rollTrapCheck(
  actor: any,
  abilities: string[],
  skills: string[]
): Promise<number | null> {
  const readTotal = (result: any): number | null => {
    const total = Array.isArray(result) ? result[0]?.total : result?.total;
    return Number.isFinite(Number(total)) ? Number(total) : null;
  };

  if (abilities.length && typeof actor?.rollSavingThrow === 'function') {
    const ability = await chooseRoll(
      abilities,
      abilityChoices(),
      localize(`${TRAP_L}.DialogTitle`),
      localize(`${TRAP_L}.ChooseAbility`)
    );
    return readTotal(await actor.rollSavingThrow({ ability }));
  }

  if (skills.length && typeof actor?.rollSkill === 'function') {
    const skill = await chooseRoll(
      skills,
      skillChoices(),
      localize(`${TRAP_L}.DialogTitle`),
      localize(`${TRAP_L}.ChooseSkill`)
    );
    return readTotal(await actor.rollSkill({ skill }));
  }

  return null;
}

/**
 * Evaluate the DC, which may itself be a formula.
 *
 * ERB rolls it (`new Roll(String(this.saveDC)).evaluate()`,
 * enhanced-region-behavior.mjs:151) so a GM can write `10 + 1d4` for a
 * variable trap. Kept, with a numeric fast path so the common case does not
 * construct a Roll.
 *
 * @param saveDC - A number or a roll formula
 * @returns The evaluated DC, or 0 when it cannot be evaluated
 */
async function evaluateSaveDC(saveDC: unknown): Promise<number> {
  const asNumber = Number(saveDC);
  if (Number.isFinite(asNumber)) return asNumber;

  const RollClass = (globalThis as any).Roll;
  if (typeof RollClass !== 'function') return 0;
  try {
    const roll = await new RollClass(String(saveDC)).evaluate();
    const total = Number(roll?.total);
    return Number.isFinite(total) ? total : 0;
  } catch (err) {
    console.error(`Dorman Lakely's Tile Utilities | Could not evaluate trap DC "${saveDC}"`, err);
    return 0;
  }
}

/**
 * Forward the event to the behaviors listed in a chaining field.
 *
 * `behavior.system._handleRegionEvent(event)` is ERB's own chaining call
 * (enhanced-region-behavior.mjs:220-233) and the same entry point this
 * module's movement filter uses, so a chained behavior may belong to either
 * module or to Foundry core.
 *
 * @param uuids - RegionBehavior UUIDs
 * @param event - The region event to replay
 */
async function chainBehaviors(uuids: string[], event: any): Promise<void> {
  const fromUuid = (globalThis as any).fromUuid;
  if (typeof fromUuid !== 'function') return;
  for (const uuid of uuids) {
    try {
      const behavior = await fromUuid(uuid);
      await behavior?.system?._handleRegionEvent?.(event);
    } catch (err) {
      console.error(
        `Dorman Lakely's Tile Utilities | Could not chain region behavior ${uuid}`,
        err
      );
    }
  }
}

/**
 * The trap's event handler, written as a free function taking the behavior as
 * its first argument rather than as a method on `this`.
 *
 * That shape is what makes it testable: the unit suite can call it with a plain
 * object standing in for the data model, with no Foundry DataModel machinery,
 * and assert on what reaches `applyDamage`. The class below is a three-line
 * wrapper.
 *
 * `event.user.isSelf` gates the whole thing, matching ERB and Foundry's own
 * `changeLevel` (client/data/region-behaviors/change-level.mjs:58-59): region
 * events are broadcast to every connected client, and without the guard a
 * four-player table would roll and apply the trap four times.
 *
 * @param trap - The behavior's data model (or a test double with its fields)
 * @param event - The region event
 */
export async function handleTrapRegionEvent(trap: any, event: any): Promise<void> {
  if (event?.user && event.user.isSelf === false) return;

  const token = event?.data?.token;
  const actor = token?.actor;
  if (!actor) return;

  const abilities = toArray(trap?.saveAbility);
  const skills = toArray(trap?.skillChecks);

  // null means "this actor cannot make the roll" — no save was possible, so the
  // trap simply hits. ERB skipped the actor entirely here; a trap that silently
  // does nothing is the worse failure.
  const checkTotal = await rollTrapCheck(actor, abilities, skills);
  const dc = await evaluateSaveDC(trap?.saveDC);
  const saved = checkTotal !== null && checkTotal >= dc;

  const formula = String((saved ? trap?.savedDamage : trap?.damage) ?? '').trim();
  const damageType = String(trap?.damageType || DEFAULT_DAMAGE_TYPE);

  let total: number | undefined;
  if (formula) {
    total = await rollDamageTotal(formula, actor.getRollData?.() ?? {}, damageType, {
      post: true,
      flavor: localize(`${TRAP_L}.DamageRoll`),
      speaker: (globalThis as any).ChatMessage?.getSpeaker?.({ token, actor })
    });
  }

  if (trap?.automateDamage !== false && total !== undefined && total > 0) {
    try {
      await applyRolledDamage(
        token,
        actor,
        total,
        damageType,
        toDamagePropertySet(toArray(trap?.properties))
      );
    } catch (err) {
      console.error(
        `Dorman Lakely's Tile Utilities | Could not apply ${damageType} trap damage to ${actor.name}`,
        err
      );
    }
  }

  const message = String((saved ? trap?.saveSucceededMessage : trap?.saveFailedMessage) ?? '');
  const ChatMessageClass = (globalThis as any).ChatMessage;
  if (message && ChatMessageClass?.create) {
    const typeLabel = getDamageTypeMap()[damageType] ?? damageType;
    void ChatMessageClass.create({
      content: interpolateTrapMessage(message, {
        name: token?.name ?? actor.name ?? '',
        damage: String(total ?? 0),
        type: typeLabel
      }),
      speaker: ChatMessageClass.getSpeaker?.({ token })
    });
  }

  await chainBehaviors(
    toArray(saved ? trap?.triggerBehaviorOnSave : trap?.triggerBehaviorOnFail),
    event
  );
}

/**
 * Build the `em-tile-utilities.Trap` data model class.
 *
 * Called from `registerEmRegionBehaviors()` during `init`, never at import
 * time — see `getRegionBehaviorTypeBase`.
 *
 * @returns The class, or undefined when Foundry's base class is unavailable
 */
export function defineTrapRegionBehaviorType(): any {
  const Base = getRegionBehaviorTypeBase();
  const fields = getDataFields();
  if (!Base || !fields) return undefined;

  /**
   * `choices` is attached only when the running system actually supplies some.
   * A `StringField` whose `choices` resolve to `{}` rejects every value, which
   * would make the behavior uncreatable outside dnd5e.
   */
  const optionalChoices = (getChoices: () => Record<string, string>) => {
    const options: Record<string, unknown> = { required: false, blank: false };
    options.choices = () => {
      const choices = getChoices();
      return Object.keys(choices).length ? choices : undefined;
    };
    return options;
  };

  return class EMTrapRegionBehaviorType extends Base {
    static LOCALIZATION_PREFIXES = [TRAP_L];

    static defineSchema() {
      return {
        events: this._createEventsField({ events: [...ALL_TOKEN_REGION_EVENTS] }),
        automateDamage: new fields.BooleanField({ required: true, initial: true }),
        // A StringField, not a NumberField: `evaluateSaveDC` accepts a formula
        // so a GM can write `10 + 1d4`. ERB stores a number and rolls
        // `String(this.saveDC)` anyway, so this is the honest type for it and
        // still reads a plain "15" identically.
        saveDC: new fields.StringField({ required: true, blank: false, initial: '15' }),
        saveAbility: new fields.SetField(new fields.StringField(optionalChoices(abilityChoices)), {
          initial: ['dex']
        }),
        skillChecks: new fields.SetField(new fields.StringField(optionalChoices(skillChoices))),
        damage: new fields.StringField({ required: true, blank: false, initial: '2d6' }),
        // Blank is meaningful and is the module's own default: "no damage on a
        // successful save". ERB initialises this to `1d6` and marks it
        // non-blank, which is why a half-damage-free trap could not be built
        // there.
        savedDamage: new fields.StringField({ required: true, blank: true, initial: '' }),
        damageType: new fields.StringField({
          required: true,
          blank: false,
          initial: DEFAULT_DAMAGE_TYPE,
          choices: () => getDamageTypeMap()
        }),
        properties: new fields.SetField(new fields.StringField(optionalChoices(propertyChoices))),
        saveFailedMessage: new fields.StringField({
          required: true,
          blank: true,
          initial: () => localize(`${TRAP_L}.DefaultFailedMessage`)
        }),
        saveSucceededMessage: new fields.StringField({
          required: true,
          blank: true,
          initial: () => localize(`${TRAP_L}.DefaultSucceededMessage`)
        }),
        triggerBehaviorOnSave: new fields.SetField(
          new fields.DocumentUUIDField({ type: 'RegionBehavior', required: false })
        ),
        triggerBehaviorOnFail: new fields.SetField(
          new fields.DocumentUUIDField({ type: 'RegionBehavior', required: false })
        )
      };
    }

    async _handleRegionEvent(event: any): Promise<void> {
      await handleTrapRegionEvent(this, event);
    }
  };
}

/** The subtype id, re-exported so callers need only one import. */
export { EM_TRAP_TYPE };
