import { createHmac, timingSafeEqual } from 'node:crypto'
import { loadPrivateKey } from './_license.js'
import { HttpError } from './_http.js'

const API = 'https://api.razorpay.com/v1'

// Everything the routes need from the environment, read per request. Throws a message meant for
// the server log only; the client just hears that buying is unavailable.
export function loadConfig(env = process.env) {
  const missing = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'LICENSE_PRIVATE_KEY'].filter(k => !env[k])
  if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`)
  const price = env.STARLIT_PRICE ? Number(env.STARLIT_PRICE) : 59900
  if (!Number.isInteger(price) || price < 100) throw new Error('STARLIT_PRICE must be a whole number of paise, at least 100')
  const currency = (env.STARLIT_CURRENCY || 'INR').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('STARLIT_CURRENCY must be a 3-letter code')
  const keyId = env.RAZORPAY_KEY_ID.trim()
  const mode = keyId.startsWith('rzp_test_') ? 'test' : 'live'
  if (mode === 'test' && env.VERCEL_ENV === 'production' && env.ALLOW_TEST_PAYMENTS !== '1')
    throw new Error('RAZORPAY_KEY_ID is a test key on the production deployment; set live keys, or ALLOW_TEST_PAYMENTS=1 to sell with test payments')
  const privateKey = loadPrivateKey(env.LICENSE_PRIVATE_KEY)
  return { keyId, keySecret: env.RAZORPAY_KEY_SECRET.trim(), price, currency, mode, privateKey }
}

export class RazorpayError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// One call to Razorpay's REST API. Error bodies stay in the server log.
export async function rzp(cfg, method, path, body) {
  let res
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64'),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    })
  } catch (e) {
    console.error(`[starlit] razorpay ${method} ${path}: ${e.message}`)
    throw new RazorpayError(0, 'network')
  }
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    console.error(`[starlit] razorpay ${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`)
    throw new RazorpayError(res.status, 'http')
  }
  try { return JSON.parse(text) } catch {
    console.error(`[starlit] razorpay ${method} ${path}: response is not JSON`)
    throw new RazorpayError(0, 'parse')
  }
}

// Checkout's signature: hex HMAC-SHA256 of "<order id>|<payment id>" with the key secret.
export function signatureOk(orderId, paymentId, signature, secret) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false
  const want = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest()
  const got = Buffer.from(signature, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

// A reason for refusing a payment, for the log; the client gets one generic message.
export class Rejected extends Error {}

// Looks a payment up on Razorpay and decides whether it bought Starlit: the right order, a
// Starlit order at today's price, paid in full, not refunded. Captures it if it was only
// authorised. Returns the licence identity, which comes only from Razorpay's records.
// anyPrice (a lost key): bought at whatever the price was then, still paid in full.
export async function paidStarlit(cfg, { paymentId, orderId, email, anyPrice = false }) {
  const get = async path => {
    try { return await rzp(cfg, 'GET', path) } catch (e) {
      // a 4xx here means no such payment/order for this account: the caller's input was wrong
      if (e.status >= 400 && e.status < 500) throw new Rejected(`lookup ${path} returned ${e.status}`)
      throw e
    }
  }
  let p = await get(`/payments/${paymentId}`)
  if (!p || p.id !== paymentId) throw new Rejected('payment id mismatch')
  if (!p.order_id || (orderId && p.order_id !== orderId)) throw new Rejected(`payment ${paymentId} belongs to order ${p.order_id}`)
  const order = await get(`/orders/${p.order_id}`)
  if (!order || order.notes?.product !== 'starlit') throw new Rejected(`order ${p.order_id} is not a Starlit order`)
  const want = anyPrice ? { amount: order.amount, currency: order.currency } : { amount: cfg.price, currency: cfg.currency }
  if (!Number.isInteger(want.amount) || want.amount < 100) throw new Rejected(`order ${order.id} has no real price`)
  if (order.amount !== want.amount || order.currency !== want.currency) throw new Rejected(`order ${order.id} is ${order.amount} ${order.currency}`)
  if (p.amount !== want.amount || p.currency !== want.currency) throw new Rejected(`payment ${paymentId} is ${p.amount} ${p.currency}`)
  if (p.amount_refunded > 0 || p.refund_status) throw new Rejected(`payment ${paymentId} was refunded`)
  const buyer = String(order.notes?.email || p.email || '').trim().toLowerCase()
  if (!buyer) throw new Rejected(`no email on order ${order.id}`)
  if (email && email !== buyer) throw new Rejected(`email does not match payment ${paymentId}`)
  if (p.status === 'authorized') {
    try { await rzp(cfg, 'POST', `/payments/${paymentId}/capture`, { amount: p.amount, currency: p.currency }) } catch (e) {
      if (!(e.status >= 400 && e.status < 500)) throw e      // a 4xx may just mean it was captured meanwhile
    }
    p = await get(`/payments/${paymentId}`)
    if (p.amount_refunded > 0 || p.refund_status) throw new Rejected(`payment ${paymentId} was refunded`)
  }
  if (p.status !== 'captured') throw new Rejected(`payment ${paymentId} is ${p.status}`)
  return { id: p.id, email: buyer }
}

// The route's response for an error thrown while handling it.
export function failure(e, generic) {
  if (e instanceof HttpError) return [e.status, e.message]
  if (e instanceof Rejected) { console.warn(`[starlit] refused: ${e.message}`); return [400, generic] }
  if (e instanceof RazorpayError) return [502, 'The payment service didn’t answer. Try again in a minute.']
  console.error('[starlit] unexpected error', e)
  return [500, 'Something went wrong on our side. Try again in a minute.']
}

export const UNAVAILABLE = 'Buying isn’t available right now. Try again later.'
