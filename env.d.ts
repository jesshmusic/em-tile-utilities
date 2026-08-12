/**
 * Compile-time constants injected by Vite's `define` (see vite.config.ts) and
 * mirrored into Jest via `globals` (see jest.config.js).
 *
 * Prefer these over `import packageInfo from '../package.json'` /
 * `import buildInfo from '../build-info.json'`: the build-info.json import is
 * the only reason that generated, constantly-churning file has to stay tracked
 * in git.
 */
declare const __MODULE_VERSION__: string;
declare const __BUILD_NUMBER__: number;
