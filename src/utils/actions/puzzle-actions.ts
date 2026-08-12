/**
 * Action builders for the two lock puzzles: `inventory`, `checkvalue`,
 * `dialog` and `goto`.
 *
 * All four are Monk's Active Tiles primitives this module had never emitted
 * before, so every claim below is cited against MATT 14.01 rather than
 * inferred.
 */

/** Which tokens an `inventory` filter searches. */
export type InventoryScope = 'token' | 'players';

/**
 * Entity descriptor for an `inventory` filter's scope.
 *
 * `inventory.ctrls[0].options.show` is `['token', 'within', 'players',
 * 'previous', 'tagger']` (../monks-active-tiles/actions.js:7601-7612), and
 * `getEntities` resolves the bare ids `token` (the triggering tokens) and
 * `players` (every player-owned token in the scene).
 */
function inventoryEntity(scope: InventoryScope): { id: string; name: string } {
  return scope === 'players'
    ? { id: 'players', name: 'Player Tokens' }
    : { id: 'token', name: 'Triggering Token' };
}

/**
 * Create an `inventory` filter action — "keep only the tokens carrying <item>".
 *
 * Verified against MATT 14.01 (../monks-active-tiles/actions.js:7599-7690):
 *
 *  - `data.item` is matched case-insensitively against `actor.items[].name`
 *    after trimming. `*` and `?` are honoured as wildcards, but **only when the
 *    string literally contains one** — otherwise it is an exact
 *    `localeCompare` match (actions.js:7648-7659).
 *  - `data.count` is a *comparison expression* run against the number of
 *    matching items via `getValue(..., { operation: 'compare' })`, not a
 *    number. `fn` falls back to `"= 1"` when it is absent, which is not the
 *    `"> 0"` the ctrl's `defvalue` and the summary line both claim — so always
 *    write it explicitly.
 *  - `data.quantity` is dnd5e-only and compares `item.system.quantity`.
 *
 * **This action does not branch.** It returns `{ tokens, items }` with no
 * `continue` and no `goto` (actions.js:7681), and `runActions` only stops on
 * `result.continue === false` (../monks-active-tiles/monks-active-tiles.js:5186).
 * A filter that matches nothing therefore falls straight through to the next
 * action with an empty `value.tokens`. Pair it with
 * `createCheckValueAction('tokens.length', '> 0', failAnchor)` to get the
 * "you do not have the key" branch.
 *
 * @param itemName - Item name to look for, wildcards allowed
 * @param options.scope - Which tokens to search (default the triggering token)
 * @param options.count - Comparison expression against the match count
 * @param options.quantity - dnd5e-only comparison against `system.quantity`
 */
export function createInventoryFilterAction(
  itemName: string,
  options: { scope?: InventoryScope; count?: string; quantity?: string } = {}
): any {
  return {
    action: 'inventory',
    data: {
      entity: inventoryEntity(options.scope ?? 'token'),
      item: itemName,
      count: options.count ?? '> 0',
      quantity: options.quantity ?? ''
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a `checkvalue` action — branch on a property of the running context.
 *
 * Verified against MATT 14.01 (../monks-active-tiles/actions.js:7899-7938):
 *
 * ```js
 * let prop = foundry.utils.getProperty(value, name) ?? foundry.utils.getProperty(args, name);
 * let cando = await getValue(action.data?.value, args, null, { prop, operation: 'compare' });
 * if (cando) return { continue: true };
 * return { continue: !!fail, goto: fail };
 * ```
 *
 * So `name` is a dotted path into the accumulated `value` object — `answer` for
 * a field submitted by a `dialog`, `tokens.length` for the size of the last
 * filter's result — and `value` is a comparison expression, *not* a literal.
 * With no `fail` anchor a mismatch halts the action list outright.
 *
 * @param name - Dotted path into `value` (falling back to the whole args object)
 * @param value - Comparison expression, e.g. `'> 0'` or `'== "gold"'`
 * @param failAnchor - Landing tag to jump to when the comparison is false
 */
export function createCheckValueAction(name: string, value: string, failAnchor?: string): any {
  return {
    action: 'checkvalue',
    data: {
      name,
      value,
      fail: failAnchor ?? ''
    },
    id: foundry.utils.randomID()
  };
}

/** One button in a custom `dialog` action. */
export interface DialogButton {
  /** Button label. MATT maps this onto DialogV2's `label`. */
  name: string;
  /** Landing tag to jump to when pressed. */
  goto: string;
  /** Font Awesome class string, e.g. `fas fa-key`. */
  icon?: string;
  /** Harvest the dialog's own form into `value` before jumping. */
  submit?: boolean;
}

/**
 * Create a `dialog` action.
 *
 * Verified against MATT 14.01 (../monks-active-tiles/actions.js:5894-6133 and
 * `_showDialog`, ../monks-active-tiles/monks-active-tiles.js:1219-1332):
 *
 *  - `content` is raw HTML that is Handlebars-compiled **twice** — once in the
 *    action's `fn` (actions.js:6052-6055) and again inside `_showDialog`
 *    (monks-active-tiles.js:1232). It is never `enrichHTML`'d, so `@UUID[…]`
 *    links and inline rolls do not resolve. Callers must strip `{{` from any
 *    GM-authored text they interpolate.
 *  - A button stored as `{ id, name, goto, icon, submit }` (the exact fields
 *    of ../monks-active-tiles/templates/button-edit.html) becomes a DialogV2
 *    button of `type: "submit"` when `submit` is set
 *    (monks-active-tiles.js:1246). **Only a submit button harvests the form**:
 *    `new FormDataExtended(button.form).object` is merged into the callback's
 *    result and into `context.value` (monks-active-tiles.js:1252-1256), so an
 *    `<input name="answer">` in `content` lands at `value.answer`, flat and
 *    top-level, readable downstream as `{{value.answer}}`.
 *  - A button with **no** `goto` sets `continue: false` and stops the action
 *    list (monks-active-tiles.js:1267-1268). Always give one a landing.
 *  - `close` is mandatory in practice: `_showDialog` resolves `null` when it is
 *    blank (monks-active-tiles.js:1326-1327), and `runActions` treats a null
 *    resume as "no result yet" and re-invokes the action's `fn`
 *    (monks-active-tiles.js:5096) — i.e. the dialog reopens forever.
 *
 * @param config.buttons - Custom buttons; forces `dialogtype: 'custom'`
 */
export function createShowDialogAction(config: {
  title: string;
  content: string;
  buttons: DialogButton[];
  /** Landing tag used when the dialog is dismissed without a button. */
  close: string;
  /** MATT `showto` audience; defaults to the triggering user. */
  showto?: string;
  width?: string;
  height?: string;
  classes?: string;
}): any {
  return {
    action: 'dialog',
    data: {
      dialogtype: 'custom',
      id: '',
      title: config.title,
      showto: config.showto ?? 'trigger',
      content: config.content,
      file: '',
      classes: config.classes ?? '',
      width: config.width ?? '',
      height: config.height ?? '',
      yes: '',
      no: '',
      close: config.close,
      buttons: config.buttons.map(button => ({
        id: foundry.utils.randomID(),
        name: button.name,
        goto: button.goto,
        icon: button.icon ?? '',
        submit: button.submit ?? false
      }))
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a `goto` action — jump to a landing.
 *
 * `runActions` finds the matching `anchor` by exact `data.tag` equality and
 * sets `i = idx` before the loop's own `i++`
 * (../monks-active-tiles/monks-active-tiles.js:5167-5177), so the anchor's own
 * `fn` never runs on a landing and its `stop` flag only affects fall-through.
 *
 * @param tag - Landing tag to jump to
 */
export function createJumpAction(tag: string): any {
  return {
    action: 'goto',
    data: { tag, limit: '', resume: false },
    id: foundry.utils.randomID()
  };
}
