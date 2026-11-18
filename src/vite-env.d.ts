/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_ADSENSE_CLIENT?: string
  readonly VITE_ADSENSE_SLOT?: string
  readonly VITE_ADMOB_ANDROID_BANNER?: string
  readonly VITE_ADMOB_IOS_BANNER?: string
  readonly VITE_SHOW_AD_PLACEHOLDER?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
