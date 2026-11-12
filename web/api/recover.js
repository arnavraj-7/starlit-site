import { readJson, send, isPaymentId, cleanEmail, HttpError } from './_http.js'
import { loadConfig, paidStarlit, failure, UNAVAILABLE } from './_razorpay.js'
import { issueKey } from './_license.js'

const NO_MATCH = 'No paid Starlit order matches that payment ID and email.'

// POST /api/recover {paymentId, email} -> {key, email}: the same licence again for a lost key.
// Both have to match Razorpay's records; every miss gets the same answer.
export default async function handler(req, res) {
  try {
    const body = await readJson(req)
    const email = cleanEmail(body.email)
    const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : ''
    if (!isPaymentId(paymentId) || !email)
      throw new HttpError(400, 'Enter the payment ID (it starts with pay_) and the email you bought with.')
    let cfg
    try { cfg = loadConfig() } catch (e) { console.error(`[starlit] /api/recover: ${e.message}`); return send(res, 500, { error: UNAVAILABLE }) }
    const who = await paidStarlit(cfg, { paymentId, email, anyPrice: true })   // bought before a price change counts too
    send(res, 200, { key: issueKey(who, cfg.privateKey), email: who.email })
  } catch (e) {
    const [status, error] = failure(e, NO_MATCH)
    send(res, status, { error })
  }
}
