import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

/**
 * Vite plugin to increment build number on each build
 * (Converted from rollup-plugin-increment-build.mjs)
 */
function incrementBuildPlugin() {
  return {
    name: 'increment-build',
    buildStart() {
      const buildInfoPath = resolve('build-info.json');

      let buildInfo = { buildNumber: 0 };

      // Read existing build info
      if (fs.existsSync(buildInfoPath)) {
        const content = fs.readFileSync(buildInfoPath, 'utf-8');
        try {
          buildInfo = JSON.parse(content);
          // Validate buildNumber property
          if (typeof buildInfo.buildNumber !== 'number') {
            console.warn(
              'build-info.json is missing a valid buildNumber property. Resetting build number to 0.'
            );
            buildInfo = { buildNumber: 0 };
          }
        } catch (err) {
          console.error(
            `Error parsing build-info.json: ${(err as Error).message}. Resetting build number to 0.`
          );
          buildInfo = { buildNumber: 0 };
        }
      }

      // Increment build number
      buildInfo.buildNumber = (buildInfo.buildNumber || 0) + 1;

      // Write back to file
      fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

      console.log(`Build #${buildInfo.buildNumber}`);
    }
  };
}

export default defineConfig({
  build: {
    // Output configuration
    outDir: 'dist',
    emptyOutDir: false, // Don't delete entire dist folder
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
    },

    // Watch mode configuration
    watch: {
      include: 'src/**',
      clearScreen: false,
      buildDelay: 100
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },

  // Custom plugins
  plugins: [incrementBuildPlugin()]
});
