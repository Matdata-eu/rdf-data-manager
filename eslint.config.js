import neostandard from 'neostandard'
import reactHooks from 'eslint-plugin-react-hooks'

// Standard style (no semicolons, single quotes, space before function parens) with
// TypeScript, which is how the code was written from the start, plus the React hooks rules.
export default [
  { ignores: ['**/dist/**', '**/dist-types/**', '**/node_modules/**', 'playwright-report/**', 'test-results/**'] },
  ...neostandard({ ts: true }),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `void promise` marks a deliberately unawaited call.
      'no-void': 'off'
    }
  }
]
