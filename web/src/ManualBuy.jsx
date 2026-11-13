import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create as createQR } from 'qrcode'
import { PRICE_LABEL, PriceHead } from './Buy.jsx'

// Until Razorpay is live, buying is by hand: pay by UPI, send the screenshot, get a key back.
const UPI_ID = '8171123933@ptsbi'
const PAYEE = 'Arnav Raj'
const AMOUNT = '599.00'
const UPI_NOTE = 'Starlit licence'
const WHATSAPP = '918171123933'
const EMAIL = 'arnavrajcodes@gmail.com'
const INSTAGRAM = 'arnavraj.dev'
const MESSAGE = `Hi, I paid ${PRICE_LABEL} for Starlit. My email: `

const enc = encodeURIComponent
export const UPI_URL = `upi://pay?pa=${UPI_ID}&pn=${enc(PAYEE)}&am=${AMOUNT}&cu=INR&tn=${enc(UPI_NOTE)}`
const CONTACT = {
  whatsapp: `https://wa.me/${WHATSAPP}?text=${enc(MESSAGE)}`,
  email: `mailto:${EMAIL}?subject=${enc(UPI_NOTE)}&body=${enc(MESSAGE)}`,
  instagram: `https://ig.me/m/${INSTAGRAM}`,
}

// The UPI link as a QR code: dark modules on white, four modules of quiet zone, drawn as one path.
// Whole CSS pixels a module (--n modules across), so every module lands on the pixel grid.
function UpiQR({ text }) {
  const { size, d } = useMemo(() => {
    const { modules } = createQR(text, { errorCorrectionLevel: 'M' })
    const n = modules.size, q = 4
    let d = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) d += `M${x + q} ${y + q}h1v1h-1z`
    return { size: n + 2 * q, d }
  }, [text])
  return (
    <svg className="mb-qr" viewBox={`0 0 ${size} ${size}`} style={{ '--n': size }} role="img" aria-label={`UPI QR code: pay ${PRICE_LABEL} to ${UPI_ID}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

function useIsPhone() {
  const query = '(pointer: coarse), (max-width: 560px)'
  const [phone, setPhone] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query), on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

function CopyUpi() {
  const [copied, setCopied] = useState(false)
  const box = useRef(null)
  const copy = async () => {
    try { await navigator.clipboard.writeText(UPI_ID) } catch {
      const r = document.createRange(); r.selectNodeContents(box.current)
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r)
      document.execCommand('copy')
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="mb-upi">
      <span className="mb-upi-label">UPI ID</span>
      <span className="mb-upi-id" ref={box}>{UPI_ID}</span>
      <button type="button" className="buy-chip" onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

// The purchase sheet while sales are manual: the price, the QR code, one sentence on what happens next.
// Same shell as BuySheet, so it opens and closes the same way.
export default function ManualBuySheet({ open, onClose }) {
  const panel = useRef(null)
  const phone = useIsPhone()

  // While open: the page behind is inert and doesn't scroll; Escape closes.
  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root'), html = document.documentElement
    const lastFocus = document.activeElement
    root.inert = true; html.classList.add('buy-open'); window.__lenis?.stop()
    const t = setTimeout(() => panel.current?.focus(), 30)
    const key = e => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', key)
    return () => {
      clearTimeout(t); removeEventListener('keydown', key)
      root.inert = false; html.classList.remove('buy-open'); window.__lenis?.start()
      lastFocus?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="buy-layer" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="buy mb" role="dialog" aria-modal="true" aria-labelledby="buy-title" tabIndex={-1} ref={panel} data-lenis-prevent>
        <h2 className="sr-only" id="buy-title">Buy Starlit</h2>
        <button type="button" className="buy-x mb-x" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>

        <PriceHead />

        {phone && <a className="btn buy-cta mb-app" href={UPI_URL}>Pay with a UPI app</a>}
        <div className="mb-qr-tile">
          <UpiQR text={UPI_URL} />
          <p className="mb-scan">{phone ? 'Or scan it from another phone' : `Scan with any UPI app. ${PRICE_LABEL} fills in by itself.`}</p>
        </div>
        <CopyUpi />

        <p className="mb-then">
          Then send the payment screenshot and your email on <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>,{' '}
          <a href={CONTACT.email}>email</a> or <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">Instagram</a> — your key comes back within a few hours.
        </p>
        <p className="mb-lost">Lost your key? Message me the email you bought with.</p>
      </div>
    </div>,
    document.body,
  )
}
