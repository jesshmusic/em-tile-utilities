import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import incrementBuild from './rollup-plugin-increment-build.mjs';

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'iife',
    sourcemap: true,
    name: 'EMPuzzlesAndTrapTiles'
  },
  plugins: [
    incrementBuild(),
    json(),
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true
    })
  ],
  watch: {
    include: 'src/**',
    clearScreen: false
  }
};
