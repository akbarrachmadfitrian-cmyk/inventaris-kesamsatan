type InboxKind = 'damage_report' | 'device_request'

interface Env {
  INBOX_KV?: KVNamespace
}

interface KVNamespace {
  put(key: string, value: string): Promise<void>
}

interface InboxMessage {
  id: string
  kind: InboxKind
  status: 'unread'
  samsat: string
  createdAt: string
  payload: unknown
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  })

const nowIso = () => new Date().toISOString()

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!env.INBOX_KV) return json({ error: 'KV binding INBOX_KV belum dikonfigurasi' }, { status: 500 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const action = String(data.action || 'create')
  if (action !== 'create') return json({ error: 'Akses ditolak' }, { status: 403 })

  const kind = String(data.kind || '') as InboxKind
  const samsat = String(data.samsat || '').trim()
  const payload = data.payload

  if (kind !== 'damage_report' && kind !== 'device_request') {
    return json({ error: 'kind tidak valid' }, { status: 400 })
  }
  if (!samsat) return json({ error: 'samsat wajib diisi' }, { status: 400 })
  if (!payload || typeof payload !== 'object') return json({ error: 'payload wajib diisi' }, { status: 400 })

  const id = newId()
  const msg: InboxMessage = {
    id,
    kind,
    status: 'unread',
    samsat,
    createdAt: nowIso(),
    payload,
  }

  await env.INBOX_KV.put(`msg:${id}`, JSON.stringify(msg))
  return json({ ok: true, id }, { status: 200 })
}

