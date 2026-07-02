import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import stylistic from '@stylistic/eslint-plugin'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import cypressPlugin from 'eslint-plugin-cypress'
import granularSelectors from 'eslint-plugin-granular-selectors'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import nodeDeps from 'eslint-plugin-node-dependencies'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tailwind from 'eslint-plugin-tailwindcss'
import globals from 'globals'
import jsoncParser from 'jsonc-eslint-parser'

const ESLintConfig = [
  // --- Ignores ---
  {
    ignores: ['node_modules/', 'dist/', 'build/', '.next/', '**/*.d.ts', '.claude/']
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
      stylistic,
      tailwindcss: tailwind,
      'granular-selectors': granularSelectors
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
      'stylistic/comma-dangle': ['error', 'never'],
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
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type'
        ],
        pathGroups: [
          {
            pattern: '**/*.css',
            group: 'builtin',
            position: 'before'
          }, {
            pattern: '**/*.scss',
            group: 'builtin',
            position: 'before'
          }, {
            pattern: '**/*.sass',
            group: 'builtin',
            position: 'before'
          }
        ],
        pathGroupsExcludedImportTypes: [],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }],
      'import/no-unresolved': 'error',

      // React
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react/jsx-filename-extension': [1, { 'extensions': ['.jsx', '.tsx'] }],
      'react/no-unstable-nested-components': 'error',
      'react/prop-types': 'off',

      // React Hooks + React Compiler rules (v7 flat recommended)
      ...reactHooks.configs['recommended-latest'].rules,
      'react-hooks/exhaustive-deps': 'off',

      // Next
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // TS
      ...typescriptEslint.configs.recommended.rules,
      // TypeScript already checks for undefined variables/types (with better accuracy
      // than ESLint, because it understands DOM lib types like RequestInit/RequestCache).
      // Disabling no-undef here removes the need for `// eslint-disable-next-line no-undef`
      // sprinkles on every DOM type usage. Recommended by typescript-eslint maintainers.
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      // '@typescript-eslint/no-unused-vars': ['warn', {
      //   argsIgnorePattern: '^_',
      //   varsIgnorePattern: '^_'
      //   caughtErrorsIgnorePattern: "^_",
      // }],

      // Web (A11y)
      ...jsxA11y.configs.recommended.rules,

      // Tailwind
      ...tailwind.configs.recommended.rules,
      'tailwindcss/no-custom-classname': 'off',

      // Zustand — atomic selectors only
      'granular-selectors/granular-selectors': ['error', { include: ['use.*Store'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^use.*Store$/][arguments.length=0]',
          message: 'Consume Zustand stores with an atomic selector: useXxxStore((s) => s.field). Calling the hook with no arguments re-renders on every state change.'
        }
      ],

      // Framer motion
      'no-restricted-imports': [
        'error',
        {
          'paths': [
            {
              'name': 'framer-motion',
              'importNames': ['motion'],
              'message': 'Please use \'m\' in conjunction with LazyMotion to improve performance.'
            }
          ]
        }
      ]
    }
  },
  // --- Dependencies ---
  {
    files: ['package.json'],
    languageOptions: {
      parser: jsoncParser
    },
    plugins: {
      'node-dependencies': nodeDeps
    },
    rules: {
      'node-dependencies/absolute-version': ['error', {
        'dependencies': 'always',
        'devDependencies': 'always',
        'peerDependencies': 'always',
        'optionalDependencies': 'always'
      }]
    }
  },
  // --- Cypress Rules ---
  {
    files: ['src/cypress/**/*.{ts,tsx}'],
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
  }
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