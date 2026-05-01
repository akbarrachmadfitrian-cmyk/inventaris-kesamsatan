interface Env {
    DB: D1Database;
    TURNSTILE_SECRET_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    
    try {
        const body = await request.json() as any;
        const { username, password, turnstileToken } = body;
        
        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Username dan password wajib diisi' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verify Turnstile CAPTCHA if secret key is configured
        if (env.TURNSTILE_SECRET_KEY) {
            if (!turnstileToken) {
                return new Response(JSON.stringify({ error: 'Verifikasi CAPTCHA diperlukan' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: env.TURNSTILE_SECRET_KEY,
                    response: turnstileToken,
                    remoteip: request.headers.get('CF-Connecting-IP') || ''
                })
            });

            const turnstileData = await turnstileRes.json() as any;
            if (!turnstileData.success) {
                return new Response(JSON.stringify({ error: 'Verifikasi CAPTCHA gagal, silakan coba lagi' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 1. Hash the incoming password with SHA-256 (matching our seed format)
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Query database for user
        const user = await env.DB.prepare(
            'SELECT username, role, can_manage_login, allowed_samsat FROM users WHERE username = ? AND password_hash = ?'
        ).bind(username.toLowerCase(), passwordHash).first() as any;

        if (!user) {
            return new Response(JSON.stringify({ error: 'Username atau password salah' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. Parse allowed_samsat if it's a string
        let allowedSamsat = [];
        try {
            allowedSamsat = JSON.parse(user.allowed_samsat || '[]');
        } catch {
            allowedSamsat = user.allowed_samsat ? [user.allowed_samsat] : [];
        }

        return new Response(JSON.stringify({
            success: true,
            user: {
                username: user.username,
                role: user.role,
                canManageLogin: Boolean(user.can_manage_login),
                allowedSamsat: allowedSamsat,
                loggedInAt: new Date().toISOString()
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
