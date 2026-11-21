import { AgentPlcService } from './lib/service.js'

/** Loader row id for this bundle. */
export const name = 'agentplc'

/** The tool registry is the only hard dependency; the routes appear only in web compositions. */
export const inject = ['tools']

/**
 * The conversation protocol that makes the panel's promise real: read, propose, wait for
 * approval, write, compile, fix, report. Registered as a prompt section when the host
 * exposes one, so it applies to every session in this profile rather than living in a README.
 */
const WORKFLOW_PROTOCOL = `## PLC 工程台 (AgentPLC)

When the user brings a PLC programming task (OMRON Sysmac Studio or Siemens TIA Portal), work in this order:

1. Read before writing. Use plc_sysmac overview/variables/pou (or plc_tia list/listTags) and plc_io to learn the real controller, POUs, variables and addresses. Never invent a variable, address or block that already exists.
2. Propose, then wait. Reply with the approach, the POUs to add or change, the global variables (name/type/comment) and what you will leave to the user. Do not call a write action (plc_sysmac create, plc_tia create/importScl/createOb/importBlocks) until the user explicitly approves.
3. Write ST (Sysmac) or SCL (TIA; ASCII identifiers only, Chinese comments are fine). Function-block instances such as TON stay in the POU-local VAR; every global a program uses gets a VAR_EXTERNAL mirror in that program. Leave IO addresses and task assignment to the user unless they ask otherwise.
4. Compile and fix it yourself. Use create with compile:true or the compile action, read the real compiler messages, fix the code, and repeat until there are no errors. Warnings are usually acceptable; report the final error and warning counts.
5. Report what changed, the file paths, and what the user still must do (IO assignment, task assignment, opening the project, downloading).

Never claim a compile succeeded without a tool result that says so.`

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
  const mountPrompt = (scope) => {
    const systemPrompt = scope.systemPrompt ?? scope.get?.('systemPrompt')
    if (!systemPrompt || typeof systemPrompt.section !== 'function') return
    scope.effect(
      () =>
        systemPrompt.section({
          name: 'agentplc/workflow',
          order: 900,
          text: WORKFLOW_PROTOCOL,
        }),
      'agentplc/prompt',
    )
  }
  if (typeof ctx.inject === 'function') {
    // Deferred binding: runs as soon as the service exists, and again if it is replaced.
    ctx.inject(['webServer'], mountRoutes)
    ctx.inject(['systemPrompt'], mountPrompt)
  } else {
    mountRoutes(ctx)
    mountPrompt(ctx)
  }
}
