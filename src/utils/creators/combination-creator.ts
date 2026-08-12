import { createBaseTileData } from '../builders/base-tile-builder';
import { createMonksConfig } from '../builders/monks-config-builder';
import {
  createActivateAction,
  createAnchorAction,
  createChangeDoorAction,
  createChatMessageAction,
  createCheckValueAction,
  createCheckVariableAction,
  createPlaySoundAction,
  createSetVariableAction,
  createShowDialogAction,
  createStopAction,
  createTriggerAction
} from '../actions';
import { generateUniqueEMTag, applyEMTags } from '../helpers/tag-helpers';
import { getGridSize, getDefaultPosition } from '../helpers/grid-helpers';

/** Landing the submit button jumps to. */
const CHECK_ANCHOR = 'em_combo_check';
/** Landing for a wrong answer. */
const FAIL_ANCHOR = 'em_combo_fail';
/** Landing for a wrong answer that is still within the attempt limit. */
const RETRY_ANCHOR = 'em_combo_retry';
/** Terminal landing. Also the `close` target, which MATT requires. */
const END_ANCHOR = 'em_combo_end';

/** Per-tile variable holding the number of wrong answers so far. */
const ATTEMPTS_VARIABLE = 'em_combo_attempts';

/** Configuration for {@link createCombinationTile}. */
export interface CombinationConfig {
  name: string;
  /** Tile artwork — the keypad, rune panel or riddle plaque on the map. */
  image: string;
  /** Question shown above the answer field. */
  prompt: string;
  /** Label on the answer field. */
  answerLabel?: string;
  /** The expected answer. */
  answer: string;
  /** Compare exactly, rather than case-insensitively. */
  caseSensitive?: boolean;
  /** Wrong answers allowed before the tile deactivates. Blank/0 = unlimited. */
  maxAttempts?: number | null;
  /** `click` or `dblclick`. */
  triggerOn?: 'click' | 'dblclick';
  successMessage: string;
  failureMessage: string;
  /** Shown once the attempt limit is spent. */
  lockoutMessage?: string;
  successSound?: string;
  failureSound?: string;
  /** Optional door to unlock on a correct answer. */
  wallId?: string;
  wallName?: string;
  unlockMode?: 'unlock' | 'open';
  /** Optional tile to trigger on a correct answer. */
  targetTileId?: string;
  targetTileName?: string;
  customTags?: string;
}

/**
 * Neutralise the two syntaxes MATT evaluates inside action values.
 *
 * `getValue` Handlebars-compiles anything containing `{{`
 * (../monks-active-tiles/monks-active-tiles.js:363-366) and then expands
 * `[[…]]` as an inline roll (monks-active-tiles.js:368-372). The `dialog`
 * action compiles its content *twice* on top of that (actions.js:6052 and
 * monks-active-tiles.js:1232). GM-authored prose has no business going through
 * either, and an unknown helper called with arguments makes Handlebars'
 * `helperMissing` throw, which aborts the whole action list.
 */
function stripTemplateSyntax(text: string): string {
  return String(text ?? '')
    .replace(/\{\{/g, '{ {')
    .replace(/\}\}/g, '} }')
    .replace(/\[\[/g, '[ [');
}

/** Escape text destined for the dialog's raw-HTML `content`. */
function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the `checkvalue` comparison expression for the answer.
 *
 * `getValue` in compare mode builds the JS source `<prop> <expression>` and
 * evals it, auto-quoting `prop` only because it is a string
 * (../monks-active-tiles/monks-active-tiles.js:410-412). The right-hand side is
 * passed through untouched whenever it starts with `==`/`>`/`<`/`!=` **or
 * merely contains `==`** — which is what lets a leading method call through:
 *
 * ```js
 * eval('"Rusty " ' + '.trim().toLowerCase() == "rusty"')  // true
 * ```
 *
 * That is the only way to get a case-insensitive comparison here. Handlebars
 * cannot help: MATT compiles action values against the global Handlebars
 * instance, where the only helpers are Foundry's own (`eq`/`ne`/`lt`/`gt`/
 * `lte`/`gte`/`not`/`and`/`or`, …), MATT's `selectGroups` and whatever the
 * system registers. There is no `lowercase`, no `default`, no `add`.
 *
 * The trailing quote also keeps the expression clear of `getValue`'s
 * `endsWith('true')` / `endsWith('false')` short-circuit
 * (monks-active-tiles.js:329-342), which would otherwise swallow the operator
 * whole for an answer of "true".
 */
export function buildAnswerComparison(answer: string, caseSensitive: boolean): string {
  const cleaned = stripTemplateSyntax(answer).trim();
  const normalized = caseSensitive ? cleaned : cleaned.toLowerCase();
  const escaped = normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return caseSensitive ? `.trim() == "${escaped}"` : `.trim().toLowerCase() == "${escaped}"`;
}

/** Build the dialog's HTML body: the prompt plus one named answer field. */
export function buildPromptContent(prompt: string, answerLabel: string): string {
  return [
    `<p class="em-combo-prompt">${escapeHtml(stripTemplateSyntax(prompt))}</p>`,
    '<div class="form-group">',
    `<label for="em-combo-answer">${escapeHtml(stripTemplateSyntax(answerLabel))}</label>`,
    '<div class="form-fields">',
    '<input type="text" id="em-combo-answer" name="answer" value="" autocomplete="off" />',
    '</div>',
    '</div>'
  ].join('');
}

/**
 * Build the MATT action list for a combination lock.
 *
 * Exported for the tests — as with the lock, these actions *are* the feature,
 * and a wrong `data` key produces a tile that looks fine and does nothing.
 *
 * ```text
 *   dialog      <prompt + input name="answer">   submit -> em_combo_check
 *                                                close  -> em_combo_end
 *   anchor      em_combo_check
 *   checkvalue  answer <expr>                    fail   -> em_combo_fail
 *   setvariable em_combo_attempts "_null"        (clear the counter)
 *   chatmessage / playsound / changedoor / trigger
 *   stop
 *   anchor      em_combo_fail
 *   setvariable   em_combo_attempts "+ 1"        (limited attempts only)
 *   checkvariable em_combo_attempts ">= n"       fail -> em_combo_retry
 *   chatmessage <lockout>
 *   activate    this tile -> deactivate
 *   stop
 *   anchor      em_combo_retry
 *   chatmessage / playsound
 *   anchor      em_combo_end
 * ```
 */
export function buildCombinationActions(sceneId: string, config: CombinationConfig): any[] {
  const actions: any[] = [];
  const limit = Number(config.maxAttempts ?? 0);
  const limited = Number.isFinite(limit) && limit > 0;

  actions.push(
    createShowDialogAction({
      title: config.name,
      content: buildPromptContent(config.prompt, config.answerLabel || 'Answer'),
      buttons: [
        {
          name: 'Submit',
          goto: CHECK_ANCHOR,
          icon: 'fas fa-key',
          // Only a submit button harvests the dialog's own form into `value`.
          submit: true
        }
      ],
      // Never leave this blank: a null resolve makes runActions re-run the
      // dialog action forever.
      close: END_ANCHOR
    })
  );

  actions.push(createAnchorAction(CHECK_ANCHOR, false));
  actions.push(
    createCheckValueAction(
      'answer',
      buildAnswerComparison(config.answer, config.caseSensitive === true),
      FAIL_ANCHOR
    )
  );

  /* ---------- correct ---------- */

  if (limited) {
    // MATT's `_null` sentinel, emitted quoted. The literal string "null" is
    // eval'd into a live value and clears nothing
    // (../monks-active-tiles/actions.js:6640-6646).
    actions.push(createSetVariableAction(ATTEMPTS_VARIABLE, '"_null"'));
  }
  if (config.successMessage) {
    actions.push(createChatMessageAction(config.successMessage));
  }
  if (config.successSound) {
    actions.push(createPlaySoundAction(config.successSound));
  }
  if (config.wallId) {
    actions.push(
      createChangeDoorAction(
        `Scene.${sceneId}.Wall.${config.wallId}`,
        config.unlockMode === 'open' ? 'OPEN' : 'CLOSED'
      )
    );
  }
  if (config.targetTileId) {
    actions.push(
      createTriggerAction(`Scene.${sceneId}.Tile.${config.targetTileId}`, {
        entityName: config.targetTileName || 'Target Tile'
      })
    );
  }
  actions.push(createStopAction());

  /* ---------- wrong ---------- */

  actions.push(createAnchorAction(FAIL_ANCHOR, false));

  if (limited) {
    // Arithmetic is MATT's `+ n` increment syntax, not a Handlebars helper:
    // an unset variable is seeded to 0 first (actions.js:6638).
    actions.push(createSetVariableAction(ATTEMPTS_VARIABLE, '+ 1'));
    // The comparison lives in `value`; `type` is an aggregation across the
    // resolved entities and only accepts all | any | none.
    actions.push(createCheckVariableAction(ATTEMPTS_VARIABLE, `>= ${limit}`, RETRY_ANCHOR, 'all'));

    if (config.lockoutMessage) {
      actions.push(createChatMessageAction(config.lockoutMessage));
    }
    if (config.failureSound) {
      actions.push(createPlaySoundAction(config.failureSound));
    }
    actions.push(
      createActivateAction('tile', 'deactivate', {
        collection: 'tiles',
        entityName: 'This Tile'
      })
    );
    actions.push(createStopAction());
    actions.push(createAnchorAction(RETRY_ANCHOR, false));
  }

  if (config.failureMessage) {
    actions.push(createChatMessageAction(config.failureMessage));
  }
  if (config.failureSound) {
    actions.push(createPlaySoundAction(config.failureSound));
  }

  actions.push(createAnchorAction(END_ANCHOR, false));

  return actions;
}

/**
 * Create a combination-lock tile: a clickable panel that asks a question and
 * acts on the answer.
 *
 * This is built on MATT's `dialog` action, whose submit buttons harvest their
 * own form with `FormDataExtended` and merge the result into the running
 * `value` (../monks-active-tiles/monks-active-tiles.js:1249-1257). An
 * `<input name="answer">` in the dialog content therefore arrives at
 * `value.answer`, flat and top-level, where a `checkvalue` on `answer` can
 * compare it. That combination — a keypad, a riddle, a rune order — needs no
 * code generation and no custom action.
 *
 * @param scene - Scene to create the tile in
 * @param config - Combination configuration
 * @param x - X position (defaults to scene centre)
 * @param y - Y position (defaults to scene centre)
 */
export async function createCombinationTile(
  scene: Scene,
  config: CombinationConfig,
  x?: number,
  y?: number
): Promise<void> {
  const gridSize = getGridSize();
  const position = getDefaultPosition(x, y);

  const baseTile = createBaseTileData({
    textureSrc: config.image,
    width: gridSize,
    height: gridSize,
    x: position.x,
    y: position.y
  });

  const monksFlags = createMonksConfig({
    name: config.name,
    active: true,
    trigger: [config.triggerOn === 'click' ? 'click' : 'dblclick'],
    pointer: true,
    actions: buildCombinationActions(scene.id, config)
  });

  const [tile] = await scene.createEmbeddedDocuments('Tile', [
    { ...baseTile, name: config.name, flags: monksFlags }
  ]);

  await applyEMTags(tile, generateUniqueEMTag(config.name), {
    extraTags: ['EM_Combination'],
    customTags: config.customTags
  });
}
