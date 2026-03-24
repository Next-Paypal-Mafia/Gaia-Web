function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.resendApiKey as string
  const to = (config.bugReportTo as string) || "team@jellybyte.io"
  const from =
    (config.bugReportFrom as string) ||
    "Jellybyte <onboarding@resend.dev>"

  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage:
        "Bug report email is not configured (set NUXT_RESEND_API_KEY and NUXT_BUG_REPORT_FROM).",
    })
  }

  const body = await readBody<{
    email?: string
    title?: string
    description?: string
  }>(event)

  const email = (body.email ?? "").trim()
  const title = (body.title ?? "").trim()
  const description = (body.description ?? "").trim()

  if (!email || !isValidEmail(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: "A valid email is required.",
    })
  }
  if (!title || title.length > 200) {
    throw createError({
      statusCode: 400,
      statusMessage: "Title is required (max 200 characters).",
    })
  }
  if (!description || description.length > 8000) {
    throw createError({
      statusCode: 400,
      statusMessage: "Description is required (max 8000 characters).",
    })
  }

  const subject = `[Bug] ${title}`
  const html = `
    <p><strong>From:</strong> ${escapeHtml(email)}</p>
    <p><strong>Title:</strong> ${escapeHtml(title)}</p>
    <hr />
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;">${escapeHtml(description)}</pre>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject,
      html,
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    console.error("[bug-report] Resend error:", res.status, raw)
    throw createError({
      statusCode: 502,
      statusMessage: "Could not send report. Try again later.",
    })
  }

  return { ok: true as const }
})
