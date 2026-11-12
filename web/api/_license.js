import { createPrivateKey, sign } from 'node:crypto'

// The licence key the app checks:
//   "STARLIT-" + base64url(json) + "." + base64url(Ed25519 signature over the json's UTF-8 bytes)
// json is {"v":1,"id":<payment id>,"e":<email, lowercased>,"t":<unix seconds>}, keys in that order.

// LICENSE_PRIVATE_KEY is a PKCS#8 PEM; env editors often store its newlines as literal "\n".
export function loadPrivateKey(pem) {
  if (!pem) throw new Error('LICENSE_PRIVATE_KEY is not set')
  let text = pem.trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) text = text.slice(1, -1)
  text = text.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '')
  let key
  try { key = createPrivateKey({ key: text, format: 'pem' }) } catch { throw new Error('LICENSE_PRIVATE_KEY is not a valid PEM private key') }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(`LICENSE_PRIVATE_KEY must be an Ed25519 key (got ${key.asymmetricKeyType})`)
  return key
}

export function issueKey({ id, email, t = Math.floor(Date.now() / 1000) }, privateKey) {
  const json = JSON.stringify({ v: 1, id, e: email.toLowerCase(), t })
  const bytes = Buffer.from(json, 'utf8')
  const sig = sign(null, bytes, privateKey)
  return 'STARLIT-' + bytes.toString('base64url') + '.' + sig.toString('base64url')
}
