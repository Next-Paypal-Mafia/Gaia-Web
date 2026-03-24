export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  ssr: false,
  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/supabase"],

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
