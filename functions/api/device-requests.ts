type StockStatus = 'ready' | 'empty' | 'standby'
type ApprovalStatus = 'approved' | 'rejected' | 'pending'
type RequestType = 'PC KESAMSATAN' | 'PRINTER KESAMSATAN' | 'PC & PRINTER KESAMSATAN'

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
  requestedCountPC: number
  requestedCountPrinter: number
  letter: DeviceRequestLetterMeta | null
  beritaAcara: DeviceRequestLetterMeta | null
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

let deviceRequestsHasFileColumnsCache: boolean | null = null
let deviceRequestsHasCountColumnsCache: boolean | null = null

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
  requestedCountPC: 0,
  requestedCountPrinter: 0,
  letter: null,
  beritaAcara: null,
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

const hasFileColumns = async (db: D1Database) => {
  if (deviceRequestsHasFileColumnsCache !== null) return deviceRequestsHasFileColumnsCache
  try {
    const res = await db.prepare("PRAGMA table_info('device_requests')").all<Record<string, unknown>>()
    const names = new Set(res.results.map(r => String(r.name || '').toLowerCase()))
    deviceRequestsHasFileColumnsCache =
      names.has('letter_data_url') && names.has('ba_data_url') && names.has('ba_file_name') && names.has('ba_mime_type') && names.has('ba_uploaded_at')
    return deviceRequestsHasFileColumnsCache
  } catch {
    deviceRequestsHasFileColumnsCache = false
    return false
  }
}

const hasCountColumns = async (db: D1Database) => {
  if (deviceRequestsHasCountColumnsCache !== null) return deviceRequestsHasCountColumnsCache
  try {
    const res = await db.prepare("PRAGMA table_info('device_requests')").all<Record<string, unknown>>()
    const names = new Set(res.results.map(r => String(r.name || '').toLowerCase()))
    deviceRequestsHasCountColumnsCache = names.has('requested_count_pc') && names.has('requested_count_printer')
    return deviceRequestsHasCountColumnsCache
  } catch {
    deviceRequestsHasCountColumnsCache = false
    return false
  }
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
  const letterDataUrl = row.letter_data_url ? String(row.letter_data_url) : ''

  const letter = letterFile
    ? { fileName: letterFile, mimeType: letterMime || 'application/octet-stream', uploadedAt: letterUploadedAt || nowIso(), dataUrl: letterDataUrl }
    : null

  const baFile = row.ba_file_name ? String(row.ba_file_name) : ''
  const baMime = row.ba_mime_type ? String(row.ba_mime_type) : ''
  const baUploadedAt = row.ba_uploaded_at ? String(row.ba_uploaded_at) : ''
  const baDataUrl = row.ba_data_url ? String(row.ba_data_url) : ''
  const beritaAcara = baFile
    ? { fileName: baFile, mimeType: baMime || 'application/pdf', uploadedAt: baUploadedAt || nowIso(), dataUrl: baDataUrl }
    : null

  const requestType = (String(row.request_type || 'PC KESAMSATAN') as RequestType) || 'PC KESAMSATAN'
  const requestedCount = Math.max(0, Number(row.requested_count || 0))
  const hasPc = row.requested_count_pc !== undefined
  const hasPrinter = row.requested_count_printer !== undefined
  const requestedCountPC = hasPc ? Math.max(0, Number(row.requested_count_pc || 0)) : requestType === 'PC & PRINTER KESAMSATAN' ? requestedCount : 0
  const requestedCountPrinter = hasPrinter ? Math.max(0, Number(row.requested_count_printer || 0)) : 0
  const stockStatus = (String(row.stock_status || 'standby') as StockStatus) || 'standby'

  const kabidStatus = (String(row.kabid_status || 'pending') as ApprovalStatus) || 'pending'
  const kabidApproved = row.kabid_approved_count === null || row.kabid_approved_count === undefined ? null : Number(row.kabid_approved_count)
  const sekbanStatus = (String(row.sekban_status || 'pending') as ApprovalStatus) || 'pending'
  const sekbanApproved = row.sekban_approved_count === null || row.sekban_approved_count === undefined ? null : Number(row.sekban_approved_count)

  return {
    samsat,
    requestType,
    requestedCount,
    requestedCountPC,
    requestedCountPrinter,
    letter,
    beritaAcara,
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
  const requestedCountPC = Math.max(0, Number(payload.requestedCountPC || 0))
  const requestedCountPrinter = Math.max(0, Number(payload.requestedCountPrinter || 0))
  const requestedCountRaw = Math.max(0, Number(payload.requestedCount || 0))
  const requestedCount =
    requestType === 'PC & PRINTER KESAMSATAN' ? requestedCountPC + requestedCountPrinter : requestedCountRaw
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
  const letterDataUrl = letter?.dataUrl ? String(letter.dataUrl) : null

  const ba = payload.beritaAcara && typeof payload.beritaAcara === 'object' ? (payload.beritaAcara as Record<string, unknown>) : null
  const baFileName = ba?.fileName ? String(ba.fileName) : null
  const baMimeType = ba?.mimeType ? String(ba.mimeType) : null
  const baUploadedAt = ba?.uploadedAt ? String(ba.uploadedAt) : null
  const baDataUrl = ba?.dataUrl ? String(ba.dataUrl) : null

  const now = nowIso()
  const existing = await env.DB.prepare('SELECT samsat_id, created_at FROM device_requests WHERE samsat_id = ?').bind(samsatId).first<Record<string, unknown>>()
  const createdAt = existing?.created_at ? String(existing.created_at) : now

  const withFiles = await hasFileColumns(env.DB)
  const withCounts = await hasCountColumns(env.DB)
  if (withFiles) {
    await env.DB
      .prepare(
        `INSERT INTO device_requests
         (samsat_id, request_type, requested_count, ${withCounts ? 'requested_count_pc, requested_count_printer,' : ''} stock_status, kabid_status, kabid_approved_count, sekban_status, sekban_approved_count, added_device_ids_json, finalized_at, letter_file_name, letter_mime_type, letter_uploaded_at, letter_data_url, ba_file_name, ba_mime_type, ba_uploaded_at, ba_data_url, created_at, updated_at)
         VALUES (?, ?, ?, ${withCounts ? '?, ?,' : ''} ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(samsat_id) DO UPDATE SET
           request_type=excluded.request_type,
           requested_count=excluded.requested_count,
           ${withCounts ? 'requested_count_pc=excluded.requested_count_pc, requested_count_printer=excluded.requested_count_printer,' : ''}
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
           letter_data_url=excluded.letter_data_url,
           ba_file_name=excluded.ba_file_name,
           ba_mime_type=excluded.ba_mime_type,
           ba_uploaded_at=excluded.ba_uploaded_at,
           ba_data_url=excluded.ba_data_url,
           updated_at=excluded.updated_at`
      )
      .bind(
        samsatId,
        requestType,
        requestedCount,
        ...(withCounts ? [requestedCountPC, requestedCountPrinter] : []),
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
        letterDataUrl,
        baFileName,
        baMimeType,
        baUploadedAt,
        baDataUrl,
        createdAt,
        now
      )
      .run()
  } else {
    await env.DB
      .prepare(
        `INSERT INTO device_requests
         (samsat_id, request_type, requested_count, ${withCounts ? 'requested_count_pc, requested_count_printer,' : ''} stock_status, kabid_status, kabid_approved_count, sekban_status, sekban_approved_count, added_device_ids_json, finalized_at, letter_file_name, letter_mime_type, letter_uploaded_at, created_at, updated_at)
         VALUES (?, ?, ?, ${withCounts ? '?, ?,' : ''} ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(samsat_id) DO UPDATE SET
           request_type=excluded.request_type,
           requested_count=excluded.requested_count,
           ${withCounts ? 'requested_count_pc=excluded.requested_count_pc, requested_count_printer=excluded.requested_count_printer,' : ''}
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
        ...(withCounts ? [requestedCountPC, requestedCountPrinter] : []),
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
  }

  return json({ ok: true }, { status: 200 })
}
