// Basic Foundry VTT type definitions
declare global {
  const game: Game;
  const canvas: Canvas;
  const ui: UI;
  const foundry: Foundry;
  const Hooks: HooksManager;
  const Dialog: typeof DialogClass;
  const FormDataExtended: typeof FormDataExtendedClass;
  const FilePicker: typeof FilePickerClass;
  const PIXI: typeof PIXINamespace;

  /**
   * Load and register Handlebars templates (including partials)
   */
  function loadTemplates(paths: string[]): Promise<void>;

  /**
   * Handlebars template engine
   */
  const Handlebars: {
    registerPartial(name: string, template: string): void;
    compile(template: string): (context: any) => string;
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
    };
    applications: {
      api: any;
    };
  }

  interface HooksManager {
    once(hook: string, fn: (...args: any[]) => void): void;
    on(hook: string, fn: (...args: any[]) => void): void;
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

  class DialogClass {
    constructor(data: DialogData, options?: any);
    render(force: boolean): void;
  }

  interface DialogData {
    title: string;
    content: string;
    buttons?: Record<string, DialogButton>;
    default?: string;
    render?: (html: JQuery) => void;
    close?: () => void;
  }

  interface DialogButton {
    icon?: string;
    label: string;
    callback?: (html: JQuery) => void | Promise<void>;
  }

  class FormDataExtendedClass {
    constructor(form: HTMLFormElement);
    object: Record<string, any>;
  }

  class FilePickerClass {
    constructor(options: FilePickerOptions);
    browse(): Promise<void>;
  }

  interface FilePickerOptions {
    type: string;
    current?: string;
    callback: (path: string) => void;
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
