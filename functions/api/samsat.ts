interface D1Result<T> {
  results: T[]
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T = unknown>(): Promise<D1Result<T>>
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

const normalizeSamsatName = (raw: string) => {
  const s = String(raw || '').trim().toUpperCase()
  if (s === 'SAMSAT BANJARMASIN 1') return 'SAMSAT BANJARMASIN I'
  if (s === 'SAMSAT BANJARMASIN 2') return 'SAMSAT BANJARMASIN II'
  return s
}

export async function onRequestGet({ env }: { env: Env }) {
  if (!env.DB) return json({ error: 'DB belum dikonfigurasi' }, { status: 500 })

  const res = await env.DB
    .prepare(
      `SELECT s.name AS samsat, COUNT(d.id) AS total
       FROM samsat s
       LEFT JOIN devices d
         ON d.samsat_id = s.id AND d.deleted_at IS NULL
       GROUP BY s.id
       ORDER BY total DESC, s.name ASC`
    )
    .all<Record<string, unknown>>()

  const raw = res.results.map(r => ({
    samsat: normalizeSamsatName(String(r.samsat || '')),
    total: Number(r.total || 0),
  }))

  // Merge entries that normalize to the same name
  const merged = new Map<string, number>()
  for (const r of raw) {
    merged.set(r.samsat, (merged.get(r.samsat) || 0) + r.total)
  }
  const items = Array.from(merged.entries())
    .map(([samsat, total]) => ({ samsat, total }))
    .sort((a, b) => b.total - a.total || a.samsat.localeCompare(b.samsat))

  return json({ items }, { status: 200 })
}

