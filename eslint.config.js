// Minimal, deliberately narrow. The only job here is catching references to
// things that were never imported or declared: the class of bug where a module
// imports fine but the code path throws the moment it actually runs.

export default [
  {
    files: ['api/**/*.js', 'lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly', console: 'readonly', fetch: 'readonly',
        Buffer: 'readonly', URL: 'readonly', setTimeout: 'readonly',
        TextEncoder: 'readonly', TextDecoder: 'readonly',
      },
    },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }] },
  },
  {
    files: ['src/**/*.jsx', 'src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', fetch: 'readonly',
        Event: 'readonly', console: 'readonly',
        requestAnimationFrame: 'readonly', setTimeout: 'readonly',
        FileReader: 'readonly', Blob: 'readonly', URL: 'readonly',
      },
    },
    rules: { 'no-undef': 'error' },
  },
];
