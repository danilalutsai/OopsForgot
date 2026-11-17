import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default defineConfigWithVueTs(
  {
    ignores: ['**/dist/**', '**/dev-dist/**', '**/test-results/**', '**/playwright-report/**', 'supabase/functions/**'],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  prettier,
)
