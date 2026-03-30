type InboxKind = 'damage_report' | 'device_request'
type InboxStatus = 'unread' | 'read'

interface InboxMessage {
  id: string
  kind: InboxKind
  status: InboxStatus
  samsat: string
  createdAt: string
  payload: unknown
}

interface Env {
  INBOX_KV?: KVNamespace
}

interface KVNamespace {
  get<T = unknown>(key: string, type: 'json'): Promise<T | null>
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(options: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>
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

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  if (!env.INBOX_KV) return json({ error: 'KV binding INBOX_KV belum dikonfigurasi' }, { status: 500 })

  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || 'all').toLowerCase()
  const kind = (url.searchParams.get('kind') || 'all').toLowerCase()
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)))

  const listed = await env.INBOX_KV.list({ prefix: 'msg:' })
  const keys = listed.keys.map((k: { name: string }) => k.name)

  const msgs: InboxMessage[] = []
  for (const key of keys) {
    const msg = await env.INBOX_KV.get<InboxMessage>(key, 'json')
    if (!msg) continue
    if (status !== 'all' && msg.status !== status) continue
    if (kind !== 'all' && msg.kind !== kind) continue
    msgs.push(msg)
  }

  msgs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return json({ items: msgs.slice(0, limit) }, { status: 200 })
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

  if (action === 'delete') {
    const id = String(data.id || '').trim()
    if (!id) return json({ error: 'id wajib diisi' }, { status: 400 })
    await env.INBOX_KV.delete(`msg:${id}`)
    return json({ ok: true, deleted: 1 }, { status: 200 })
  }

  if (action === 'markRead') {
    const idsRaw = data.ids
    const ids = Array.isArray(idsRaw) ? idsRaw.map(v => String(v)) : []
    if (ids.length === 0) return json({ ok: true, updated: 0 }, { status: 200 })

    let updated = 0
    for (const id of ids) {
      const key = `msg:${id}`
      const msg = await env.INBOX_KV.get<InboxMessage>(key, 'json')
      if (!msg) continue
      if (msg.status !== 'read') {
        await env.INBOX_KV.put(key, JSON.stringify({ ...msg, status: 'read' }))
        updated++
      }
    }
    return json({ ok: true, updated }, { status: 200 })
  }

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
