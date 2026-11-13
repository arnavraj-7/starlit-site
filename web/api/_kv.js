// Upstash Redis over its REST API (no SDK): POST a command as a JSON array, or a list of them to
// /pipeline. Needs KV_REST_API_URL and KV_REST_API_TOKEN. Failures throw KvError, whose message is
// for the server log only.

export class KvError extends Error {}

function config(env = process.env) {
  const url = String(env.KV_REST_API_URL || '').trim().replace(/\/+$/, '')
  const token = String(env.KV_REST_API_TOKEN || '').trim()
  if (!url || !token) throw new KvError('KV_REST_API_URL / KV_REST_API_TOKEN not set')
  return { url, token }
}

async function post(path, body) {
  const { url, token } = config()
  let res
  try {
    res = await fetch(url + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) { throw new KvError(`network: ${e.message}`) }
  const text = await res.text().catch(() => '')
  let data = null
  try { data = JSON.parse(text) } catch {}
  if (!res.ok || data == null) throw new KvError(`HTTP ${res.status} ${text.slice(0, 200)}`)
  return data
}

// kv('GET', 'k') -> the result
export async function kv(...cmd) {
  const d = await post('', cmd.map(String))
  if (d.error) throw new KvError(String(d.error))
  return d.result
}

// kvPipeline([['INCR', 'k'], ['EXPIRE', 'k', 60]]) -> [result, result]
export async function kvPipeline(cmds) {
  const d = await post('/pipeline', cmds.map(c => c.map(String)))
  if (!Array.isArray(d) || d.length !== cmds.length) throw new KvError('pipeline: unexpected reply')
  return d.map(x => { if (x && x.error) throw new KvError(String(x.error)); return x ? x.result : null })
}
