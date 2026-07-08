import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'
import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import stylistic from '@stylistic/eslint-plugin'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import boundaries from 'eslint-plugin-boundaries'
import checkFile from 'eslint-plugin-check-file'
import cypressPlugin from 'eslint-plugin-cypress'
import granularSelectors from 'eslint-plugin-granular-selectors'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import noSecrets from 'eslint-plugin-no-secrets'
import nodeDeps from 'eslint-plugin-node-dependencies'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import sonarjs from 'eslint-plugin-sonarjs'
import tailwind from 'eslint-plugin-tailwindcss'
import unicorn from 'eslint-plugin-unicorn'
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
      'granular-selectors': granularSelectors,
      '@eslint-community/eslint-comments': eslintComments,
      boundaries,
      'check-file': checkFile,
      'no-secrets': noSecrets,
      sonarjs,
      unicorn
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json'
        }
      },
      'boundaries/include': ['src/**/*.{ts,tsx}'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**', partialMatch: false },
        { type: 'screens', pattern: 'src/screens/**', partialMatch: false },
        { type: 'layouts', pattern: 'src/layouts/**', partialMatch: false },
        { type: 'providers', pattern: 'src/providers/**', partialMatch: false },
        { type: 'components', pattern: 'src/components/**', partialMatch: false },
        { type: 'hooks', pattern: 'src/hooks/**', partialMatch: false },
        { type: 'stores', pattern: 'src/stores/**', partialMatch: false },
        { type: 'api', pattern: 'src/api/**', partialMatch: false },
        { type: 'utils', pattern: 'src/utils/**', partialMatch: false },
        { type: 'constants', pattern: 'src/constants/**', partialMatch: false },
        { type: 'types', pattern: 'src/types/**', partialMatch: false }
      ]
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

      // Web (A11y)
      ...jsxA11y.configs.recommended.rules,

      // Tailwind
      ...tailwind.configs.recommended.rules,
      'tailwindcss/no-custom-classname': 'off',

      // SonarJS — bug detection + complexity
      ...sonarjs.configs.recommended.rules,
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-small-switch': 'off',
      'sonarjs/cognitive-complexity': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/regex-complexity': 'warn',
      'sonarjs/todo-tag': 'warn',

      // Unicorn — best practices (opinionated/style rules relaxed for this project)
      ...unicorn.configs['flat/recommended'].rules,
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-query-selector': 'off',
      'unicorn/no-empty-file': 'off',
      // toSorted/toReversed need Safari 16.4; the project's browserslist targets Safari 15.4.
      'unicorn/no-array-sort': 'off',
      'unicorn/no-array-reverse': 'off',
      // Breaks TypeScript discriminated-union narrowing when the compared field drives type guards.
      'unicorn/prefer-includes-over-repeated-comparisons': 'off',
      // Rewrites http→https on XML/SVG namespace URIs (immutable identifiers, not navigable URLs).
      'unicorn/prefer-https': 'off',

      // eslint-comments — every disable must justify its WHY
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unused-disable': 'error',

      // no-secrets — catch hardcoded high-entropy secrets/tokens
      'no-secrets/no-secrets': ['error', { tolerance: 4.8 }],

      // Architecture boundaries — enforce the layered import direction (v7 entity selectors)
      'boundaries/dependencies': ['error', {
        default: 'allow',
        policies: [
          {
            from: { element: { type: 'api' } },
            disallow: { to: { element: { type: ['app', 'screens', 'layouts', 'providers', 'components', 'hooks', 'stores'] } } },
            message: 'API layer must not import UI/state/hooks — keep it a leaf on the data side.'
          },
          {
            from: { element: { type: 'utils' } },
            disallow: { to: { element: { type: ['app', 'screens', 'layouts', 'providers', 'components', 'hooks', 'stores'] } } },
            message: 'Utils must not import UI or state (importing the API layer is allowed).'
          },
          {
            from: { element: { type: ['constants', 'types'] } },
            disallow: { to: { element: { type: ['app', 'screens', 'layouts', 'providers', 'components', 'hooks', 'stores', 'api'] } } },
            message: 'Constants/types must be pure leaves — no feature-layer imports.'
          },
          {
            from: { element: { type: 'stores' } },
            disallow: { to: { element: { type: ['app', 'screens', 'layouts', 'providers', 'components', 'hooks'] } } },
            message: 'Stores must not import UI or hooks.'
          },
          {
            from: { element: { type: 'hooks' } },
            disallow: { to: { element: { type: ['app', 'screens', 'layouts', 'providers', 'components'] } } },
            message: 'Hooks must not import UI layers.'
          },
          {
            from: { element: { type: 'components' } },
            disallow: { to: { element: { type: ['app', 'screens', 'layouts', 'providers'] } } },
            message: 'Components must not import screens/layouts/app/providers.'
          },
          {
            from: { element: { type: 'layouts' } },
            disallow: { to: { element: { type: ['app', 'screens'] } } },
            message: 'Layouts must not import screens or app routes.'
          },
          {
            from: { element: { type: 'screens' } },
            disallow: { to: { element: { type: ['app'] } } },
            message: 'Screens must not import app routes.'
          }
        ]
      }],

      // Zustand — atomic selectors only
      'granular-selectors/granular-selectors': ['error', { include: ['use.*Store'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^use.*Store$/][arguments.length=0]',
          message: 'Consume Zustand stores with an atomic selector: useXxxStore((s) => s.field). Calling the hook with no arguments re-renders on every state change.'
        },
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message: 'Do not read process.env directly — import the value from @/constants/env.'
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
  // --- File naming conventions ---
  {
    files: ['src/{components,screens,layouts}/**/*.{ts,tsx}'],
    rules: {
      'check-file/filename-naming-convention': ['error', {
        '**/*.{ts,tsx}': 'PASCAL_CASE'
      }, { ignoreMiddleExtensions: true }]
    }
  },
  {
    files: ['src/{hooks,stores,utils,api}/**/*.ts'],
    rules: {
      'check-file/filename-naming-convention': ['error', {
        '**/*.ts': 'CAMEL_CASE'
      }, { ignoreMiddleExtensions: true }]
    }
  },
  // --- Infra files: process.env is sanctioned here ---
  {
    files: ['src/constants/env.ts', 'src/instrumentation.ts', 'src/instrumentation-client.ts', '*.config.{ts,js,mjs}', 'next.config.ts'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  // --- SVG path data / test fixtures trip the entropy detector ---
  {
    files: ['src/assets/**/*.{ts,tsx}', 'src/cypress/**/*.{ts,tsx}'],
    rules: {
      'no-secrets/no-secrets': 'off'
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
      'cypress/unsafe-to-chain-command': 'off',
      // Cypress asserts via .should() chains and uses mocha's `this`; test data is non-crypto.
      'sonarjs/assertions-in-tests': 'off',
      'sonarjs/no-empty-test-file': 'off',
      'sonarjs/pseudo-random': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/no-this-outside-of-class': 'off'
    }
  }
]

export default ESLintConfig
