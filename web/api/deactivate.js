import { licenseRoute, update, MOVES_ALLOWED, MOVE_WINDOW } from './_activation.js'

// POST /api/deactivate {key, machine} -> {ok}: "Move to another PC". Only the PC holding the key
// can free it, at most MOVES_ALLOWED times in 30 days (after that, the owner moves it by hand).
//   403 revoked, 409 not_this_pc, 429 move_limit
export default licenseRoute('deactivate', async ({ lic, machine, now }) => {
  let refused = null
  await update(lic.id, r => {
    refused = null
    if (r && r.revoked) { refused = [403, { error: 'revoked' }]; return null }
    if (!r || r.machine !== machine) { refused = [409, { error: 'not_this_pc' }]; return null }
    const recent = r.moves.filter(t => now - t < MOVE_WINDOW)
    if (recent.length >= MOVES_ALLOWED) { refused = [429, { error: 'move_limit' }]; return null }
    return { ...r, machine: null, moves: [...recent, now] }
  })
  return refused || [200, { ok: true }]
})
