import js from '@eslint/js';

const browserGlobals = {
  document: 'readonly', window: 'readonly', localStorage: 'readonly', FormData: 'readonly', Blob: 'readonly',
  URL: 'readonly', Intl: 'readonly', fetch: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', console: 'readonly', process: 'readonly',
};

export default [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browserGlobals },
    rules: {
      // Correctness
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-shadow': 'error',
      'no-param-reassign': 'error',
      'no-return-await': 'error',
      'no-throw-literal': 'error',
      'require-await': 'error',
      'consistent-return': 'error',
      eqeqeq: 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      // Modern style
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'dot-notation': 'error',
      'no-else-return': 'error',
      'no-nested-ternary': 'error',
      curly: ['error', 'multi-line'],
    },
  },
  {
    // Keep production code small and readable; tests may be denser.
    files: ['src/**/*.js', 'server.mjs'],
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-len': ['error', { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true }],
      'no-console': ['error', { allow: ['log', 'error'] }],
    },
  },
  { files: ['test/**/*.js'], rules: { 'require-await': 'off' } },
];
