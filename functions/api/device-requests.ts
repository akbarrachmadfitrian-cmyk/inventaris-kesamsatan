type StockStatus = 'ready' | 'empty' | 'standby'
type ApprovalStatus = 'approved' | 'rejected' | 'pending'
type RequestType = 'PC KESAMSATAN' | 'PRINTER KESAMSATAN'

interface DeviceRequestLetterMeta {
  fileName: string
  mimeType: string
  uploadedAt: string
  dataUrl?: string
}

interface DeviceRequestState {
  samsat: string
  requestType: RequestType
  requestedCount: number
  letter: DeviceRequestLetterMeta | null
  stockStatus: StockStatus
  kabid: { status: ApprovalStatus; approvedCount: number | null }
  sekban: { status: ApprovalStatus; approvedCount: number | null }
  addedDeviceIds: string[]
  finalizedAt: string | null
}

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

interface Env {
  DB?: D1Database
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

const createDefaultRequest = (samsat: string): DeviceRequestState => ({
  samsat,
  requestType: 'PC KESAMSATAN',
  requestedCount: 0,
  letter: null,
  stockStatus: 'standby',
  kabid: { status: 'pending', approvedCount: null },
  sekban: { status: 'pending', approvedCount: null },
  addedDeviceIds: [],
  finalizedAt: null,
})

const ensureSamsat = async (db: D1Database, samsatName: string) => {
  const now = nowIso()
  const id = samsatName.trim()
  await db
    .prepare(
      'INSERT INTO samsat (id, name, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at'
    )
    .bind(id, id, now, now)
    .run()
  return id
}

const parseRequestRow = (row: Record<string, unknown>): DeviceRequestState => {
  const samsat = String(row.samsat || row.samsat_id || '')
  const addedRaw = String(row.added_device_ids_json || '[]')
  let addedDeviceIds: string[] = []
  try {
    const parsed = JSON.parse(addedRaw)
    if (Array.isArray(parsed)) addedDeviceIds = parsed.map(v => String(v))
  } catch {
    addedDeviceIds = []
  }

  const letterFile = row.letter_file_name ? String(row.letter_file_name) : ''
  const letterMime = row.letter_mime_type ? String(row.letter_mime_type) : ''
  const letterUploadedAt = row.letter_uploaded_at ? String(row.letter_uploaded_at) : ''

  const letter = letterFile
    ? { fileName: letterFile, mimeType: letterMime || 'application/octet-stream', uploadedAt: letterUploadedAt || nowIso(), dataUrl: '' }
    : null

  const requestType = (String(row.request_type || 'PC KESAMSATAN') as RequestType) || 'PC KESAMSATAN'
  const requestedCount = Math.max(0, Number(row.requested_count || 0))
  const stockStatus = (String(row.stock_status || 'standby') as StockStatus) || 'standby'

  const kabidStatus = (String(row.kabid_status || 'pending') as ApprovalStatus) || 'pending'
  const kabidApproved = row.kabid_approved_count === null || row.kabid_approved_count === undefined ? null : Number(row.kabid_approved_count)
  const sekbanStatus = (String(row.sekban_status || 'pending') as ApprovalStatus) || 'pending'
  const sekbanApproved = row.sekban_approved_count === null || row.sekban_approved_count === undefined ? null : Number(row.sekban_approved_count)

  return {
    samsat,
    requestType,
    requestedCount,
    letter,
    stockStatus,
    kabid: { status: kabidStatus, approvedCount: Number.isFinite(kabidApproved) ? kabidApproved : null },
    sekban: { status: sekbanStatus, approvedCount: Number.isFinite(sekbanApproved) ? sekbanApproved : null },
    addedDeviceIds,
    finalizedAt: row.finalized_at ? String(row.finalized_at) : null,
  }
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })
  const url = new URL(request.url)
  const samsat = (url.searchParams.get('samsat') || '').trim()
  if (!samsat) return json({ error: 'samsat wajib diisi' }, { status: 400 })

  const row = await env.DB
    .prepare(
      `SELECT r.*, s.name AS samsat
       FROM device_requests r
       JOIN samsat s ON s.id = r.samsat_id
       WHERE r.samsat_id = ?`
    )
    .bind(samsat)
    .first<Record<string, unknown>>()

  if (!row) return json({ item: createDefaultRequest(samsat) }, { status: 200 })
  return json({ item: parseRequestRow(row) }, { status: 200 })
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const action = String(data.action || 'save')

  if (action !== 'save') return json({ error: 'action tidak dikenal' }, { status: 400 })

  const payload = data.payload && typeof data.payload === 'object' ? (data.payload as Record<string, unknown>) : null
  if (!payload) return json({ error: 'payload wajib diisi' }, { status: 400 })

  const samsat = String(payload.samsat || '').trim()
  if (!samsat) return json({ error: 'payload.samsat wajib diisi' }, { status: 400 })
  const samsatId = await ensureSamsat(env.DB, samsat)

  const requestType = String(payload.requestType || 'PC KESAMSATAN').trim()
  const requestedCount = Math.max(0, Number(payload.requestedCount || 0))
  const stockStatus = String(payload.stockStatus || 'standby').trim()

  const kabid = payload.kabid && typeof payload.kabid === 'object' ? (payload.kabid as Record<string, unknown>) : {}
  const sekban = payload.sekban && typeof payload.sekban === 'object' ? (payload.sekban as Record<string, unknown>) : {}

  const kabidStatus = String(kabid.status || 'pending')
  const kabidApprovedCount = kabid.approvedCount === null || kabid.approvedCount === undefined ? null : Math.max(0, Number(kabid.approvedCount))
  const sekbanStatus = String(sekban.status || 'pending')
  const sekbanApprovedCount = sekban.approvedCount === null || sekban.approvedCount === undefined ? null : Math.max(0, Number(sekban.approvedCount))

  const addedDeviceIdsRaw = payload.addedDeviceIds
  const addedDeviceIds = Array.isArray(addedDeviceIdsRaw) ? addedDeviceIdsRaw.map(v => String(v)) : []
  const addedDeviceIdsJson = JSON.stringify(addedDeviceIds)
  const finalizedAt = payload.finalizedAt ? String(payload.finalizedAt) : null

  const letter = payload.letter && typeof payload.letter === 'object' ? (payload.letter as Record<string, unknown>) : null
  const letterFileName = letter?.fileName ? String(letter.fileName) : null
  const letterMimeType = letter?.mimeType ? String(letter.mimeType) : null
  const letterUploadedAt = letter?.uploadedAt ? String(letter.uploadedAt) : null

  const now = nowIso()
  const existing = await env.DB.prepare('SELECT samsat_id, created_at FROM device_requests WHERE samsat_id = ?').bind(samsatId).first<Record<string, unknown>>()
  const createdAt = existing?.created_at ? String(existing.created_at) : now

  await env.DB
    .prepare(
      `INSERT INTO device_requests
       (samsat_id, request_type, requested_count, stock_status, kabid_status, kabid_approved_count, sekban_status, sekban_approved_count, added_device_ids_json, finalized_at, letter_file_name, letter_mime_type, letter_uploaded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(samsat_id) DO UPDATE SET
         request_type=excluded.request_type,
         requested_count=excluded.requested_count,
         stock_status=excluded.stock_status,
         kabid_status=excluded.kabid_status,
         kabid_approved_count=excluded.kabid_approved_count,
         sekban_status=excluded.sekban_status,
         sekban_approved_count=excluded.sekban_approved_count,
         added_device_ids_json=excluded.added_device_ids_json,
         finalized_at=excluded.finalized_at,
         letter_file_name=excluded.letter_file_name,
         letter_mime_type=excluded.letter_mime_type,
         letter_uploaded_at=excluded.letter_uploaded_at,
         updated_at=excluded.updated_at`
    )
    .bind(
      samsatId,
      requestType,
      requestedCount,
      stockStatus,
      kabidStatus,
      Number.isFinite(kabidApprovedCount as number) ? kabidApprovedCount : null,
      sekbanStatus,
      Number.isFinite(sekbanApprovedCount as number) ? sekbanApprovedCount : null,
      addedDeviceIdsJson,
      finalizedAt,
      letterFileName,
      letterMimeType,
      letterUploadedAt,
      createdAt,
      now
    )
    .run()

  return json({ ok: true }, { status: 200 })
}
