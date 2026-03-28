export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/supabase", "@nuxtjs/i18n"],

  i18n: {
    /** v10 defaults to ./i18n; this app keeps messages under app/locales */
    restructureDir: "app",
    locales: [
      { code: "en", language: "en", name: "English", file: "en.json" },
      { code: "es", language: "es", name: "Español", file: "es.json" },
      { code: "zh", language: "zh-CN", name: "中文", file: "zh.json" },
      { code: "ja", language: "ja", name: "日本語", file: "ja.json" },
      { code: "fr", language: "fr", name: "Français", file: "fr.json" },
    ],
    defaultLocale: "en",
    strategy: "no_prefix",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      alwaysRedirect: true,
      fallbackLocale: "en",
    },
    langDir: "locales/",
  },

  runtimeConfig: {
    public: {
      /** Agent / OpenCode backend (e.g. http://localhost:8000). Set NUXT_PUBLIC_SERVER_URL in .env */
      serverUrl:
        process.env.NUXT_PUBLIC_SERVER_URL ||
        process.env.NUXT_SERVER_URL ||
        process.env.SERVER_URL,
    },
    /** Resend API key for POST /api/bug-report (server-only) */
    resendApiKey:
      process.env.NUXT_RESEND_API_KEY || process.env.RESEND_API_KEY || "",
    /** Verified sender in Resend, e.g. Jellybyte <bugs@yourdomain.com> */
    bugReportFrom: process.env.NUXT_BUG_REPORT_FROM || "",
    bugReportTo: process.env.NUXT_BUG_REPORT_TO || "team@jellybyte.io",
  },

  supabase: {
    redirect: false,
  },

  css: ["~/assets/css/main.css"],
});
