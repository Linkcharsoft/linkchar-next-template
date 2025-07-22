import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import _import from 'eslint-plugin-import'
import prettier from 'eslint-plugin-prettier'
import react from 'eslint-plugin-react'
import reackHooks from 'eslint-plugin-react-hooks'
import cypressPlugin from 'eslint-plugin-cypress'
import next from '@next/eslint-plugin-next'
import globals from 'globals'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

const config = [...fixupConfigRules(compat.extends(
  'eslint:recommended',
  'plugin:import/recommended',
  'plugin:import/typescript',
  'plugin:react/recommended',
  'plugin:react/jsx-runtime',
  'plugin:@typescript-eslint/recommended',
  'next/typescript',
  'next/core-web-vitals'
)), {
  plugins: {
    react: fixupPluginRules(react),
    "react-hooks": fixupPluginRules(reackHooks),
    next: fixupPluginRules(next),
    import: fixupPluginRules(_import),
    prettier,
    '@typescript-eslint': fixupPluginRules(typescriptEslint),
    cypress: cypressPlugin
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node
    },

    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',

    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },

  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
    },
  },

  rules: {
    indent: ['error', 2, {
      SwitchCase: 1,
    }],
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    'no-undef': 'error',

    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling'],
        'index',
        'object',
        'type',
      ],

      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],

    'react/prop-types': 0,
    'react-hooks/exhaustive-deps': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    ...cypressPlugin.configs.recommended.rules,
    'cypress/unsafe-to-chain-command': 'off'
  },

  ignores: [
    'node_modules',
    'dist',
    'build',
    '.vscode',
    '.husky',
    '.next',
    'next-env.d.ts',
    'next.config.js',
    'next-env.d.ts',
    'next-env.d.ts',
    'eslint.config.mjs',
  ]
}]

export default config