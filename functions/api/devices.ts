type DeviceCondition = string

interface DeviceRow {
  id: string
  samsat: string
  name: string
  category: string
  serviceUnit: string
  serialNumber: string
  phoneNumber: string
  subLocation: string
  condition: DeviceCondition
  budgetYear: string
  budgetSource: string
  serviceHistory: string
  photoR2Key: string | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
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
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>
}

interface Env {
  DB?: D1Database
}

let devicesHasBudgetColumnsCache: boolean | null = null
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

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeFilled = (value: string) => {
  const v = (value || '').trim()
  if (!v) return false
  if (/^\?+$/.test(v)) return false
  if (v === '-') return false
  if (v.toLowerCase() === 'n/a') return false
  return true
}

const normalizeCondition = (raw: string) => {
  const v = (raw || '').trim()
  if (!v) return 'Kurang Baik'
  const u = v.toUpperCase()
  if ((u.includes('NON') && u.includes('AKTIF')) || u.includes('INACTIVE')) return 'Rusak'
  if (u.includes('AKTIF') || u.includes('ACTIVE')) return 'Baik'
  if (u.includes('RUSAK') || u.includes('MATI') || u.includes('ERROR') || u.includes('TIDAK BAIK')) return 'Rusak'
  if (u.includes('KURANG') || u.includes('MINOR') || u.includes('LEMOT')) return 'Kurang Baik'
  if (u.includes('BAIK') || u.includes('NORMAL') || u.includes('OK')) return 'Baik'
  if (u.includes('LAYAR')) return 'Rusak'
  return 'Kurang Baik'
}

const normalizeSamsatName = (raw: string) => {
  const s = String(raw || '').trim().toUpperCase()
  if (s === 'SAMSAT BANJARMASIN 1') return 'SAMSAT BANJARMASIN I'
  if (s === 'SAMSAT BANJARMASIN 2') return 'SAMSAT BANJARMASIN II'
  return s
}

const parseCsvLine = (line: string, separator: string) => {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && ch === separator) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  cells.push(current.trim())
  return cells
}

const parseSheetCSV = (csvData: string, defaultSamsat: string): DeviceRow[] => {
  const lines = csvData.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return []

  const firstLine = lines[0]
  const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ','

  let currentSamsat = defaultSamsat
  const out: DeviceRow[] = []
  let budgetYearIndex: number | null = null
  let budgetSourceIndex: number | null = null
  let serviceHistoryIndex: number | null = null

  lines.forEach((line, index) => {
    const cells = parseCsvLine(line, separator)

    if (budgetYearIndex === null || budgetSourceIndex === null || serviceHistoryIndex === null) {
      const headerLike = cells.some(c => /TAHUN|ANGGARAN|RIWAYAT|SERVIS|SERVICE|SUMBER/i.test(c || ''))
      const hasNoColumn = cells.some(c => /^NO\.?$/i.test((c || '').trim()))
      if (headerLike && hasNoColumn) {
        cells.forEach((c, idx) => {
          const t = String(c || '').trim()
          if (!t) return
          if (budgetYearIndex === null && /TAHUN.*ANGGARAN|ANGGARAN.*TAHUN/i.test(t)) budgetYearIndex = idx
          if (budgetSourceIndex === null && /SUMBER.*ANGGARAN|ANGGARAN.*SUMBER/i.test(t)) budgetSourceIndex = idx
          if (serviceHistoryIndex === null && /RIWAYAT.*SERVIS|RIWAYAT.*SERVICE|HISTORY.*SERVIS|HISTORY.*SERVICE/i.test(t)) serviceHistoryIndex = idx
        })
      }
    }

    if (cells.length < 2) {
      if ((cells[0] || '').toUpperCase().includes('SAMSAT')) {
        let name = (cells[0] || '').trim()
        name = name.replace(/UPPD\s+/gi, '').trim()
        name = name.replace(/^SAMSAT\s+/gi, '').trim()
        currentSamsat = normalizeSamsatName('SAMSAT ' + name)
      }
      return
    }

    const nonInternalEmpty = cells.filter(c => c !== '').length
    const potentialSamsat = cells.find(c => (c || '').toUpperCase().includes('SAMSAT'))
    if (potentialSamsat && nonInternalEmpty <= 3 && !/^\d+$/.test(cells[0] || '')) {
      let name = potentialSamsat.trim()
      name = name.replace(/UPPD\s+/gi, '').trim()
      name = name.replace(/^SAMSAT\s+/gi, '').trim()
      currentSamsat = normalizeSamsatName('SAMSAT ' + name)
      return
    }

    const isDataRow = /^\d+$/.test(cells[0] || '') && cells.length >= 5
    if (!isDataRow) return

    let finalSamsat = normalizeSamsatName(currentSamsat)
    let finalServiceUnit = cells[4] || 'Umum'

    if (currentSamsat.toUpperCase().includes('HANDIL BAKTI')) {
      finalSamsat = 'SAMSAT MARABAHAN'
      finalServiceUnit = 'SAMSAT BANTU HANDIL BAKTI'
    }
    if (currentSamsat.toUpperCase().includes('JEJAK')) {
      finalSamsat = 'SAMSAT MARABAHAN'
      finalServiceUnit = 'SAMSAT JEJAK'
    }

    const serialNumberRaw = (cells[3] || '').trim()
    const phoneNumberRaw = (cells[8] || '').trim()
    const conditionNormalized = normalizeCondition(cells[5] || '')
    const budgetYear =
      budgetYearIndex !== null && budgetYearIndex >= 0 ? String(cells[budgetYearIndex] || '').trim() : String(cells[9] || '').trim()
    const budgetSource =
      budgetSourceIndex !== null && budgetSourceIndex >= 0 ? String(cells[budgetSourceIndex] || '').trim() : String(cells[10] || '').trim()
    const serviceHistory =
      serviceHistoryIndex !== null && serviceHistoryIndex >= 0 ? String(cells[serviceHistoryIndex] || '').trim() : String(cells[11] || '').trim()

    const rowNo = (cells[0] || '').trim()
    const fallbackId = rowNo ? `${defaultSamsat}-${rowNo}` : `dev-${defaultSamsat}-${index}`
    const deviceId = normalizeFilled(serialNumberRaw) ? serialNumberRaw : fallbackId

    const name = cells[1] || 'Perangkat Tanpa Nama'
    const category = (cells[1] || '').split(' ')[0] || 'Aset'

    out.push({
      id: deviceId,
      samsat: finalSamsat,
      name,
      category,
      serviceUnit: finalServiceUnit,
      serialNumber: serialNumberRaw || 'N/A',
      phoneNumber: phoneNumberRaw,
      subLocation: cells[6] || 'Staff',
      condition: conditionNormalized,
      budgetYear,
      budgetSource,
      serviceHistory,
      photoR2Key: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy: null,
    })
  })

  return out
}

const ensureSamsat = async (db: D1Database, samsatName: string) => {
  const now = nowIso()
  const id = normalizeSamsatName(samsatName)
  await db
    .prepare(
      'INSERT INTO samsat (id, name, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at'
    )
    .bind(id, id, now, now)
    .run()
  return id
}

const hasBudgetColumns = async (db: D1Database) => {
  if (devicesHasBudgetColumnsCache !== null) return devicesHasBudgetColumnsCache
  try {
    const res = await db.prepare("PRAGMA table_info('devices')").all<Record<string, unknown>>()
    const names = new Set(res.results.map(r => String(r.name || '').toLowerCase()))
    devicesHasBudgetColumnsCache =
      names.has('budget_year') && names.has('budget_source') && names.has('service_history')
    return devicesHasBudgetColumnsCache
  } catch {
    devicesHasBudgetColumnsCache = false
    return false
  }
}

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

const mapDeviceRow = (row: Record<string, unknown>): DeviceRow => {
  const r2Key = row.photo_r2_key ? String(row.photo_r2_key) : null
  const hasPhoto = Boolean(Number(row.has_photo || 0))
  return {
    id: String(row.id || ''),
    samsat: normalizeSamsatName(String(row.samsat || row.samsat_id || '')),
    name: String(row.name || ''),
    category: String(row.category || ''),
    serviceUnit: String(row.service_unit || row.serviceUnit || ''),
    serialNumber: String(row.serial_number || row.serialNumber || ''),
    phoneNumber: String(row.phone_number || row.phoneNumber || ''),
    subLocation: String(row.holder_name || row.subLocation || ''),
    condition: String(row.condition || ''),
    budgetYear: String(row.budget_year || row.budgetYear || ''),
    budgetSource: String(row.budget_source || row.budgetSource || ''),
    serviceHistory: String(row.service_history || row.serviceHistory || ''),
    photoR2Key: r2Key || (hasPhoto ? 'd1' : null),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  }
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })
  const url = new URL(request.url)
  const samsat = (url.searchParams.get('samsat') || '').trim()
  const q = (url.searchParams.get('q') || '').trim()
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)))
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

  const where: string[] = ['d.deleted_at IS NULL']
  const args: unknown[] = []

  if (samsat) {
    where.push('s.name = ?')
    args.push(normalizeSamsatName(samsat))
  }

  if (q) {
    where.push('(d.name LIKE ? OR d.serial_number LIKE ? OR d.holder_name LIKE ? OR d.service_unit LIKE ?)')
    const like = `%${q}%`
    args.push(like, like, like, like)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const withBudget = await hasBudgetColumns(env.DB)
  const budgetSelect = withBudget ? 'd.budget_year, d.budget_source, d.service_history,' : ''
  const withPhotoDataUrl = await hasPhotoDataUrlColumn(env.DB)
  const hasPhotoExpr = withPhotoDataUrl
    ? 'CASE WHEN d.photo_r2_key IS NOT NULL OR d.photo_data_url IS NOT NULL THEN 1 ELSE 0 END AS has_photo,'
    : 'CASE WHEN d.photo_r2_key IS NOT NULL THEN 1 ELSE 0 END AS has_photo,'
  const sql = `
    SELECT
      d.id, d.name, d.category, d.service_unit, d.serial_number, d.phone_number, d.holder_name, d.condition,
      ${budgetSelect}
      ${hasPhotoExpr}
      d.photo_r2_key, d.created_at, d.updated_at, d.updated_by,
      s.name AS samsat
    FROM devices d
    JOIN samsat s ON s.id = d.samsat_id
    ${whereSql}
    ORDER BY d.updated_at DESC, d.created_at DESC
    LIMIT ? OFFSET ?
  `

  const res = await env.DB.prepare(sql).bind(...args, limit, offset).all<Record<string, unknown>>()
  const items = res.results.map(mapDeviceRow)
  return json({ items }, { status: 200 })
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
  const action = String(data.action || 'create')

  if (action === 'delete') {
    const idRaw = String(data.id || '')
    const candidates = Array.from(new Set([idRaw, idRaw.trim()])).filter(v => v)
    if (candidates.length === 0) return json({ error: 'id wajib diisi' }, { status: 400 })
    let id: string | null = null
    for (const c of candidates) {
      const found = await env.DB.prepare('SELECT id FROM devices WHERE id = ? AND deleted_at IS NULL').bind(c).first<Record<string, unknown>>()
      if (found?.id) {
        id = String(found.id)
        break
      }
    }
    if (!id) return json({ error: 'perangkat tidak ditemukan' }, { status: 404 })
    const now = nowIso()
    await env.DB.prepare('UPDATE devices SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id).run()
    return json({ ok: true }, { status: 200 })
  }

  if (action === 'update') {
    const payload = data.payload && typeof data.payload === 'object' ? (data.payload as Record<string, unknown>) : null
    if (!payload) return json({ error: 'payload wajib diisi' }, { status: 400 })
    const samsat = String(payload.samsat || '').trim()
    const name = String(payload.name || '').trim()
    const category = String(payload.category || '').trim()
    const serviceUnit = String(payload.serviceUnit || payload.service_unit || '').trim()
    const serialNumber = String(payload.serialNumber || payload.serial_number || '').trim()
    const phoneNumber = String(payload.phoneNumber || payload.phone_number || '').trim()
    const subLocation = String(payload.subLocation || payload.holder_name || '').trim()
    const condition = normalizeCondition(String(payload.condition || ''))
    const budgetYear = String(payload.budgetYear || payload.budget_year || '').trim()
    const budgetSource = String(payload.budgetSource || payload.budget_source || '').trim()
    const serviceHistory = String(payload.serviceHistory || payload.service_history || '').trim()
    const updatedBy = payload.updatedBy ? String(payload.updatedBy) : null

    if (!samsat || !name || !serviceUnit) return json({ error: 'samsat, name, serviceUnit wajib diisi' }, { status: 400 })

    const samsatId = await ensureSamsat(env.DB, samsat)
    const idRaw = String(payload.id || '')
    const idCandidates = Array.from(new Set([idRaw, idRaw.trim()])).filter(v => v)
    let id: string | null = null
    for (const c of idCandidates) {
      const found = await env.DB.prepare('SELECT id FROM devices WHERE id = ? AND deleted_at IS NULL').bind(c).first<Record<string, unknown>>()
      if (found?.id) {
        id = String(found.id)
        break
      }
    }
    if (!id && serialNumber && serialNumber.toLowerCase() !== 'n/a') {
      const found = await env.DB
        .prepare(
          `SELECT id
           FROM devices
           WHERE samsat_id = ? AND deleted_at IS NULL
             AND UPPER(TRIM(serial_number)) = UPPER(TRIM(?))
           LIMIT 1`
        )
        .bind(samsatId, serialNumber)
        .first<Record<string, unknown>>()
      if (found?.id) id = String(found.id)
    }
    if (!id) return json({ error: 'perangkat tidak ditemukan' }, { status: 404 })
    const now = nowIso()
    const withBudget = await hasBudgetColumns(env.DB)
    if (withBudget) {
      await env.DB
        .prepare(
          `UPDATE devices
           SET samsat_id=?, name=?, category=?, service_unit=?, serial_number=?, phone_number=?, holder_name=?, condition=?, budget_year=?, budget_source=?, service_history=?, updated_at=?, updated_by=?
           WHERE id=? AND deleted_at IS NULL`
        )
        .bind(samsatId, name, category || 'Aset', serviceUnit, serialNumber || 'N/A', phoneNumber, subLocation || 'Staff', condition || 'Baik', budgetYear, budgetSource, serviceHistory, now, updatedBy, id)
        .run()
    } else {
      await env.DB
        .prepare(
          `UPDATE devices
           SET samsat_id=?, name=?, category=?, service_unit=?, serial_number=?, phone_number=?, holder_name=?, condition=?, updated_at=?, updated_by=?
           WHERE id=? AND deleted_at IS NULL`
        )
        .bind(samsatId, name, category || 'Aset', serviceUnit, serialNumber || 'N/A', phoneNumber, subLocation || 'Staff', condition || 'Baik', now, updatedBy, id)
        .run()
    }

    return json({ ok: true }, { status: 200 })
  }

  if (action === 'importSheets') {
    const baseUrl =
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqd9Fuc8MRfwWgzB5TJ-8trqSCerRy5-mbzhy-wJo_faoLLe9JItOxyKXBJ2A9l8MpFoswgpTxfxN1/pub?output=csv&gid='

    const sheets: Array<{ name: string; gid: string }> = [
      { name: 'SAMSAT BANJARMASIN I', gid: '0' },
      { name: 'SAMSAT BANJARMASIN II', gid: '1710409913' },
      { name: 'SAMSAT BANJARBARU', gid: '11591526' },
      { name: 'SAMSAT MARTAPURA', gid: '1933191535' },
      { name: 'SAMSAT RANTAU', gid: '1105810683' },
      { name: 'SAMSAT KANDANGAN', gid: '235119847' },
      { name: 'SAMSAT BARABAI', gid: '1243457458' },
      { name: 'SAMSAT AMUNTAI', gid: '1843850468' },
      { name: 'SAMSAT TANJUNG', gid: '605123251' },
      { name: 'SAMSAT PARINGIN', gid: '1278642870' },
      { name: 'SAMSAT MARABAHAN', gid: '1709839473' },
      { name: 'SAMSAT PELAIHARI', gid: '1979165441' },
      { name: 'SAMSAT BATULICIN', gid: '2078825373' },
      { name: 'SAMSAT KOTABARU', gid: '1643121233' },
    ]

    const allDevices: DeviceRow[] = []

    const results = await Promise.allSettled(
      sheets.map(async (s) => {
        const url = baseUrl + encodeURIComponent(s.gid)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Fetch gagal: ${s.name}`)
        const csv = await res.text()
        return parseSheetCSV(csv, s.name)
      })
    )

    results.forEach((r) => {
      if (r.status === 'fulfilled') allDevices.push(...r.value)
    })

    const now = nowIso()
    let upserted = 0
    // Pastikan entri samsat dibuat dulu agar batch devices tidak gagal karena FK
    const samsatNames = Array.from(new Set(allDevices.map(d => d.samsat)))
    for (const s of samsatNames) {
      await ensureSamsat(env.DB, s)
    }

    // Batch upsert devices agar tidak timeout
    const chunkSize = 50
    const withBudget = await hasBudgetColumns(env.DB)
    for (let i = 0; i < allDevices.length; i += chunkSize) {
      const chunk = allDevices.slice(i, i + chunkSize)
      const stmts: D1PreparedStatement[] = []
      for (const d of chunk) {
        const samsatId = d.samsat
        const stmt = withBudget
          ? env.DB
              .prepare(
                `INSERT INTO devices
                 (id, samsat_id, name, category, service_unit, serial_number, phone_number, holder_name, condition, budget_year, budget_source, service_history, photo_r2_key, created_at, updated_at, updated_by, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)
                 ON CONFLICT(id) DO UPDATE SET
                   samsat_id=excluded.samsat_id,
                   name=excluded.name,
                   category=excluded.category,
                   service_unit=excluded.service_unit,
                   serial_number=excluded.serial_number,
                   phone_number=excluded.phone_number,
                   holder_name=excluded.holder_name,
                   condition=excluded.condition,
                   budget_year=excluded.budget_year,
                   budget_source=excluded.budget_source,
                   service_history=excluded.service_history,
                   updated_at=excluded.updated_at,
                   deleted_at=NULL`
              )
              .bind(d.id, samsatId, d.name, d.category, d.serviceUnit, d.serialNumber, d.phoneNumber, d.subLocation, d.condition, d.budgetYear, d.budgetSource, d.serviceHistory, now, now)
          : env.DB
              .prepare(
                `INSERT INTO devices
                 (id, samsat_id, name, category, service_unit, serial_number, phone_number, holder_name, condition, photo_r2_key, created_at, updated_at, updated_by, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)
                 ON CONFLICT(id) DO UPDATE SET
                   samsat_id=excluded.samsat_id,
                   name=excluded.name,
                   category=excluded.category,
                   service_unit=excluded.service_unit,
                   serial_number=excluded.serial_number,
                   phone_number=excluded.phone_number,
                   holder_name=excluded.holder_name,
                   condition=excluded.condition,
                   updated_at=excluded.updated_at,
                   deleted_at=NULL`
              )
              .bind(d.id, samsatId, d.name, d.category, d.serviceUnit, d.serialNumber, d.phoneNumber, d.subLocation, d.condition, now, now)
        stmts.push(stmt)
      }
      if (stmts.length) {
        await env.DB.batch(stmts)
        upserted += stmts.length
      }
    }

    return json({ ok: true, upserted }, { status: 200 })
  }

  const payload = data.payload && typeof data.payload === 'object' ? (data.payload as Record<string, unknown>) : null
  if (!payload) return json({ error: 'payload wajib diisi' }, { status: 400 })

  const samsat = String(payload.samsat || '').trim()
  const name = String(payload.name || '').trim()
  const category = String(payload.category || '').trim()
  const serviceUnit = String(payload.serviceUnit || payload.service_unit || '').trim()
  const serialNumber = String(payload.serialNumber || payload.serial_number || '').trim()
  const phoneNumber = String(payload.phoneNumber || payload.phone_number || '').trim()
  const subLocation = String(payload.subLocation || payload.holder_name || '').trim()
  const condition = normalizeCondition(String(payload.condition || ''))
  const budgetYear = String(payload.budgetYear || payload.budget_year || '').trim()
  const budgetSource = String(payload.budgetSource || payload.budget_source || '').trim()
  const serviceHistory = String(payload.serviceHistory || payload.service_history || '').trim()
  const id = String(payload.id || '').trim() || newId()

  if (!samsat || !name || !serviceUnit) return json({ error: 'samsat, name, serviceUnit wajib diisi' }, { status: 400 })

  const samsatId = await ensureSamsat(env.DB, samsat)
  const now = nowIso()

  const existing = await env.DB.prepare('SELECT id FROM devices WHERE id = ? AND deleted_at IS NULL').bind(id).first()
  if (existing) return json({ error: 'Perangkat dengan SN/ID ini sudah ada di database.' }, { status: 409 })

  const withBudget = await hasBudgetColumns(env.DB)
  if (withBudget) {
    await env.DB
      .prepare(
        `INSERT INTO devices
         (id, samsat_id, name, category, service_unit, serial_number, phone_number, holder_name, condition, budget_year, budget_source, service_history, photo_r2_key, created_at, updated_at, updated_by, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)`
      )
      .bind(id, samsatId, name, category || 'Aset', serviceUnit, serialNumber || 'N/A', phoneNumber, subLocation || 'Staff', condition || 'Baik', budgetYear, budgetSource, serviceHistory, now, now)
      .run()
  } else {
    await env.DB
      .prepare(
        `INSERT INTO devices
         (id, samsat_id, name, category, service_unit, serial_number, phone_number, holder_name, condition, photo_r2_key, created_at, updated_at, updated_by, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)`
      )
      .bind(id, samsatId, name, category || 'Aset', serviceUnit, serialNumber || 'N/A', phoneNumber, subLocation || 'Staff', condition || 'Baik', now, now)
      .run()
  }

  return json({ ok: true, id }, { status: 200 })
}
