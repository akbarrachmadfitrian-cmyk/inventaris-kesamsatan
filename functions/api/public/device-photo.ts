import { onRequestGet as baseGet } from '../device-photo'

interface Env {
  USER_API_KEY?: string
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

const requireUserOrAdmin = (request: Request, env: Env) => {
  const expectedUser = String(env.USER_API_KEY || '')
  const expectedAdmin = String(env.ADMIN_API_KEY || '')
  if (!expectedUser && !expectedAdmin) return json({ error: 'USER_API_KEY/ADMIN_API_KEY belum dikonfigurasi' }, { status: 500 })

  const userKey = String(request.headers.get('x-user-key') || '')
  const adminKey = String(request.headers.get('x-admin-key') || '')
  if ((expectedUser && userKey === expectedUser) || (expectedAdmin && adminKey === expectedAdmin)) return null
  return json({ error: 'Akses ditolak' }, { status: 403 })
}

export async function onRequestGet(ctx: { request: Request; env: Env }) {
  const denied = requireUserOrAdmin(ctx.request, ctx.env)
  if (denied) return denied
  return baseGet(ctx as unknown as Parameters<typeof baseGet>[0])
}

