// Request and response plumbing shared by the API routes. Files starting with "_" aren't routed.

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

// The raw request body, at most `limit` bytes. Reads the stream itself (so a webhook can check its
// signature against the exact bytes); falls back to a body the platform has already read.
export async function readRaw(req, limit) {
  const declared = Number(req.headers['content-length'])
  if (declared > limit) throw new HttpError(413, 'Request too large.')
  const chunks = []
  let size = 0
  if (typeof req[Symbol.asyncIterator] === 'function' && !req.readableEnded) {
    for await (const c of req) {
      const b = Buffer.isBuffer(c) ? c : Buffer.from(c)
      size += b.length
      if (size > limit) throw new HttpError(413, 'Request too large.')
      chunks.push(b)
    }
  }
  if (size) return { buf: Buffer.concat(chunks), exact: true }
  let b
  try { b = req.body } catch { throw new HttpError(400, 'Bad request.') }
  if (b == null) return { buf: Buffer.alloc(0), exact: true }
  if (Buffer.isBuffer(b)) return { buf: b, exact: true }
  if (typeof b === 'string') return { buf: Buffer.from(b, 'utf8'), exact: true }
  const buf = Buffer.from(JSON.stringify(b), 'utf8')
  if (buf.length > limit) throw new HttpError(413, 'Request too large.')
  return { buf, exact: false }
}

const isJson = req => /^application\/json\s*(;|$)/i.test(req.headers['content-type'] || '')

// Browsers send Origin on a cross-site POST; it has to be this site (whatever host served the
// request, so preview deployments work) or a local dev server. No Origin = not a browser.
function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  let u
  try { u = new URL(origin) } catch { return false }
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase()
  return !!host && u.host.toLowerCase() === host && (u.protocol === 'https:' || u.protocol === 'http:')
}

// POST, same origin, application/json, at most 2 KB, a JSON object.
export async function readJson(req, limit = 2048) {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
  if (!sameOrigin(req)) throw new HttpError(403, 'Forbidden.')
  if (!isJson(req)) throw new HttpError(415, 'Send JSON.')
  const { buf } = await readRaw(req, limit)
  let data
  try { data = JSON.parse(buf.toString('utf8')) } catch { throw new HttpError(400, 'Bad request.') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Bad request.')
  return data
}

export { isJson }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const cleanEmail = v => {
  if (typeof v !== 'string') return null
  const e = v.trim().toLowerCase()
  return e.length <= 254 && EMAIL.test(e) ? e : null
}
export const isOrderId = v => typeof v === 'string' && /^order_[A-Za-z0-9]{1,34}$/.test(v)
export const isPaymentId = v => typeof v === 'string' && /^pay_[A-Za-z0-9]{1,36}$/.test(v)
