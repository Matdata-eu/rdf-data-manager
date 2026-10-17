import neostandard from 'neostandard'
import reactHooks from 'eslint-plugin-react-hooks'

// Standard style (no semicolons, single quotes, space before function parens) with
// TypeScript, which is how the code was written from the start, plus the React hooks rules.
export default [
  ...neostandard({ ts: true, ignores: ['dist/**', 'node_modules/**'] }),
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
