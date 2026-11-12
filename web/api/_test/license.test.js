// node api/_test/license.test.js  (npm run test:api)
// The API routes against a fake Razorpay (global fetch mocked) and fake req/res objects.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createHmac, generateKeyPairSync, verify } from 'node:crypto'
import order from '../order.js'
import verifyRoute from '../verify.js'
import recover from '../recover.js'
import webhook from '../webhook.js'

// a throwaway signing pair; the private half goes in with literal "\n"s, as an env editor stores it
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim().replace(/\n/g, '\\n')
const KEY_ID = 'rzp_test_abc123', SECRET = 'shh_secret'
const ENV = { RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: SECRET, LICENSE_PRIVATE_KEY: PEM }
const ENV_KEYS = [...Object.keys(ENV), 'STARLIT_PRICE', 'STARLIT_CURRENCY', 'VERCEL_ENV', 'ALLOW_TEST_PAYMENTS', 'RAZORPAY_WEBHOOK_SECRET']

// ---- fakes ----
let calls, routes
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
globalThis.fetch = async (url, init = {}) => {
  const path = url.replace('https://api.razorpay.com/v1', '')
  const call = { method: init.method || 'GET', path, headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined }
  calls.push(call)
  const r = routes[`${call.method} ${path}`]
  if (!r) return json(400, { error: { code: 'BAD_REQUEST_ERROR', description: 'The id provided does not exist' } })
  return typeof r === 'function' ? r(call) : r
}
const quiet = fn => async () => {
  const saved = [console.error, console.warn, console.log]
  console.error = console.warn = console.log = () => {}
  try { await fn() } finally { [console.error, console.warn, console.log] = saved }
}

function req(body, { method = 'POST', headers = {}, raw } = {}) {
  const buf = raw ?? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? {}))
  const r = Readable.from([buf])
  r.method = method
  r.headers = { 'content-type': 'application/json', host: 'starlit-lyrics.vercel.app', 'content-length': String(buf.length), ...headers }
  return r
}
async function call(handler, request) {
  const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v }, end(b) { this.body = b } }
  await handler(request, res)
  return { status: res.statusCode, headers: res.headers, data: JSON.parse(res.body) }
}

const ORDER = 'order_N1x2y3z4a5b6c7', PAY = 'pay_P9q8r7s6t5u4v3'
const sigFor = (o, p, s = SECRET) => createHmac('sha256', s).update(`${o}|${p}`).digest('hex')
const orderEntity = (over = {}) => ({ id: ORDER, entity: 'order', amount: 59900, currency: 'INR', status: 'paid', notes: { product: 'starlit', email: 'buyer@example.com' }, ...over })
const paymentEntity = (over = {}) => ({ id: PAY, entity: 'payment', amount: 59900, currency: 'INR', status: 'captured', order_id: ORDER, email: 'other@example.com', amount_refunded: 0, refund_status: null, notes: [], ...over })
function razorpayHas({ payment = paymentEntity(), ord = orderEntity() } = {}) {
  routes[`GET /payments/${PAY}`] = json(200, payment)
  routes[`GET /orders/${ORDER}`] = json(200, ord)
}

// The format the app checks, independently of the server code.
function checkKey(key) {
  const m = /^STARLIT-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key)
  assert.ok(m, `key format: ${key}`)
  const bytes = Buffer.from(m[1], 'base64url'), sig = Buffer.from(m[2], 'base64url')
  assert.equal(bytes.toString('base64url'), m[1], 'payload is unpadded base64url')
  assert.equal(sig.length, 64, 'Ed25519 signature is 64 bytes')
  assert.ok(verify(null, bytes, publicKey, sig), 'signature verifies with the public key')
  const text = bytes.toString('utf8'), p = JSON.parse(text)
  assert.deepEqual(Object.keys(p), ['v', 'id', 'e', 't'])
  assert.equal(text, JSON.stringify({ v: 1, id: p.id, e: p.e, t: p.t }))
  assert.ok(Number.isInteger(p.t) && Math.abs(p.t - Date.now() / 1000) < 60)
  return p
}

beforeEach(() => {
  calls = []; routes = {}
  for (const k of ENV_KEYS) delete process.env[k]
  Object.assign(process.env, ENV)
})

// ---- /api/order ----
test('order: creates a Starlit order with the default price', async () => {
  routes['POST /orders'] = c => json(200, { id: ORDER, amount: c.body.amount, currency: c.body.currency, notes: c.body.notes })
  const r = await call(order, req({ email: '  Buyer@Example.COM ' }, { headers: { origin: 'https://starlit-lyrics.vercel.app' } }))
  assert.equal(r.status, 200)
  assert.deepEqual(r.data, { orderId: ORDER, amount: 59900, currency: 'INR', keyId: KEY_ID, mode: 'test' })
  assert.equal(r.headers['cache-control'], 'no-store')
  assert.equal(calls.length, 1)
  const { body, headers } = calls[0]
  assert.equal(headers.Authorization, 'Basic ' + Buffer.from(`${KEY_ID}:${SECRET}`).toString('base64'))
  assert.equal(body.amount, 59900); assert.equal(body.currency, 'INR'); assert.equal(body.payment_capture, 1)
  assert.deepEqual(body.notes, { product: 'starlit', email: 'buyer@example.com' })
  assert.ok(typeof body.receipt === 'string' && body.receipt.length <= 40)
})

test('order: price and currency come from env', async () => {
  process.env.STARLIT_PRICE = '49900'; process.env.STARLIT_CURRENCY = 'usd'; process.env.RAZORPAY_KEY_ID = 'rzp_live_xyz'
  routes['POST /orders'] = c => json(200, { id: ORDER, amount: c.body.amount, currency: c.body.currency })
  const r = await call(order, req({ email: 'a@b.co' }))
  assert.equal(r.status, 200)
  assert.equal(calls[0].body.amount, 49900); assert.equal(calls[0].body.currency, 'USD')
  assert.equal(r.data.mode, 'live')
})

test('order: rejects bad input before calling Razorpay', async () => {
  assert.equal((await call(order, req({ email: 'not-an-email' }))).status, 400)
  assert.equal((await call(order, req({}))).status, 400)
  assert.equal((await call(order, req('{nope'))).status, 400)
  assert.equal((await call(order, req('[1]'))).status, 400)
  assert.equal((await call(order, req({ email: 'a@b.co' }, { method: 'GET' }))).status, 405)
  assert.equal((await call(order, req({ email: 'a@b.co' }, { headers: { 'content-type': 'text/plain' } }))).status, 415)
  assert.equal((await call(order, req({ email: 'a@b.co', pad: 'x'.repeat(3000) }))).status, 413)
  assert.equal((await call(order, req({ email: 'a@b.co' }, { headers: { origin: 'https://evil.example' } }))).status, 403)
  assert.equal(calls.length, 0)
})

test('order: allows local dev origins', async () => {
  routes['POST /orders'] = json(200, { id: ORDER, amount: 59900, currency: 'INR' })
  assert.equal((await call(order, req({ email: 'a@b.co' }, { headers: { origin: 'http://localhost:5173' } }))).status, 200)
})

test('order: 500 when env is missing, 502 when Razorpay fails', quiet(async () => {
  delete process.env.RAZORPAY_KEY_SECRET
  let r = await call(order, req({ email: 'a@b.co' }))
  assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.data).includes('RAZORPAY'))
  process.env.RAZORPAY_KEY_SECRET = SECRET
  process.env.LICENSE_PRIVATE_KEY = 'garbage'
  assert.equal((await call(order, req({ email: 'a@b.co' }))).status, 500)
  process.env.LICENSE_PRIVATE_KEY = PEM
  routes['POST /orders'] = json(500, { error: { description: 'internal secret detail' } })
  r = await call(order, req({ email: 'a@b.co' }))
  assert.equal(r.status, 502); assert.ok(!JSON.stringify(r.data).includes('secret detail'))
}))

test('test keys are refused on production unless allowed', quiet(async () => {
  process.env.VERCEL_ENV = 'production'
  routes['POST /orders'] = json(200, { id: ORDER, amount: 59900, currency: 'INR' })
  razorpayHas()
  assert.equal((await call(order, req({ email: 'a@b.co' }))).status, 500)
  assert.equal((await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))).status, 500)
  assert.equal(calls.length, 0)
  process.env.ALLOW_TEST_PAYMENTS = '1'
  assert.equal((await call(order, req({ email: 'a@b.co' }))).status, 200)
}))

// ---- /api/verify ----
test('verify: a good signature on a captured payment issues the key', async () => {
  razorpayHas()
  const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY), email: 'attacker@evil.example' }))
  assert.equal(r.status, 200)
  assert.equal(r.data.email, 'buyer@example.com', 'email comes from the order, never the request')
  const p = checkKey(r.data.key)
  assert.equal(p.v, 1); assert.equal(p.id, PAY); assert.equal(p.e, 'buyer@example.com')
})

test('verify: falls back to the payment email, lowercased', async () => {
  razorpayHas({ ord: orderEntity({ notes: { product: 'starlit' } }), payment: paymentEntity({ email: 'Pay@Example.com' }) })
  const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))
  assert.equal(r.status, 200); assert.equal(checkKey(r.data.key).e, 'pay@example.com')
})

test('verify: wrong, tampered and malformed signatures are rejected without a lookup', quiet(async () => {
  razorpayHas()
  const good = sigFor(ORDER, PAY)
  const tampered = (good[0] === 'a' ? 'b' : 'a') + good.slice(1)
  for (const signature of [sigFor(ORDER, PAY, 'other'), tampered, sigFor(ORDER, 'pay_Other123'), good.slice(2), good + '00', 'zz' + good.slice(2), '', 42]) {
    const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature }))
    assert.equal(r.status, 400, `signature ${signature}`)
    assert.ok(!r.data.key)
  }
  assert.equal(calls.length, 0)
}))

test('verify: malformed ids are rejected before any API call', quiet(async () => {
  for (const [orderId, paymentId] of [['order_x/../../payments', PAY], [ORDER, 'pay_a?b'], ['ord_abc', PAY], [ORDER, 'pay_' + 'a'.repeat(37)], [ORDER, 'payment_abc']]) {
    assert.equal((await call(verifyRoute, req({ orderId, paymentId, signature: sigFor(orderId, paymentId) }))).status, 400)
  }
  assert.equal(calls.length, 0)
}))

test('verify: payment that is not captured is rejected', quiet(async () => {
  for (const status of ['failed', 'created', 'refunded']) {
    razorpayHas({ payment: paymentEntity({ status }) })
    const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))
    assert.equal(r.status, 400, status); assert.ok(!r.data.key)
  }
}))

test('verify: an authorised payment is captured, then re-checked', async () => {
  let captured = false
  routes[`GET /payments/${PAY}`] = () => json(200, paymentEntity({ status: captured ? 'captured' : 'authorized' }))
  routes[`GET /orders/${ORDER}`] = json(200, orderEntity())
  routes[`POST /payments/${PAY}/capture`] = c => { captured = true; return json(200, paymentEntity({ amount: c.body.amount })) }
  const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))
  assert.equal(r.status, 200)
  const cap = calls.find(c => c.method === 'POST')
  assert.deepEqual(cap.body, { amount: 59900, currency: 'INR' })
  assert.equal(calls.filter(c => c.path === `/payments/${PAY}`).length, 2)
})

test('verify: payment for a different order is rejected', quiet(async () => {
  razorpayHas({ payment: paymentEntity({ order_id: 'order_SomethingElse1' }) })
  const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))
  assert.equal(r.status, 400)
}))

test('verify: wrong amount, currency, product or a refund is rejected', quiet(async () => {
  const cases = [
    { payment: paymentEntity({ amount: 100 }) },
    { payment: paymentEntity({ currency: 'USD' }) },
    { ord: orderEntity({ amount: 100 }) },
    { ord: orderEntity({ notes: { product: 'other', email: 'buyer@example.com' } }) },
    { ord: orderEntity({ notes: [] }) },
    { payment: paymentEntity({ amount_refunded: 59900 }) },
    { payment: paymentEntity({ refund_status: 'partial' }) },
  ]
  for (const c of cases) {
    calls = []; razorpayHas(c)
    const r = await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))
    assert.equal(r.status, 400, JSON.stringify(c)); assert.ok(!r.data.key)
    assert.ok(!calls.some(x => x.method === 'POST'), 'nothing captured')
  }
}))

test('verify: Razorpay down -> 502', quiet(async () => {
  routes[`GET /payments/${PAY}`] = json(503, { error: {} })
  assert.equal((await call(verifyRoute, req({ orderId: ORDER, paymentId: PAY, signature: sigFor(ORDER, PAY) }))).status, 502)
}))

// ---- /api/recover ----
test('recover: payment id + the buyer email gives the same identity again', async () => {
  razorpayHas()
  const r = await call(recover, req({ paymentId: ` ${PAY} `, email: 'BUYER@example.com' }))
  assert.equal(r.status, 200)
  const p = checkKey(r.data.key)
  assert.equal(p.id, PAY); assert.equal(p.e, 'buyer@example.com')
})

test('recover: every miss gets the same answer', quiet(async () => {
  const answers = new Set()
  const tries = [
    [{}, { paymentId: PAY, email: 'someone@else.com' }],                                                  // wrong email
    [{ ord: orderEntity({ notes: { product: 'not-starlit', email: 'buyer@example.com' } }) }, { paymentId: PAY, email: 'buyer@example.com' }],  // not a Starlit payment
    [{ payment: paymentEntity({ status: 'authorized' }) }, { paymentId: PAY, email: 'someone@else.com' }],   // not captured + wrong email
    [{ payment: paymentEntity({ status: 'failed' }) }, { paymentId: PAY, email: 'buyer@example.com' }],     // not captured
    [{ payment: paymentEntity({ order_id: null }) }, { paymentId: PAY, email: 'buyer@example.com' }],       // no order
    [null, { paymentId: 'pay_DoesNotExist1', email: 'buyer@example.com' }],                                 // unknown payment
  ]
  for (const [has, body] of tries) {
    routes = {}; calls = []
    if (has) razorpayHas(has)
    const r = await call(recover, req(body))
    assert.equal(r.status, 400, JSON.stringify(body)); assert.ok(!r.data.key)
    assert.ok(!calls.some(x => x.method === 'POST'), 'nothing captured on a mismatch')
    answers.add(r.data.error)
  }
  assert.equal(answers.size, 1)
}))

test('recover: needs both fields', async () => {
  assert.equal((await call(recover, req({ paymentId: PAY }))).status, 400)
  assert.equal((await call(recover, req({ email: 'buyer@example.com' }))).status, 400)
  assert.equal((await call(recover, req({ paymentId: 'order_abc', email: 'buyer@example.com' }))).status, 400)
  assert.equal(calls.length, 0)
})

// ---- /api/webhook ----
test('webhook: checks the signature over the raw body', quiet(async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec'
  const raw = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: paymentEntity() } } }))
  const sig = createHmac('sha256', 'whsec').update(raw).digest('hex')
  assert.equal((await call(webhook, req(null, { raw, headers: { 'x-razorpay-signature': sig } }))).status, 200)
  assert.equal((await call(webhook, req(null, { raw, headers: { 'x-razorpay-signature': sig.replace(/^./, c => c === 'a' ? 'b' : 'a') } }))).status, 400)
  assert.equal((await call(webhook, req(null, { raw }))).status, 400)
  delete process.env.RAZORPAY_WEBHOOK_SECRET
  assert.equal((await call(webhook, req(null, { raw, headers: { 'x-razorpay-signature': sig } }))).status, 500)
}))
