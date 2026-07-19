import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qqbot.platform',
  appName: 'QQ Bot Platform',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
