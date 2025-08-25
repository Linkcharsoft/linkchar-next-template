import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import _import from 'eslint-plugin-import'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import cypressPlugin from 'eslint-plugin-cypress'
import next from '@next/eslint-plugin-next'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

const config = [...fixupConfigRules(compat.extends(
  'eslint:recommended',
  'next/core-web-vitals',
  'next/typescript',
  'plugin:@typescript-eslint/recommended',
  'plugin:import/recommended',
  'plugin:import/typescript',
  'plugin:react/jsx-runtime',
  'plugin:react/recommended'
)), {
  plugins: {
    '@typescript-eslint': fixupPluginRules(typescriptEslint),
    'react-hooks': fixupPluginRules(reactHooks),
    cypress: cypressPlugin,
    import: fixupPluginRules(_import),
    next: fixupPluginRules(next),
    react: fixupPluginRules(react),
    stylistic,
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
    // @stylistic
    'stylistic/indent': ['error', 2, { SwitchCase: 1 }],
    'stylistic/array-bracket-spacing': ['warn', 'never'],
    'stylistic/object-curly-spacing': ['warn', 'always'],
    'stylistic/quotes': ['error', 'single'],
    'stylistic/semi': ['error', 'never'],
    'stylistic/space-before-function-paren': ['warn', 'always'],
    'stylistic/space-infix-ops': 'warn',


    // Import order
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

    // React / TS
    'react/prop-types': 0,
    'react-hooks/exhaustive-deps': 'off',
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',

    // Cypress
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
    'next.config.js',
    'next-env.d.ts',
    'eslint.config.mjs',
  ]
}]

export default config