export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  if (useError().value) {
    return
  }

  const compatibility = useServerCompatibility()
  const result = await compatibility.check()

  if (result.status !== "incompatible") {
    return
  }

  throw createError({
    statusCode: 426,
    statusMessage: "Upgrade Required",
    message: "This web client is incompatible with the connected server.",
    fatal: true,
    data: {
      code: "SERVER_VERSION_MISMATCH",
      redirectPath: to.fullPath,
      expectedVersion: compatibility.expectedVersion,
      serverVersion: result.serverVersion,
      error: result.error ?? null,
    },
  })
})
