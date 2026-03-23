export async function onRequestGet({ request }: { request: Request }) {
  try {
    const url = new URL(request.url)
    const gid = url.searchParams.get('gid') || '0'
    const baseUrl =
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRqd9Fuc8MRfwWgzB5TJ-8trqSCerRy5-mbzhy-wJo_faoLLe9JItOxyKXBJ2A9l8MpFoswgpTxfxN1/pub?output=csv&gid='

    const targetUrl = baseUrl + encodeURIComponent(gid)
    const upstream = await fetch(targetUrl)
    const body = await upstream.text()

    return new Response(body, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    })
  } catch {
    return new Response('Upstream fetch failed', { status: 502 })
  }
}
