// One PC per licence key. The app sends {key, machine}; the server keeps who holds each key in Redis
// and answers with an activation token the app checks offline until its next check:
//   "STARLIT-ACT-" + base64url(json) + "." + base64url(Ed25519 signature over the json bytes)
//   json = {"v":1,"k":"act","id":<licence id>,"m":<machine>,"t":<server unix seconds>}
// signed with the same key as licences; "k":"act" keeps a token from ever passing as a licence key
// (and the other way round). Records:
//   lic:<id>      {email, machine, activatedAt, moves: [ms...], revoked}
//   email:<email> <id>
import { createPublicKey, createHash, timingSafeEqual, sign, verify } from 'node:crypto'
import { loadPrivateKey } from './_license.js'
import { readJson, send, HttpError } from './_http.js'
import { kv, kvPipeline, KvError } from './_kv.js'

export const MOVES_ALLOWED = 2
export const MOVE_WINDOW = 30 * 86400e3
export const RATE_PER_MIN = 20
const TOKEN_PREFIX = 'STARLIT-ACT-'

// ---------- licence keys: the same strict rules as the app's lib/license.js ----------
function b64url(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null
  const bytes = Buffer.from(s, 'base64url')
  return bytes.toString('base64url') === s ? bytes : null
}

export function parseLicense(key) {
  const fail = reason => ({ ok: false, reason })
  if (typeof key !== 'string') return fail('empty')
  if (key.length > 4096) return fail('too-long')
  const s = key.replace(/\s+/g, '')
  if (!s) return fail('empty')
  if (s.length > 1024) return fail('too-long')
  if (!s.startsWith('STARLIT-')) return fail('prefix')
  const parts = s.slice(8).split('.')
  if (parts.length !== 2) return fail('format')
  const json = b64url(parts[0]), sig = b64url(parts[1])
  if (!json || !sig) return fail('base64')
  if (sig.length !== 64) return fail('signature')
  let data
  try { data = JSON.parse(json.toString('utf8')) } catch { return fail('json') }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('json')
  if (data.v !== 1) return fail('version')
  const okId = typeof data.id === 'string' && /^pay_[A-Za-z0-9]{1,64}$/.test(data.id)
  const okEmail = typeof data.e === 'string' && data.e.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(data.e)
  const okTime = Number.isSafeInteger(data.t) && data.t > 1.6e9 && data.t < 4.1e9
  if (!okId || !okEmail || !okTime) return fail('fields')
  return { ok: true, json, sig, data }
}

export function verifyLicense(key, publicKey) {
  const p = parseLicense(key)
  if (!p.ok) return p
  let good = false
  try { good = verify(null, p.json, publicKey, p.sig) } catch { good = false }
  if (!good) return { ok: false, reason: 'signature' }
  return { ok: true, id: p.data.id, email: p.data.e.toLowerCase() }
}

export const isMachine = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
export const isLicenceId = v => typeof v === 'string' && /^pay_[A-Za-z0-9]{1,64}$/.test(v)

export function issueToken({ id, machine, t }, privateKey) {
  const bytes = Buffer.from(JSON.stringify({ v: 1, k: 'act', id, m: machine, t }), 'utf8')
  return TOKEN_PREFIX + bytes.toString('base64url') + '.' + sign(null, bytes, privateKey).toString('base64url')
}

export function loadKeys(env = process.env) {
  const privateKey = loadPrivateKey(env.LICENSE_PRIVATE_KEY)
  return { privateKey, publicKey: createPublicKey(privateKey) }
}

// ---------- records ----------
const recKey = id => `lic:${id}`
function normalize(r) {
  return {
    email: typeof r.email === 'string' ? r.email : '',
    machine: isMachine(r.machine) ? r.machine : null,
    activatedAt: Number.isSafeInteger(r.activatedAt) ? r.activatedAt : null,
    moves: Array.isArray(r.moves) ? r.moves.filter(Number.isSafeInteger) : [],
    revoked: r.revoked === true,
  }
}

// { raw, rec } or null. `raw` is what was stored, for the compare-and-set below.
export async function getRecord(id) {
  const raw = await kv('GET', recKey(id))
  if (raw == null) return null
  let r
  try { r = JSON.parse(raw) } catch { throw new KvError(`lic:${id} is not JSON`) }
  return { raw, rec: normalize(r || {}) }
}

// Writes the record only if it is still what was read (false: someone changed it meanwhile).
export const CAS_SCRIPT = "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]) return 1 else return 0 end"
export async function putRecord(id, before, rec) {
  const next = JSON.stringify(normalize(rec))
  if (!before) return (await kv('SET', recKey(id), next, 'NX')) === 'OK'
  return Number(await kv('EVAL', CAS_SCRIPT, 1, recKey(id), before.raw, next)) === 1
}

// Read, change, write; again if the record changed underneath. `change` returns the new record,
// or null to leave it as it is.
export async function update(id, change) {
  for (let i = 0; i < 5; i++) {
    const cur = await getRecord(id)
    const next = change(cur ? cur.rec : null)
    if (!next) return cur ? cur.rec : null
    if (await putRecord(id, cur, next)) return normalize(next)
  }
  throw new KvError(`lic:${id} kept changing`)
}

export const setEmailIndex = (email, id) => email ? kv('SET', `email:${email}`, id) : null
export const idForEmail = email => kv('GET', `email:${email}`)

// ---------- requests ----------
function clientIp(req) {
  const h = req.headers || {}
  const ip = String(h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || '').trim()
  return ip.replace(/[^0-9A-Fa-f:.]/g, '').slice(0, 64) || 'unknown'
}

export async function rateLimit(req, scope, limit = RATE_PER_MIN, now = Date.now()) {
  const k = `rl:${scope}:${clientIp(req)}:${Math.floor(now / 60000)}`
  const [n] = await kvPipeline([['INCR', k], ['EXPIRE', k, 120]])
  if (Number(n) > limit) throw new HttpError(429, 'rate_limited')
}

export const sameSecret = (given, secret) => {
  const a = createHash('sha256').update(String(given)).digest(), b = createHash('sha256').update(String(secret)).digest()
  return timingSafeEqual(a, b)
}

// Errors the client may see: our own codes and _http.js's request checks. Anything else (env,
// Redis) goes to the log, and the client hears "unavailable".
export function fail(res, route, e) {
  if (e instanceof HttpError) return send(res, e.status, { error: e.message })
  console.error(`[starlit] /api/${route}: ${e && e.message}`)
  send(res, 503, { error: 'unavailable' })
}

// The shared front of /api/activate, /api/check and /api/deactivate: POST JSON, rate limit, a
// genuine licence key and a well-formed machine id. `fn` returns [status, body].
export function licenseRoute(route, fn) {
  return async function handler(req, res) {
    try {
      const body = await readJson(req)
      let keys
      try { keys = loadKeys() } catch (e) { console.error(`[starlit] /api/${route}: ${e.message}`); return send(res, 503, { error: 'unavailable' }) }
      await rateLimit(req, 'act')
      const lic = verifyLicense(body.key, keys.publicKey)
      if (!lic.ok) throw new HttpError(400, 'invalid_key')
      if (!isMachine(body.machine)) throw new HttpError(400, 'bad_machine')
      const [status, out] = await fn({ lic, machine: body.machine, keys, now: Date.now() })
      send(res, status, out)
    } catch (e) { fail(res, route, e) }
  }
}

// Activate, or check in: this machine holds the key (claiming it if nobody does) and gets a fresh
// token stamped with the server's time.
export async function claim({ lic, machine, keys, now }, takenError) {
  let refused = null
  const rec = await update(lic.id, r => {
    refused = null
    if (r && r.revoked) { refused = [403, { error: 'revoked' }]; return null }
    if (r && r.machine && r.machine !== machine) { refused = [409, { error: takenError }]; return null }
    if (r && r.machine === machine && r.email) return null
    return { ...(r || { moves: [] }), email: lic.email, machine, activatedAt: r && r.machine === machine ? r.activatedAt : now, revoked: false }
  })
  if (refused) return refused
  if (!rec) throw new KvError('record vanished')
  await setEmailIndex(lic.email, lic.id)
  const t = Math.floor(now / 1000)
  return [200, { token: issueToken({ id: lic.id, machine, t }, keys.privateKey), t }]
}
