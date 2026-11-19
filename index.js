import { AgentPlcService } from './lib/service.js'

/** Loader row id for this bundle. */
export const name = 'agentplc'

/** The tool registry is the only hard dependency; the routes appear only in web compositions. */
export const inject = ['tools']

export function apply(ctx, config = {}) {
  const service = new AgentPlcService(ctx, config ?? {})

  // Tools and routes: register each capability against the scope that owns it, so a
  // webServer (or tools registry) that appears later still gets its registrations.
  ctx.effect(() => service.registerTools(ctx.tools), 'agentplc/tools')

  const mountRoutes = (scope) => {
    const webServer = scope.webServer ?? scope.get?.('webServer')
    if (!webServer) return
    scope.effect(() => service.registerRoutes(webServer), 'agentplc/routes')
  }
  if (typeof ctx.inject === 'function') {
    // Deferred binding: runs as soon as the webServer service exists, and again if it is replaced.
    ctx.inject(['webServer'], mountRoutes)
  } else {
    mountRoutes(ctx)
  }
}
