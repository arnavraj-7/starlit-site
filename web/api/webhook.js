import { createHmac, timingSafeEqual } from 'node:crypto'
import { readRaw, send, isJson, HttpError } from './_http.js'

// POST /api/webhook: Razorpay's server calls this. Checked against RAZORPAY_WEBHOOK_SECRET
// (hex HMAC-SHA256 of the raw body, in X-Razorpay-Signature). There's no database, so for now
// it only writes captures and refunds to the log.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
    if (!isJson(req)) throw new HttpError(415, 'Send JSON.')
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) { console.error('[starlit] /api/webhook: missing env: RAZORPAY_WEBHOOK_SECRET'); return send(res, 500, { error: 'Not configured.' }) }
    const { buf, exact } = await readRaw(req, 64 * 1024)
    const sig = String(req.headers['x-razorpay-signature'] || '')
    const want = createHmac('sha256', secret).update(buf).digest()
    const got = /^[0-9a-f]{64}$/i.test(sig) ? Buffer.from(sig, 'hex') : Buffer.alloc(0)
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      console.warn(`[starlit] /api/webhook: bad signature${exact ? '' : ' (raw body unavailable; got a parsed body)'}`)
      throw new HttpError(400, 'Bad signature.')
    }
    let evt
    try { evt = JSON.parse(buf.toString('utf8')) } catch { throw new HttpError(400, 'Bad request.') }
    const pay = evt?.payload?.payment?.entity, refund = evt?.payload?.refund?.entity
    if (evt?.event === 'payment.captured' && pay)
      console.log(`[starlit] webhook payment.captured ${pay.id} order ${pay.order_id} ${pay.amount} ${pay.currency}`)
    else if (evt?.event === 'refund.processed' && refund)
      console.log(`[starlit] webhook refund.processed ${refund.id} for ${refund.payment_id} ${refund.amount} ${refund.currency}`)
    else console.log(`[starlit] webhook ${evt?.event || 'unknown'} ignored`)
    send(res, 200, { ok: true })
  } catch (e) {
    send(res, e instanceof HttpError ? e.status : 500, { error: e instanceof HttpError ? e.message : 'Error.' })
  }
}
