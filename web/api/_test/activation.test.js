// node api/_test/activation.test.js  (npm run test:api)
// One PC per key: /api/activate, /api/check, /api/deactivate and /api/admin against a fake Upstash
// (global fetch mocked, Redis kept in a Map) and fake req/res objects.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { generateKeyPairSync, verify } from 'node:crypto'
import { issueKey } from '../_license.js'
import { CAS_SCRIPT, parseLicense } from '../_activation.js'
import activate from '../activate.js'
import check from '../check.js'
import deactivate from '../deactivate.js'
import admin from '../admin.js'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim().replace(/\n/g, '\\n')
const KV_URL = 'https://fake-kv.upstash.io', KV_TOKEN = 'kv_token_123', ADMIN = 'a'.repeat(64)
const ENV = { LICENSE_PRIVATE_KEY: PEM, KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: KV_TOKEN, ADMIN_SECRET: ADMIN }

const ID = 'pay_P9q8r7s6t5u4v3', EMAIL = 'buyer@example.com'
const KEY = issueKey({ id: ID, email: EMAIL }, privateKey)
const PC_A = 'a1'.repeat(32), PC_B = 'b2'.repeat(32)
const DAY = 86400e3

// ---- fake Upstash ----
let db, kvCalls, kvDown
function run([cmd, ...a]) {
  switch (cmd) {
    case 'GET': return db.has(a[0]) ? db.get(a[0]) : null
    case 'SET':
      if (a[2] === 'NX' && db.has(a[0])) return null
      db.set(a[0], a[1]); return 'OK'
    case 'INCR': { const n = Number(db.get(a[0]) || 0) + 1; db.set(a[0], String(n)); return n }
    case 'EXPIRE': return db.has(a[0]) ? 1 : 0
    case 'EVAL':
      assert.equal(a[0], CAS_SCRIPT); assert.equal(a[1], '1')
      if (db.get(a[2]) !== a[3]) return 0
      db.set(a[2], a[4]); return 1
    default: throw new Error(`fake kv: ${cmd}`)
  }
}
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
globalThis.fetch = async (url, init = {}) => {
  assert.ok(url.startsWith(KV_URL), `only Upstash is called: ${url}`)
  assert.equal(init.headers.Authorization, `Bearer ${KV_TOKEN}`)
  const body = JSON.parse(init.body)
  kvCalls.push(body)
  if (kvDown) return reply(500, { error: 'ERR internal upstash detail' })
  if (url === KV_URL + '/pipeline') return reply(200, body.map(c => ({ result: run(c) })))
  assert.equal(url, KV_URL)
  for (const x of body) assert.equal(typeof x, 'string', 'every argument is sent as a string')
  return reply(200, { result: run(body) })
}
const quiet = fn => async () => {
  const saved = console.error
  console.error = () => {}
  try { await fn() } finally { console.error = saved }
}

function req(body, { method = 'POST', headers = {}, ip = '203.0.113.7' } = {}) {
  const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? {}))
  const r = Readable.from([buf])
  r.method = method
  r.headers = { 'content-type': 'application/json', host: 'starlit-lyrics.vercel.app', 'content-length': String(buf.length), 'x-real-ip': ip, ...headers }
  return r
}
async function call(handler, request) {
  const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b } }
  await handler(request, res)
  return { status: res.statusCode, headers: res.headers, data: JSON.parse(res.body) }
}
const act = (machine, key = KEY, ip) => call(activate, req({ key, machine }, { ip }))
const chk = (machine, key = KEY) => call(check, req({ key, machine }))
const deact = (machine, key = KEY) => call(deactivate, req({ key, machine }))
const adm = (body, secret = ADMIN) => call(admin, req(body, { headers: secret == null ? {} : { authorization: `Bearer ${secret}` } }))
const record = () => JSON.parse(db.get(`lic:${ID}`))

// The token format the app checks, independently of the server code.
function checkToken(token, machine) {
  const m = /^STARLIT-ACT-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token)
  assert.ok(m, `token format: ${token}`)
  const bytes = Buffer.from(m[1], 'base64url'), sig = Buffer.from(m[2], 'base64url')
  assert.equal(bytes.toString('base64url'), m[1])
  assert.equal(sig.length, 64)
  assert.ok(verify(null, bytes, publicKey, sig), 'signed with the licence key')
  const p = JSON.parse(bytes.toString('utf8'))
  assert.deepEqual(Object.keys(p), ['v', 'k', 'id', 'm', 't'])
  assert.equal(p.v, 1); assert.equal(p.k, 'act'); assert.equal(p.id, ID); assert.equal(p.m, machine)
  assert.ok(Number.isInteger(p.t) && Math.abs(p.t - Date.now() / 1000) < 60, 'stamped with the server time')
  return p
}

beforeEach(() => {
  db = new Map(); kvCalls = []; kvDown = false
  for (const k of Object.keys(ENV)) delete process.env[k]
  Object.assign(process.env, ENV)
})

// ---- /api/activate ----
test('activate: a fresh key is claimed by the first PC', async () => {
  const r = await act(PC_A)
  assert.equal(r.status, 200)
  assert.equal(r.headers['cache-control'], 'no-store')
  const p = checkToken(r.data.token, PC_A)
  assert.equal(r.data.t, p.t)
  const rec = record()
  assert.deepEqual(Object.keys(rec).sort(), ['activatedAt', 'email', 'machine', 'moves', 'revoked'])
  assert.equal(rec.email, EMAIL); assert.equal(rec.machine, PC_A); assert.deepEqual(rec.moves, []); assert.equal(rec.revoked, false)
  assert.equal(db.get(`email:${EMAIL}`), ID)
})

test('activate: the same PC again keeps its claim', async () => {
  await act(PC_A)
  const at = record().activatedAt
  const r = await act(PC_A)
  assert.equal(r.status, 200); checkToken(r.data.token, PC_A)
  assert.equal(record().activatedAt, at)
})

test('activate: another PC is refused with in_use', async () => {
  await act(PC_A)
  const r = await act(PC_B)
  assert.equal(r.status, 409); assert.deepEqual(r.data, { error: 'in_use' })
  assert.equal(record().machine, PC_A)
})

test('activate: a revoked key gets 403', async () => {
  await act(PC_A)
  db.set(`lic:${ID}`, JSON.stringify({ ...record(), revoked: true }))
  for (const pc of [PC_A, PC_B]) {
    const r = await act(pc)
    assert.equal(r.status, 403); assert.deepEqual(r.data, { error: 'revoked' })
  }
})

test('activate: bad keys and machine ids are 400, before any record is touched', async () => {
  const forged = KEY.slice(0, -3) + (KEY.at(-3) === 'A' ? 'B' : 'A') + KEY.slice(-2)
  const otherSigner = issueKey({ id: ID, email: EMAIL }, generateKeyPairSync('ed25519').privateKey)
  for (const key of [forged, otherSigner, 'STARLIT-abc.def', '', 42, null, KEY + '=', 'STARLIT-' + 'x'.repeat(1100)]) {
    const r = await act(PC_A, key)
    assert.equal(r.status, 400, String(key).slice(0, 40)); assert.equal(r.data.error, 'invalid_key')
  }
  for (const machine of ['A1'.repeat(32), 'a1'.repeat(31), 'a1'.repeat(33), 'g1'.repeat(32), '', 7, null, ['a1'.repeat(32)]]) {
    const r = await call(activate, req({ key: KEY, machine }))
    assert.equal(r.status, 400, String(machine)); assert.equal(r.data.error, 'bad_machine')
  }
  assert.ok(!db.has(`lic:${ID}`))
})

test('activate: request checks from _http.js', async () => {
  assert.equal((await call(activate, req({ key: KEY, machine: PC_A }, { method: 'GET' }))).status, 405)
  assert.equal((await call(activate, req({ key: KEY, machine: PC_A }, { headers: { 'content-type': 'text/plain' } }))).status, 415)
  assert.equal((await call(activate, req({ key: KEY, machine: PC_A, pad: 'x'.repeat(3000) }))).status, 413)
  assert.equal((await call(activate, req('{nope'))).status, 400)
  assert.equal((await call(activate, req({ key: KEY, machine: PC_A }, { headers: { origin: 'https://evil.example' } }))).status, 403)
})

test('a licence key is never a token, and a token never a licence key', async () => {
  const token = (await act(PC_A)).data.token
  assert.equal(parseLicense(token).ok, false)
  const r = await act(PC_B, token)
  assert.equal(r.status, 400); assert.equal(r.data.error, 'invalid_key')
  assert.ok(!KEY.startsWith('STARLIT-ACT-'))
})

test('Redis or env trouble is 503 "unavailable", with no detail', quiet(async () => {
  kvDown = true
  let r = await act(PC_A)
  assert.equal(r.status, 503); assert.deepEqual(r.data, { error: 'unavailable' })
  kvDown = false
  delete process.env.KV_REST_API_TOKEN
  r = await act(PC_A)
  assert.equal(r.status, 503); assert.ok(!JSON.stringify(r.data).includes('KV_'))
  process.env.KV_REST_API_TOKEN = KV_TOKEN
  process.env.LICENSE_PRIVATE_KEY = 'garbage'
  r = await act(PC_A)
  assert.equal(r.status, 503); assert.ok(!JSON.stringify(r.data).includes('LICENSE'))
}))

test('rate limit: 20 a minute per IP, then 429', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await act(PC_A, KEY, '198.51.100.1')).status, 200)
  const r = await act(PC_A, KEY, '198.51.100.1')
  assert.equal(r.status, 429); assert.equal(r.data.error, 'rate_limited')
  assert.equal((await act(PC_A, KEY, '198.51.100.2')).status, 200, 'another IP is fine')
  assert.ok(kvCalls.some(c => Array.isArray(c[0]) && c[0][0] === 'INCR' && c[1][0] === 'EXPIRE'))
})

// ---- /api/check ----
test('check: the PC holding the key gets a fresh token with the server time', async () => {
  await act(PC_A)
  const realNow = Date.now
  try {
    Date.now = () => realNow() + 3 * DAY
    const r = await chk(PC_A)
    assert.equal(r.status, 200)
    const m = /^STARLIT-ACT-([^.]+)\./.exec(r.data.token)
    const p = JSON.parse(Buffer.from(m[1], 'base64url'))
    assert.equal(p.t, Math.floor(Date.now() / 1000)); assert.equal(p.m, PC_A)
  } finally { Date.now = realNow }
})

test('check: another PC holds it -> 409 moved; revoked -> 403; no record -> claimed', async () => {
  let r = await chk(PC_A)
  assert.equal(r.status, 200, 'a key never activated is claimed on its first check')
  assert.equal(record().machine, PC_A)
  r = await chk(PC_B)
  assert.equal(r.status, 409); assert.deepEqual(r.data, { error: 'moved' })
  db.set(`lic:${ID}`, JSON.stringify({ ...record(), revoked: true }))
  r = await chk(PC_A)
  assert.equal(r.status, 403); assert.deepEqual(r.data, { error: 'revoked' })
})

// ---- /api/deactivate ----
test('deactivate: frees the key for another PC, twice in 30 days, then move_limit', async () => {
  await act(PC_A)
  assert.equal((await deact(PC_B)).status, 409, 'only the PC holding it can free it')
  let r = await deact(PC_A)
  assert.equal(r.status, 200); assert.deepEqual(r.data, { ok: true })
  assert.equal(record().machine, null); assert.equal(record().moves.length, 1)
  assert.equal((await act(PC_B)).status, 200, 'the other PC can activate now')
  assert.equal((await act(PC_A)).data.error, 'in_use')
  assert.equal((await deact(PC_B)).status, 200)
  assert.equal((await act(PC_A)).status, 200)
  r = await deact(PC_A)
  assert.equal(r.status, 429); assert.deepEqual(r.data, { error: 'move_limit' })
  assert.equal(record().machine, PC_A, 'still on this PC')
  // a month later the old moves no longer count
  db.set(`lic:${ID}`, JSON.stringify({ ...record(), moves: record().moves.map(t => t - 31 * DAY) }))
  assert.equal((await deact(PC_A)).status, 200)
  assert.equal(record().moves.length, 1, 'old moves are dropped')
})

test('deactivate: revoked -> 403; never activated -> 409', async () => {
  assert.equal((await deact(PC_A)).status, 409)
  await act(PC_A)
  db.set(`lic:${ID}`, JSON.stringify({ ...record(), revoked: true }))
  assert.equal((await deact(PC_A)).status, 403)
})

// ---- /api/admin ----
test('admin: needs the secret', quiet(async () => {
  await act(PC_A)
  for (const s of [null, 'wrong', ADMIN + 'x', '']) assert.equal((await adm({ action: 'info', id: ID }, s)).status, 401, String(s))
  assert.equal((await call(admin, req({ action: 'info', id: ID }, { headers: { authorization: ADMIN } }))).status, 401, 'Bearer is required')
  delete process.env.ADMIN_SECRET
  const r = await adm({ action: 'info', id: ID })
  assert.equal(r.status, 503); assert.ok(!JSON.stringify(r.data).includes('ADMIN'))
}))

test('admin: info by email or id', async () => {
  await act(PC_A)
  for (const who of [{ email: 'BUYER@example.com' }, { id: ID }]) {
    const r = await adm({ action: 'info', ...who })
    assert.equal(r.status, 200); assert.equal(r.data.id, ID); assert.equal(r.data.record.machine, PC_A)
  }
  assert.equal((await adm({ action: 'info', email: 'nobody@example.com' })).status, 404)
  assert.equal((await adm({ action: 'info', id: 'pay_x/../y' })).status, 400)
  assert.equal((await adm({ action: 'nuke', id: ID })).status, 400)
  assert.equal((await adm({ action: 'info' })).status, 400)
})

test('admin: reset frees the PC without counting a move', async () => {
  await act(PC_A)
  const r = await adm({ action: 'reset', email: EMAIL })
  assert.equal(r.status, 200); assert.equal(r.data.record.machine, null); assert.deepEqual(r.data.record.moves, [])
  assert.equal((await act(PC_B)).status, 200)
  assert.equal((await adm({ action: 'reset', id: 'pay_Unknown1' })).status, 404)
})

test('admin: revoke locks every PC at its next check; unrevoke undoes it', async () => {
  await act(PC_A)
  assert.equal((await adm({ action: 'revoke', id: ID })).data.record.revoked, true)
  assert.equal((await chk(PC_A)).status, 403)
  assert.equal((await act(PC_B)).status, 403)
  assert.equal((await adm({ action: 'unrevoke', id: ID })).data.record.revoked, false)
  const r = await chk(PC_A)
  assert.equal(r.status, 200); checkToken(r.data.token, PC_A)
  // a key revoked before it was ever activated
  const r2 = await adm({ action: 'revoke', id: 'pay_NeverUsed123' })
  assert.equal(r2.status, 200); assert.equal(r2.data.record.revoked, true)
})
