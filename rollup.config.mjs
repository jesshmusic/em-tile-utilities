import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import serve from 'rollup-plugin-serve';

const isDevelopment = process.env.NODE_ENV === 'development';

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'iife',
    sourcemap: true,
    name: 'EMPuzzlesAndTrapTiles'
  },
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true
    }),
    ...(isDevelopment ? [
      serve({
        open: false,
        contentBase: ['dist'],
        port: 30001,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      }),
      livereload({
        watch: 'dist',
        verbose: true
      })
    ] : [])
  ],
  watch: {
    include: 'src/**',
    clearScreen: false
  }
};
