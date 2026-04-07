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

let devicesHasPhotoDataUrlColumnCache: boolean | null = null

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  })

const nowIso = () => new Date().toISOString()

const hasPhotoDataUrlColumn = async (db: D1Database) => {
  if (devicesHasPhotoDataUrlColumnCache !== null) return devicesHasPhotoDataUrlColumnCache
  try {
    const res = await db.prepare("PRAGMA table_info('devices')").all<Record<string, unknown>>()
    const names = new Set(res.results.map(r => String(r.name || '').toLowerCase()))
    devicesHasPhotoDataUrlColumnCache = names.has('photo_data_url')
    return devicesHasPhotoDataUrlColumnCache
  } catch {
    devicesHasPhotoDataUrlColumnCache = false
    return false
  }
}

const extFromMime = (mime: string) => {
  const m = (mime || '').toLowerCase()
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  return 'bin'
}

const sanitizeId = (raw: string) => String(raw || '').trim().replace(/[^\w.-]/g, '_')

const parseDataUrl = (dataUrl: string) => {
  const s = String(dataUrl || '')
  const m = s.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  const mime = m[1]
  const b64 = m[2]
  return { mime, b64 }
}

const base64ToUint8Array = (b64: string) => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })

  const url = new URL(request.url)
  const deviceId = String(url.searchParams.get('deviceId') || '').trim()
  if (!deviceId) return json({ error: 'deviceId wajib diisi' }, { status: 400 })

  const withPhotoDataUrl = await hasPhotoDataUrlColumn(env.DB)
  const row = await env.DB
    .prepare(withPhotoDataUrl ? 'SELECT photo_r2_key, photo_data_url FROM devices WHERE id = ? AND deleted_at IS NULL' : 'SELECT photo_r2_key FROM devices WHERE id = ? AND deleted_at IS NULL')
    .bind(deviceId)
    .first<Record<string, unknown>>()

  const key = row?.photo_r2_key ? String(row.photo_r2_key) : ''
  const dataUrl = row?.photo_data_url ? String(row.photo_data_url) : ''

  if (key && env.PHOTOS) {
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

  if (dataUrl) {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) return json({ error: 'foto tidak valid' }, { status: 500 })
    const bytes = base64ToUint8Array(parsed.b64)
    return new Response(bytes, { status: 200, headers: { 'content-type': parsed.mime, 'cache-control': 'private, no-store' } })
  }

  return json({ error: 'foto tidak ditemukan' }, { status: 404 })
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })

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

  const withPhotoDataUrl = await hasPhotoDataUrlColumn(env.DB)
  const existing = await env.DB
    .prepare(withPhotoDataUrl ? 'SELECT id, photo_r2_key, photo_data_url FROM devices WHERE id = ? AND deleted_at IS NULL' : 'SELECT id, photo_r2_key FROM devices WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<Record<string, unknown>>()

  if (!existing?.id) return json({ error: 'perangkat tidak ditemukan' }, { status: 404 })

  const prevKey = existing.photo_r2_key ? String(existing.photo_r2_key) : ''
  const prevDataUrl = existing.photo_data_url ? String(existing.photo_data_url) : ''

  if (action === 'delete') {
    if (prevKey && env.PHOTOS) await env.PHOTOS.delete(prevKey)
    const now = nowIso()
    if (withPhotoDataUrl) {
      await env.DB
        .prepare('UPDATE devices SET photo_r2_key = NULL, photo_data_url = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(now, 'photo', id)
        .run()
    } else {
      await env.DB
        .prepare('UPDATE devices SET photo_r2_key = NULL, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL')
        .bind(now, 'photo', id)
        .run()
    }
    return json({ ok: true }, { status: 200 })
  }

  if (action !== 'upload') return json({ error: 'action tidak dikenal' }, { status: 400 })
  if (!file) return json({ error: 'file wajib diisi' }, { status: 400 })

  const maxBytes = 5 * 1024 * 1024
  if (file.size > maxBytes) return json({ error: 'ukuran foto maksimal 5MB' }, { status: 413 })

  const mime = String(file.type || 'application/octet-stream')
  const ext = extFromMime(mime)

  const buf = await file.arrayBuffer()
  const now = nowIso()
  if (env.PHOTOS) {
    const key = `devices/${sanitizeId(id)}/${Date.now()}.${ext}`
    await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: mime } })
    if (prevKey) await env.PHOTOS.delete(prevKey)
    if (withPhotoDataUrl && prevDataUrl) {
      await env.DB
        .prepare('UPDATE devices SET photo_data_url = NULL WHERE id = ? AND deleted_at IS NULL')
        .bind(id)
        .run()
    }
    await env.DB
      .prepare('UPDATE devices SET photo_r2_key = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL')
      .bind(key, now, 'photo', id)
      .run()
    return json({ ok: true, photoR2Key: key }, { status: 200 })
  }

  if (!withPhotoDataUrl) {
    return json(
      { error: 'PHOTOS bucket belum dikonfigurasi, dan kolom devices.photo_data_url belum tersedia. Jalankan migration 0007_add_device_photo_data_url.sql.' },
      { status: 500 }
    )
  }

  const bytes = new Uint8Array(buf)
  let b64 = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    b64 += String.fromCharCode(...chunk)
  }
  const dataUrl = `data:${mime};base64,${btoa(b64)}`

  await env.DB
    .prepare('UPDATE devices SET photo_r2_key = NULL, photo_data_url = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL')
    .bind(dataUrl, now, 'photo', id)
    .run()

  return json({ ok: true, photoR2Key: 'd1' }, { status: 200 })
}
