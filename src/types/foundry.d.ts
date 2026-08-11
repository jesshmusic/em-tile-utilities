// Basic Foundry VTT type definitions
declare global {
  const game: Game;
  const canvas: Canvas;
  const ui: UI;
  const foundry: Foundry;
  const Hooks: HooksManager;
  const PIXI: typeof PIXINamespace;

  // Foundry v14 removed the flat `loadTemplates`, `renderTemplate`,
  // `FilePicker`, `AudioHelper`, `SearchFilter` and `ContextMenu` globals.
  // They are deliberately NOT declared here so that any reintroduced usage
  // fails to typecheck instead of failing at runtime. Use the namespaced
  // equivalents on `foundry` below.
  //
  // `Dialog` / `Application` / `FormApplication` still exist as ApplicationV1
  // deprecation shims (removal targeted for v16) but the module is fully on
  // ApplicationV2, so they are not declared either.

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
