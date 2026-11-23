/**
 * Host half of the nested-workspaces bundle.
 *
 * Child workspaces are ordinary workspaces whose directory sits inside the parent
 * workspace, so the workspace controller already persists them — nothing here
 * touches workspace records.
 *
 * The one thing the Host must do is make the child directory. The Client's
 * `uiWorkspace.createDirectory()` goes through the composed directory picker,
 * and a Host whose picker backend is the OS chooser serves only the `native`
 * capability: `directoryPicker.createDirectory` then answers
 * `directory-picker/unavailable: ... needs the browse capability`. Creating a
 * folder is not really a "browse" feature, so this bundle answers it over the
 * public Connection transport instead (the same `/api` carrier other bundles
 * use), and the Client falls back to `createDirectory` when this route is
 * missing.
 */

import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

/** Connection is the only Host service this half needs. */
export const inject = ['connection']

/** Exact route below `/api`; Connection rejects anything that is not an exact `/api/...` path. */
const ROUTE_PATH = '/api/nested-workspaces'
/** Envelope method name, mirrored by the Client call. */
const ENDPOINT = 'nested-workspaces'

/** A child name becomes one directory segment, so it may not carry a separator. */
const INVALID_NAME = /[\\/]/

/**
 * Validate the requested child name.
 * @param value - raw name from the Client.
 * @returns the trimmed name, or null when it cannot be a directory segment.
 */
function normalizeName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name === '' || name === '.' || name === '..') return null
  if (INVALID_NAME.test(name)) return null
  return name
}

/** One failure result in the Connection envelope. */
function failure(code, message) {
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * Create `<parent>/<name>` without creating any other segment.
 * @param payload - decoded request payload.
 * @returns a Connection handler result.
 */
async function createChild(payload) {
  const parent = payload !== null && typeof payload === 'object' ? payload.parent : undefined
  const name = normalizeName(payload !== null && typeof payload === 'object' ? payload.name : undefined)
  if (typeof parent !== 'string' || parent.trim() === '') {
    return failure('nested-workspaces/invalid-parent', 'A parent directory is required.')
  }
  if (name === null) {
    return failure('nested-workspaces/invalid-name', 'A child name may not be empty, "." , ".." or contain a separator.')
  }
  const target = path.join(parent, name)
  try {
    await mkdir(target)
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'EEXIST') {
      return failure('directory-picker/exists', `"${target}" already exists.`)
    }
    const message = error instanceof Error ? error.message : String(error)
    return failure('directory-picker/create-failed', message)
  }
  try {
    const info = await stat(target)
    if (!info.isDirectory()) {
      return failure('directory-picker/create-failed', `"${target}" is not a directory.`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return failure('directory-picker/unreadable', message)
  }
  return { ok: true, value: { path: target } }
}

/** Reply in the envelope `createWebConnectionRpc` parses. */
function reply(rpcId, result) {
  return Response.json({ type: 'server-response', rpcId, result })
}

/**
 * Register the child-directory route.
 * @param ctx - the Host plugin context.
 */
export function apply(ctx) {
  let dispose
  try {
    dispose = ctx.connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
        let message
        try {
          message = await request.json()
        } catch {
          return new Response('body is not JSON', { status: 400 })
        }
        const rpcId = message !== null && typeof message === 'object' && typeof message.rpcId === 'string'
          ? message.rpcId
          : 'invalid-request'
        if (
          message === null
          || typeof message !== 'object'
          || message.type !== 'client-request'
          || typeof message.method !== 'string'
          || message.method !== ENDPOINT
        ) {
          return reply(rpcId, failure('gateway/bad-request', 'Invalid nested-workspaces request.'))
        }
        const payload = message.payload
        if (payload === null || typeof payload !== 'object' || payload.action !== 'createChild') {
          return reply(rpcId, failure('gateway/bad-request', 'Unknown nested-workspaces action.'))
        }
        return reply(rpcId, await createChild(payload))
      },
    })
  } catch (error) {
    /* The route registry is a Host-wide singleton: a live reload can reach this
     * line with the previous instance still holding the path. Yielding keeps the
     * serving instance authoritative instead of failing the whole composition. */
    if (/already registered/.test(String(error && error.message ? error.message : error))) return
    throw error
  }
  /* `fetch.register` already returns the disposer that drops the route; hand it
   * straight to the effect instead of wrapping it a second time. */
  ctx.effect(() => dispose, 'dsh-nested-workspaces: child directory route')
}
