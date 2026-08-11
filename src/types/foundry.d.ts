// Basic Foundry VTT type definitions
declare global {
  const game: Game;
  const canvas: Canvas;
  const ui: UI;
  const foundry: Foundry;
  const Hooks: HooksManager;
  const PIXI: typeof PIXINamespace;

  const CONST: {
    /**
     * Bit flags for canvas.grid.getSnappedPoint({ mode }).
     * These are NOT sequential — using literal numbers here is how the
     * module previously ended up snapping to edge midpoints while a comment
     * claimed it was snapping to corners.
     */
    GRID_SNAPPING_MODES: {
      CENTER: number;
      EDGE_MIDPOINT: number;
      TOP_LEFT_VERTEX: number;
      TOP_RIGHT_VERTEX: number;
      BOTTOM_LEFT_VERTEX: number;
      BOTTOM_RIGHT_VERTEX: number;
      VERTEX: number;
      TOP_LEFT_CORNER: number;
      CORNER: number;
      SIDE_MIDPOINT: number;
      [key: string]: number;
    };
    [key: string]: any;
  };

  // Verified against Foundry 14.364:
  //
  // `AudioHelper` is GONE from the global scope — it is absent from both the
  // Object.assign(globalThis, …) block and the addBackwardsCompatibilityReferences
  // table, so `AudioHelper.play(...)` is a hard ReferenceError.
  //
  // `loadTemplates`, `renderTemplate`, `getTemplate`, `FilePicker`,
  // `SearchFilter`, `ContextMenu` and `TextEditor` still resolve, but only via
  // addBackwardsCompatibilityReferences getters marked "since 13, until 15":
  // each access logs a deprecation warning and they stop working in v15.
  // `Dialog` / `Application` / `FormApplication` are ApplicationV1 shims,
  // deprecated until v16.
  //
  // None of them are declared here, deliberately: reintroducing one should
  // fail typecheck rather than quietly re-adding a deprecation or a v15
  // time bomb. Use the namespaced equivalents on `foundry` below.

  /**
   * Handlebars template engine — still a genuine global in v14.
   */
  const Handlebars: {
    registerPartial(name: string, template: string): void;
    compile(template: string): (context: any) => string;
    partials: Record<string, unknown>;
  };

  interface Game {
    modules: Collection<Module>;
    settings: ClientSettings;
    scenes?: Collection<Scene>;
    i18n: {
      localize(key: string): string;
    };
  }

  interface Canvas {
    scene: Scene;
    stage: any;
  }

  interface UI {
    notifications: Notifications;
  }

  interface Notifications {
    info(message: string, options?: { permanent?: boolean }): void;
    warn(message: string, options?: { permanent?: boolean }): void;
    error(message: string, options?: { permanent?: boolean }): void;
  }

  interface Foundry {
    utils: {
      randomID(): string;
      [key: string]: any;
    };
    applications: {
      api: any;
      /** v14 home of loadTemplates/renderTemplate/getTemplate */
      handlebars: {
        /**
         * Pass an array of paths to preload, or a Record of partial ID -> path
         * to preload *and* register each as a named Handlebars partial.
         */
        loadTemplates(paths: string[] | Record<string, string>): Promise<unknown[]>;
        renderTemplate(path: string, data: object): Promise<string>;
        getTemplate(path: string, id?: string): Promise<(context: any) => string>;
      };
      /** v14 home of FilePicker */
      apps: any;
      [key: string]: any;
    };
    /** v14 home of AudioHelper */
    audio: any;
    [key: string]: any;
  }

  interface HooksManager {
    once(hook: string, fn: (...args: any[]) => void): number;
    on(hook: string, fn: (...args: any[]) => void): number;
    off(hook: string, id: number): void;
  }

  interface Module {
    active: boolean;
  }

  interface Collection<T> {
    get(id: string): T | undefined;
    filter(fn: (item: T) => boolean): T[];
  }

  interface ClientSettings {
    register(module: string, key: string, options: any): void;
    registerMenu(module: string, key: string, options: any): void;
    get(module: string, key: string): any;
    set(module: string, key: string, value: any): Promise<any>;
  }

  interface Scene {
    id: string;
    name: string;
    tiles: Collection<Tile>;
    walls: Collection<any>;
    dimensions: {
      sceneWidth: number;
      sceneHeight: number;
    };
    createEmbeddedDocuments(type: string, data: any[]): Promise<any>;
  }

  interface Tile {
    id: string;
    name: string;
    hidden: boolean;
    rotation: number;
    x: number;
    y: number;
    texture: {
      src: string;
    };
    flags: {
      [key: string]: any;
    };
  }

  // PIXI types
  namespace PIXINamespace {
    class Graphics {
      clear(): this;
      lineStyle(width: number, color: number, alpha?: number): this;
      drawRect(x: number, y: number, width: number, height: number): this;
    }
  }

  type JQuery = any;
}

export {};
