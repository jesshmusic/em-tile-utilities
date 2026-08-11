import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

/**
 * Read + increment the local build counter, returning the new number.
 * (Converted from rollup-plugin-increment-build.mjs)
 */
function bumpBuildNumber(): number {
  const buildInfoPath = resolve('build-info.json');

  let buildInfo: { buildNumber: number } = { buildNumber: 0 };

  if (fs.existsSync(buildInfoPath)) {
    const content = fs.readFileSync(buildInfoPath, 'utf-8');
    try {
      buildInfo = JSON.parse(content);
      if (typeof buildInfo.buildNumber !== 'number') {
        console.warn(
          'build-info.json is missing a valid buildNumber property. Resetting build number to 0.'
        );
        buildInfo = { buildNumber: 0 };
      }
    } catch (err) {
      console.error(
        `Error parsing ${buildInfoPath}: ${(err as Error).message}. Resetting build number to 0.`
      );
      buildInfo = { buildNumber: 0 };
    }
  }

  buildInfo.buildNumber = (buildInfo.buildNumber || 0) + 1;
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

  return buildInfo.buildNumber;
}

/**
 * Increments the build counter and exposes the version + build number as
 * compile-time constants.
 *
 * This runs in the `config()` hook rather than `buildStart()` on purpose:
 * `define` values have to exist before the build starts, and doing the bump
 * once per config resolution (instead of once per rollup rebuild) also stops
 * `npm run watch` from rewriting build-info.json on every keystroke.
 *
 * `__MODULE_VERSION__` / `__BUILD_NUMBER__` exist so that src/main.ts can stop
 * doing `import packageInfo from '../package.json'` and
 * `import buildInfo from '../build-info.json'`.
 *
 * (Checked: those imports do NOT bloat the bundle - @rollup/plugin-json
 * tree-shakes them down to the two scalars actually referenced, and no
 * devDependencies reach dist/main.js.) The reason to drop them is different:
 * the build-info.json import is the only thing forcing that generated,
 * churn-on-every-build file to stay git-tracked, which makes it a recurring
 * merge-conflict source.
 */
function buildInfoPlugin(): Plugin {
  return {
    name: 'em-tile-utilities:build-info',
    config() {
      const buildNumber = bumpBuildNumber();
      const version = JSON.parse(
        fs.readFileSync(resolve('package.json'), 'utf-8')
      ).version as string;

      console.log(`Building v${version} (build #${buildNumber})`);

      return {
        define: {
          __MODULE_VERSION__: JSON.stringify(version),
          __BUILD_NUMBER__: JSON.stringify(buildNumber)
        }
      };
    }
  };
}

export default defineConfig({
  build: {
    // Output configuration
    outDir: 'dist',
    // Wipe dist/ before each build. Everything in dist/ is generated (main.js
    // + main.js.map); nothing is hand-placed there, and Foundry loads
    // dist/main.js from this folder as declared by module.json's `scripts`.
    // Leaving this false is what let a stale `tsc` emit (main.d.ts, dialogs/,
    // types/, utils/) sit in dist/ long after the Vite migration, and would
    // equally let a renamed/deleted entry keep shipping in module.zip.
    emptyOutDir: true,
    sourcemap: true,
    minify: false, // Set to 'terser' for production if desired
    target: 'es2020',

    // Library mode for IIFE output (required for FoundryVTT)
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      // IMPORTANT: This global name must not conflict with other FoundryVTT modules
      name: 'EMPuzzlesAndTrapTiles', // Global variable name for IIFE
      formats: ['iife'], // Critical for FoundryVTT compatibility
      fileName: () => 'main.js' // Output filename
    },

    // Rollup-specific options
    rollupOptions: {
      output: {
        // Ensure single file output (no code splitting)
        inlineDynamicImports: true,
        // Include inline sources for better debugging
        sourcemapExcludeSources: false
      },
      onwarn(warning, warn) {
        // Suppress certain warnings (preserve existing behavior)
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        warn(warning);
      }
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },

  // Custom plugins
  plugins: [buildInfoPlugin()]
});
