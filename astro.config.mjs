import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://televizorieftin.ro',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
});
