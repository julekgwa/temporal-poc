//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: ['eslint.config.js', 'prettier.config.js', 'tmp/**'],
  },
  {
    files: ['apps/temporal-api/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./apps/temporal-api/tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/temporal-worker/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: [
          './apps/temporal-worker/tsconfig.app.json',
          './apps/temporal-worker/tsconfig.spec.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]
