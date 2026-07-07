import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Flat config (ESLint 10). Порядок важен: prettier — последним,
// он отключает правила форматирования, чтобы ESLint не конфликтовал с Prettier.
export default tseslint.config(
  { ignores: ['dist/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
