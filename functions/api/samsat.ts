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

  const items = res.results.map(r => ({
    samsat: String(r.samsat || ''),
    total: Number(r.total || 0),
  }))

  return json({ items }, { status: 200 })
}

