import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create as createQR } from 'qrcode'
import { PRICE_LABEL } from './Buy.jsx'

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
const CONTACTS = [
  { name: 'WhatsApp', href: `https://wa.me/${WHATSAPP}?text=${enc(MESSAGE)}`, icon: 'whatsapp' },
  { name: 'Email', href: `mailto:${EMAIL}?subject=${enc(UPI_NOTE)}&body=${enc(MESSAGE)}`, icon: 'mail' },
  { name: 'Instagram', href: `https://ig.me/m/${INSTAGRAM}`, icon: 'instagram' },
]

const GLYPHS = {
  whatsapp: <>
    <path d="M3.6 20.4l1.2-4.1a8.6 8.6 0 1 1 3.1 3z" />
    <path className="fill" d="M8.9 8.2c.2-.5.5-.6.9-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.6.7a6 6 0 0 0 2.6 2.6l.7-.6c.2-.2.4-.2.6-.1l1.6.7c.3.1.4.3.4.5v.5c0 .4-.1.7-.6.9-.7.4-1.6.5-2.5.2a7.8 7.8 0 0 1-4.6-4.6c-.3-.9-.2-1.8.2-2.5z" />
  </>,
  mail: <>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M4 7.5l8 5.5 8-5.5" />
  </>,
  instagram: <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="3.9" />
    <circle className="fill" cx="17.1" cy="6.9" r="1.05" />
  </>,
}
const Glyph = ({ name }) => <svg viewBox="0 0 24 24" aria-hidden="true">{GLYPHS[name]}</svg>

// The UPI link as a QR code: dark modules on white, four modules of quiet zone, drawn as one path,
// five CSS pixels a module so every module lands on whole pixels.
function UpiQR({ text }) {
  const { size, d } = useMemo(() => {
    const { modules } = createQR(text, { errorCorrectionLevel: 'M' })
    const n = modules.size, q = 4
    let d = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) d += `M${x + q} ${y + q}h1v1h-1z`
    return { size: n + 2 * q, d }
  }, [text])
  return (
    <svg className="mb-qr" viewBox={`0 0 ${size} ${size}`} width={size * 5} height={size * 5} role="img" aria-label={`UPI QR code: pay ${PRICE_LABEL} to ${UPI_ID}`} shapeRendering="crispEdges">
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
      <span className="mb-upi-id" ref={box}>{UPI_ID}</span>
      <button type="button" className="buy-chip" onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

// The purchase sheet while sales are manual. Same shell as BuySheet, so it opens and closes the same way.
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
        <div className="buy-head">
          <h2 className="buy-title" id="buy-title">Buy Starlit</h2>
          <button type="button" className="buy-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="buy-line">
          <img src="/icon-512.png" alt="" width="44" height="44" />
          <span>Starlit<small>Lifetime licence for Windows</small></span>
          <b>{PRICE_LABEL}</b>
        </div>

        <ol className="mb-steps">
          <li>
            <h3>Pay {PRICE_LABEL} by UPI</h3>
            <div className="mb-qr-tile"><UpiQR text={UPI_URL} /></div>
            <CopyUpi />
            {phone && <a className="btn buy-cta mb-app" href={UPI_URL}>Pay with a UPI app</a>}
            <p className="mb-muted">The amount fills in by itself.</p>
          </li>
          <li>
            <h3>Send the screenshot and your email</h3>
            <div className="mb-contacts">
              {CONTACTS.map(c => (
                <a key={c.name} className="mb-contact" href={c.href} target={c.icon === 'mail' ? undefined : '_blank'} rel="noopener noreferrer">
                  <Glyph name={c.icon} />{c.name}
                </a>
              ))}
            </div>
          </li>
          <li>
            <h3>Get your key</h3>
            <p className="mb-muted">You’ll get your licence key, usually within a few hours. Paste it into Starlit.</p>
          </li>
        </ol>

        <p className="mb-foot">Lost your key? Message me the email you bought with.</p>
      </div>
    </div>,
    document.body,
  )
}
