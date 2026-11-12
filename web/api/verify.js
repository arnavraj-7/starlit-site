import { readJson, send, isOrderId, isPaymentId, HttpError } from './_http.js'
import { loadConfig, signatureOk, paidStarlit, failure, Rejected, UNAVAILABLE } from './_razorpay.js'
import { issueKey } from './_license.js'

const NOT_CONFIRMED = 'We couldn’t confirm this payment.'

// POST /api/verify {orderId, paymentId, signature} -> {key, email}, after Checkout reports success.
// The licence identity comes from Razorpay's records only, never from this request.
export default async function handler(req, res) {
  try {
    const { orderId, paymentId, signature } = await readJson(req)
    if (!isOrderId(orderId) || !isPaymentId(paymentId) || typeof signature !== 'string') throw new HttpError(400, 'Bad request.')
    let cfg
    try { cfg = loadConfig() } catch (e) { console.error(`[starlit] /api/verify: ${e.message}`); return send(res, 500, { error: UNAVAILABLE }) }
    if (!signatureOk(orderId, paymentId, signature, cfg.keySecret)) throw new Rejected(`bad checkout signature for ${paymentId}`)
    const who = await paidStarlit(cfg, { paymentId, orderId })
    send(res, 200, { key: issueKey(who, cfg.privateKey), email: who.email })
  } catch (e) {
    const [status, error] = failure(e, NOT_CONFIRMED)
    send(res, status, { error })
  }
}
