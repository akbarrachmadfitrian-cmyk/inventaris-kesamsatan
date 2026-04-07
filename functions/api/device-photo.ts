interface D1Result<T> {
  results: T[]
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<{ success: boolean }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface R2ObjectBody {
  body: ReadableStream
  httpMetadata?: { contentType?: string }
  writeHttpMetadata(headers: Headers): void
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string }
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: R2PutOptions): Promise<void>
  delete(keys: string | string[]): Promise<void>
}

interface Env {
  DB?: D1Database
  PHOTOS?: R2Bucket
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

const extFromMime = (mime: string) => {
  const m = (mime || '').toLowerCase()
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  return 'bin'
}

const sanitizeId = (raw: string) => String(raw || '').trim().replace(/[^\w.-]/g, '_')

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })
  if (!env.PHOTOS) return json({ error: 'PHOTOS bucket belum dikonfigurasi' }, { status: 500 })

  const url = new URL(request.url)
  const deviceId = String(url.searchParams.get('deviceId') || '').trim()
  if (!deviceId) return json({ error: 'deviceId wajib diisi' }, { status: 400 })

  const row = await env.DB
    .prepare('SELECT photo_r2_key FROM devices WHERE id = ? AND deleted_at IS NULL')
    .bind(deviceId)
    .first<Record<string, unknown>>()

  const key = row?.photo_r2_key ? String(row.photo_r2_key) : ''
  if (!key) return json({ error: 'foto tidak ditemukan' }, { status: 404 })

  const obj = await env.PHOTOS.get(key)
  if (!obj) return json({ error: 'foto tidak ditemukan' }, { status: 404 })

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  if (!headers.get('content-type')) {
    headers.set('content-type', obj.httpMetadata?.contentType || 'application/octet-stream')
  }
  headers.set('cache-control', 'private, no-store')

  return new Response(obj.body, { status: 200, headers })
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })
  if (!env.PHOTOS) return json({ error: 'PHOTOS bucket belum dikonfigurasi' }, { status: 500 })

  const contentType = String(request.headers.get('content-type') || '')

  let action = ''
  let deviceId = ''
  let file: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    action = String(form.get('action') || 'upload')
    deviceId = String(form.get('deviceId') || '')
    const f = form.get('file')
    file = f instanceof File ? f : null
  } else {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    action = String(data.action || '')
    deviceId = String(data.deviceId || '')
  }

  const id = String(deviceId || '').trim()
  if (!id) return json({ error: 'deviceId wajib diisi' }, { status: 400 })

  const existing = await env.DB
    .prepare('SELECT id, photo_r2_key FROM devices WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing?.id) return json({ error: 'perangkat tidak ditemukan' }, { status: 404 })

  const prevKey = existing.photo_r2_key ? String(existing.photo_r2_key) : ''

  if (action === 'delete') {
    if (prevKey) await env.PHOTOS.delete(prevKey)
    const now = nowIso()
    await env.DB
      .prepare('UPDATE devices SET photo_r2_key = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL')
      .bind(now, 'photo', id)
      .run()
    return json({ ok: true }, { status: 200 })
  }

  if (action !== 'upload') return json({ error: 'action tidak dikenal' }, { status: 400 })
  if (!file) return json({ error: 'file wajib diisi' }, { status: 400 })

  const maxBytes = 5 * 1024 * 1024
  if (file.size > maxBytes) return json({ error: 'ukuran foto maksimal 5MB' }, { status: 413 })

  const mime = String(file.type || 'application/octet-stream')
  const ext = extFromMime(mime)
  const key = `devices/${sanitizeId(id)}/${Date.now()}.${ext}`

  const buf = await file.arrayBuffer()
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: mime } })
  if (prevKey) await env.PHOTOS.delete(prevKey)

  const now = nowIso()
  await env.DB
    .prepare('UPDATE devices SET photo_r2_key = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL')
    .bind(key, now, 'photo', id)
    .run()

  return json({ ok: true, photoR2Key: key }, { status: 200 })
}

