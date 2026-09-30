import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'SnapRequest',
    description: '前后端联调请求快照与重放工具',
    version: '0.1.0',
    permissions: [
      'cookies',
      'storage',
      'scripting',
      'tabs',
      'sidePanel',
      'clipboardWrite',
      'activeTab',
    ],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'SnapRequest',
    },
    web_accessible_resources: [
      {
        resources: ['main-world.js'],
        matches: ['*://*/*'],
      },
    ],
  },
});
