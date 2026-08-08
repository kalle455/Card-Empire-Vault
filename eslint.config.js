import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.npm-cache',
    'remote_*',
    'src/pages/**',
    'src/components/admin/**',
    'src/components/seller/**',
    'src/services/authService.js',
    'src/data/translations.js',
  ]),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['api/**/*.js', 'vite.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, fetch: 'readonly' },
    },
  },
])
