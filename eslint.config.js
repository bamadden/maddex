import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
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
      // The codebase already uses a leading underscore to mark something as
      // deliberately unused (`_dropped` in useAuthStore, `_unused` in
      // format.js). Without this the convention was decorative and the rule
      // flagged them anyway, which teaches people to ignore the linter.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Node.js context: Vite's own config file, Vercel serverless functions
    // under api/ and the build/maintenance scripts under scripts/ — none runs
    // in the browser, so `process`, `Buffer` etc. are real globals here, not
    // the browser-only set above.
    files: ['vite.config.js', 'api/**/*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
