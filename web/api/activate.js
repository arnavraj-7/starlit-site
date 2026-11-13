import { licenseRoute, claim } from './_activation.js'

// POST /api/activate {key, machine} -> {token, t}. The first PC to activate a key holds it.
//   400 invalid_key / bad_machine, 403 revoked, 409 in_use (another PC holds it), 429 rate_limited
export default licenseRoute('activate', ctx => claim(ctx, 'in_use'))
