import { readJson, send, cleanEmail, HttpError } from './_http.js'
import { rateLimit, sameSecret, fail, isLicenceId, idForEmail, getRecord, update } from './_activation.js'

// POST /api/admin {action, email | id} with "Authorization: Bearer <ADMIN_SECRET>" (tools/key.js
// in the app repo). info: the record. reset: free the key from its PC (not counted as a move).
// revoke / unrevoke: a revoked key locks on every PC at its next check.
const ACTIONS = new Set(['info', 'reset', 'revoke', 'unrevoke'])

export default async function handler(req, res) {
  try {
    const body = await readJson(req)
    const secret = process.env.ADMIN_SECRET
    if (!secret || secret.length < 16) { console.error('[starlit] /api/admin: ADMIN_SECRET is not set'); return send(res, 503, { error: 'unavailable' }) }
    await rateLimit(req, 'admin', 30)
    const auth = String(req.headers.authorization || '')
    if (!auth.startsWith('Bearer ') || !sameSecret(auth.slice(7).trim(), secret)) throw new HttpError(401, 'unauthorized')
    if (!ACTIONS.has(body.action)) throw new HttpError(400, 'bad_action')
    let id = typeof body.id === 'string' ? body.id.trim() : ''
    const email = cleanEmail(body.email)
    if (id && !isLicenceId(id)) throw new HttpError(400, 'bad_id')
    if (!id && !email) throw new HttpError(400, 'need_email_or_id')
    if (!id) {
      id = await idForEmail(email)
      if (!id) throw new HttpError(404, 'not_found')
    }
    let record
    if (body.action === 'info') record = (await getRecord(id) || {}).rec || null
    else if (body.action === 'revoke') record = await update(id, r => ({ ...(r || { email: email || '', machine: null, activatedAt: null, moves: [] }), revoked: true }))
    else {
      if (!await getRecord(id)) throw new HttpError(404, 'not_found')
      record = await update(id, r => body.action === 'reset' ? { ...r, machine: null } : { ...r, revoked: false })
    }
    send(res, 200, { id, record })
  } catch (e) { fail(res, 'admin', e) }
}
