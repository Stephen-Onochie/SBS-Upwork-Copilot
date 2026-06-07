import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'SBS Upwork Co-Pilot',
  version: '0.1.0',
  description: 'Personal Upwork assistant for SBS Digital — proposal generation, job scoring, and HubSpot sync.',

  permissions: ['storage', 'alarms', 'notifications', 'offscreen', 'tabs'],

  host_permissions: [
    'https://*.upwork.com/*',
    'https://generativelanguage.googleapis.com/*',
    'https://api.hubapi.com/*',
  ],

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: ['https://*.upwork.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],

  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'SBS Upwork Co-Pilot',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },

  options_page: 'src/options/index.html',

  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
})
