import { licenseRoute, claim } from './_activation.js'

// POST /api/check {key, machine} -> {token, t}: the app's check every few days, a fresh token with
// the server's time. A key nobody holds (never activated, or moved) is claimed, like /api/activate.
//   403 revoked, 409 moved (another PC holds it now)
export default licenseRoute('check', ctx => claim(ctx, 'moved'))
