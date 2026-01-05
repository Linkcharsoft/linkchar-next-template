import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import cypressPlugin from 'eslint-plugin-cypress'
import nextPlugin from '@next/eslint-plugin-next'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import stylistic from '@stylistic/eslint-plugin'

const ESLintConfig = [
  // --- Ignores ---
  {
    ignores: ['node_modules/', 'dist/', 'build/', '.next/'],
  },
  // --- Base Recommended JS Rules ---
  js.configs.recommended,
  // --- Main Project Rules ---
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      import: importPlugin,
      '@next/next': nextPlugin,
      react,
      stylistic
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      }
    },
    rules: {
      // @stylistic
      'stylistic/array-bracket-spacing': ['warn', 'never'],
      'stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      'stylistic/no-multi-spaces': 'error',
      'stylistic/no-trailing-spaces': 'error',
      'stylistic/object-curly-spacing': ['error', 'always'],
      'stylistic/quotes': ['error', 'single'],
      'stylistic/semi': ['error', 'never'],
      'stylistic/space-before-function-paren': ['warn', 'always'],
      'stylistic/space-infix-ops': 'warn',
      'stylistic/type-annotation-spacing': ['error', { after: true }],

      // Import order
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'object',
          'type'
        ],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        },
        'newlines-between': 'always',
        warnOnUnassignedImports: true,
        pathGroups: [
          {
            pattern: '**/*.+(css|scss|sass)',
            group: 'external',
            position: 'before'
          }
        ]
      }],

      // React & Web (A11y)
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...jsxA11y.configs.recommended.rules,
      'react/jsx-filename-extension': [1, { 'extensions': ['.jsx', '.tsx'] }],
      // 'react/jsx-uses-react': 'off',
      'react/no-unstable-nested-components': 'error',
      'react/prop-types': 'off',
      // 'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',

      // Next
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // TS
      ...typescriptEslint.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      // '@typescript-eslint/no-unused-vars': ['warn', {
      //   argsIgnorePattern: '^_',
      //   varsIgnorePattern: '^_'
      // }],
    },
  },
  // --- Cypress Config ---
  {
    files: ['cypress/**/*.{ts,tsx}', '**/*.cy.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...cypressPlugin.configs.recommended.languageOptions.globals
      }
    },
    plugins: { cypress: cypressPlugin },
    rules: {
      ...cypressPlugin.configs.recommended.rules,
      'cypress/unsafe-to-chain-command': 'off'
    }
  },
  // // --- Config Files ---
  // {
  //   files: ['*.config.js', '*.config.ts', 'next.config.js', 'cypress.config.ts'],
  //   languageOptions: {
  //     globals: {
  //       ...globals.node
  //     }
  //   }
  // }
]

export default ESLintConfig