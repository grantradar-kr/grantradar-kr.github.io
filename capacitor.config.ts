import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.grantradar.app',
  appName: '보조금 레이더',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#ffffff',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#04785fff',
      showSpinner: false,
    },
  },
}

export default config
