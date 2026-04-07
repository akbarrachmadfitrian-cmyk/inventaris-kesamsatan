import { onRequestGet as baseGet, onRequestPost as basePost } from '../device-photo'

interface Env {
  ADMIN_API_KEY?: string
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  })

const requireAdmin = (request: Request, env: Env) => {
  const expected = String(env.ADMIN_API_KEY || '')
  if (!expected) return json({ error: 'ADMIN_API_KEY belum dikonfigurasi' }, { status: 500 })
  const provided = String(request.headers.get('x-admin-key') || '')
  if (provided !== expected) return json({ error: 'Akses ditolak' }, { status: 403 })
  return null
}

export async function onRequestGet(ctx: { request: Request; env: Env }) {
  const denied = requireAdmin(ctx.request, ctx.env)
  if (denied) return denied
  return baseGet(ctx as unknown as Parameters<typeof baseGet>[0])
}

export async function onRequestPost(ctx: { request: Request; env: Env }) {
  const denied = requireAdmin(ctx.request, ctx.env)
  if (denied) return denied
  return basePost(ctx as unknown as Parameters<typeof basePost>[0])
}

