import { randomBytes } from 'node:crypto'
import { readJson, send, cleanEmail, HttpError } from './_http.js'
import { loadConfig, rzp, failure, UNAVAILABLE } from './_razorpay.js'

// POST /api/order {email} -> a Razorpay order for one Starlit licence.
export default async function handler(req, res) {
  try {
    const body = await readJson(req)
    const email = cleanEmail(body.email)
    if (!email) throw new HttpError(400, 'Enter a valid email address.')
    let cfg
    try { cfg = loadConfig() } catch (e) { console.error(`[starlit] /api/order: ${e.message}`); return send(res, 500, { error: UNAVAILABLE }) }
    const order = await rzp(cfg, 'POST', '/orders', {
      amount: cfg.price,
      currency: cfg.currency,
      payment_capture: 1,
      receipt: `starlit-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`,
      notes: { product: 'starlit', email },
    })
    send(res, 200, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: cfg.keyId, mode: cfg.mode })
  } catch (e) {
    const [status, error] = failure(e)
    send(res, status, { error })
  }
}
