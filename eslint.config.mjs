import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

/**
 * Formatting is NOT enforced here.
 *
 * `eslint-config-prettier` (spread into every block below) turns off the ESLint
 * rules that would fight Prettier, and Prettier itself runs as its own step via
 * `npm run format:check` / `npm run format`. Running Prettier as an ESLint rule
 * (eslint-plugin-prettier) is explicitly discouraged by Prettier upstream: it
 * makes every formatting nit indistinguishable from a real correctness problem,
 * which is exactly what kept `--max-warnings 0` off this repo for so long.
 *
 * Consequence: everything left in `rules` is a real code-quality signal, so it
 * is an ERROR and `npm run lint` runs with `--max-warnings 0`.
 */

/** Rules shared by src and tests. */
const baseRules = {
  ...tseslint.configs.recommended.rules,
  ...prettierConfig.rules,
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-non-null-assertion': 'error',
  'no-console': 'off',
  'prefer-const': 'error'
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'build-info.json',
      // Root-level tooling config that is not part of the linted source set.
      'eslint.config.mjs',
      'jest.config.js',
      'vite.config.ts'
    ]
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        browser: true,
        es2022: true,
        node: true
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...baseRules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        browser: true,
        es2022: true,
        node: true,
        jest: true
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...baseRules,
      // Tests intentionally declare unused fixtures/spies.
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    // Build/release tooling: plain CommonJS Node scripts, no type-aware linting
    // (they are excluded from tsconfig.json on purpose).
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        console: 'readonly',
        module: 'writable',
        process: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      ...prettierConfig.rules,
      'no-console': 'off',
      'prefer-const': 'error'
    }
  }
];
