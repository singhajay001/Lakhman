import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.react-router/**',
      'docs/spirithaus/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      // A provider adapter that swallows an error is the failure mode section 43
      // prohibits, so an empty catch is an error rather than a warning.
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    // Scripts and the worker entry point talk to an operator through the console;
    // everything else logs structurally.
    files: [
      '**/*.test.ts',
      '**/seed.ts',
      'apps/worker/src/index.ts',
      'apps/worker/src/demo-sync.ts',
    ],
    rules: { 'no-console': 'off' },
  },
);
