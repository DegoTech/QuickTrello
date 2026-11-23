import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quicktrello.app',
  appName: 'QuickTrello',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
