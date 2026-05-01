interface Env {
  ADMIN_API_KEY?: string
  DB: D1Database
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  })

const requireAdmin = (request: Request, env: Env) => {
  const expected = String(env.ADMIN_API_KEY || '')
  if (!expected) return json({ error: 'ADMIN_API_KEY belum dikonfigurasi' }, { status: 500 })
  const provided = String(request.headers.get('x-admin-key') || '')
  if (provided !== expected) return json({ error: 'Akses ditolak' }, { status: 403 })
  return null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const denied = requireAdmin(request, env)
  if (denied) return denied

  try {
    const body = await request.json() as any
    const { username, newPassword } = body

    if (!username || !newPassword) {
      return json({ error: 'Username dan password baru wajib diisi' }, { status: 400 })
    }

    // Hash the new password with SHA-256 to match database format
    const msgUint8 = new TextEncoder().encode(newPassword)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Check if user exists
    const user = await env.DB.prepare('SELECT username FROM users WHERE username = ?')
      .bind(username.toLowerCase())
      .first()

    if (!user) {
      return json({ error: 'Username tidak ditemukan di database' }, { status: 404 })
    }

    // Update password
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE username = ?')
      .bind(passwordHash, username.toLowerCase())
      .run()

    return json({ success: true, message: `Password untuk user '${username}' berhasil diperbarui` }, { status: 200 })

  } catch (err: any) {
    return json({ error: 'Internal Server Error', details: err.message }, { status: 500 })
  }
}
