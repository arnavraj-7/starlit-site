import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mark } from './Chrome.jsx'
import './buy.css'

// What the button says. Keep in step with STARLIT_PRICE on the server (59900 paise by default);
// the server's price is the one that's charged.
export const PRICE_LABEL = '₹599'
const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js'
const THEME = '#ffaa6a'

let checkoutLoading = null
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  checkoutLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = CHECKOUT_JS; s.async = true
    s.onload = () => window.Razorpay ? resolve() : reject(new Error('no Razorpay'))
    s.onerror = () => { checkoutLoading = null; s.remove(); reject(new Error('blocked')) }
    document.head.appendChild(s)
  })
  return checkoutLoading
}

async function post(path, body) {
  let res
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch { throw new Error('Couldn’t reach the server. Check your connection and try again.') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again in a minute.')
  return data
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The top of both purchase sheets: the price is the headline.
export function PriceHead() {
  return (
    <div className="ph">
      <p className="ph-kicker"><Mark />Starlit for Windows</p>
      <p className="ph-price"><span className="ph-cur">{PRICE_LABEL.slice(0, 1)}</span>{PRICE_LABEL.slice(1)}</p>
      <p className="ph-terms">once · yours forever · one PC</p>
    </div>
  )
}

function Spinner() { return <i className="buy-spin" aria-hidden="true" /> }

function KeyResult({ result, downloadUrl, glyph }) {
  const [copied, setCopied] = useState(false)
  const box = useRef(null)
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.key) } catch {
      const r = document.createRange(); r.selectNodeContents(box.current)
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r)
      document.execCommand('copy')
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  const save = () => {
    const blob = new Blob([`Starlit licence key for ${result.email}\r\n\r\n${result.key}\r\n`], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'starlit-licence.txt'; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <>
      <p className="buy-text">Open Starlit and paste this key.</p>
      <div className="buy-key" ref={box} tabIndex={0} aria-label="Licence key">{result.key}</div>
      <div className="buy-key-actions">
        <button type="button" className="buy-chip" onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className="buy-chip" onClick={save}>Save as file</button>
        <span className="buy-for">{result.email}</span>
      </div>
      <a className="btn buy-cta" href={downloadUrl}>{glyph}Download for Windows</a>
    </>
  )
}

// The purchase sheet: email -> Razorpay Checkout -> the key. "Lost your key?" gets it again.
export default function BuySheet({ open, onClose: close, downloadUrl, glyph }) {
  const [view, setView] = useState('buy')
  const [email, setEmail] = useState('')
  const [payId, setPayId] = useState('')
  const [stage, setStage] = useState('idle')        // idle | ordering | paying | verifying
  const [note, setNote] = useState(null)            // { kind: 'error' | 'info', text }
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState(null)
  const panel = useRef(null)
  const busy = stage !== 'idle'

  // closing clears messages and leaves the recovery form; a key stays on show if you come back
  const onClose = () => { setNote(null); setView(v => v === 'recover' ? 'buy' : v); close() }

  // While open: the page behind is inert and doesn't scroll; Escape closes.
  useEffect(() => {
    if (!open) return
    const root = document.getElementById('root'), html = document.documentElement
    const lastFocus = document.activeElement
    root.inert = true; html.classList.add('buy-open'); window.__lenis?.stop()
    const t = setTimeout(() => panel.current?.querySelector('input, .buy-key, .btn')?.focus(), 30)
    return () => {
      clearTimeout(t); root.inert = false; html.classList.remove('buy-open'); window.__lenis?.start()
      lastFocus?.focus?.({ preventScroll: true })
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const key = e => { if (e.key === 'Escape' && stage !== 'verifying' && stage !== 'paying') onClose() }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  const closeable = stage !== 'verifying' && stage !== 'paying'

  async function pay(e) {
    e.preventDefault()
    const em = email.trim()
    if (!EMAIL.test(em)) { setNote({ kind: 'error', text: 'Enter a valid email address.' }); return }
    setNote(null); setStage('ordering')
    let order
    try {
      [order] = await Promise.all([post('/api/order', { email: em }), loadCheckout().catch(() => { throw new Error('The payment window didn’t load. Check your connection, or allow checkout.razorpay.com if you block scripts.') })])
    } catch (err) { setStage('idle'); setNote({ kind: 'error', text: err.message }); return }
    setMode(order.mode)
    let failed = null
    const rzp = new window.Razorpay({
      key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: 'Starlit', description: 'Lifetime licence', prefill: { email: em }, theme: { color: THEME },
      handler: r => confirm(r, em),
      modal: {
        ondismiss: () => {
          setStage(s => s === 'paying' ? 'idle' : s)
          setNote(failed
            ? { kind: 'error', text: `The payment didn’t go through: ${failed.replace(/\.$/, '')}. You can try again.` }
            : { kind: 'info', text: 'Checkout closed before paying.' })
        },
      },
    })
    rzp.on('payment.failed', r => { failed = r?.error?.description || 'declined' })
    setStage('paying')
    rzp.open()
  }

  async function confirm(r, em) {
    setStage('verifying'); setNote(null)
    try {
      const data = await post('/api/verify', { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature })
      setResult(data); setView('done')
    } catch (err) {
      setPayId(r.razorpay_payment_id || ''); setEmail(em)
      setNote({ kind: 'error', text: `${err.message} If you were charged, your payment ID is ${r.razorpay_payment_id}. Use it below to get your key.` })
      setView('recover')
    }
    setStage('idle')
  }

  async function recover(e) {
    e.preventDefault()
    const id = payId.trim(), em = email.trim()
    if (!/^pay_[A-Za-z0-9]+$/.test(id)) { setNote({ kind: 'error', text: 'The payment ID starts with pay_.' }); return }
    if (!EMAIL.test(em)) { setNote({ kind: 'error', text: 'Enter the email you paid with.' }); return }
    setNote(null); setStage('verifying')
    try { setResult(await post('/api/recover', { paymentId: id, email: em })); setView('done') } catch (err) { setNote({ kind: 'error', text: err.message }) }
    setStage('idle')
  }

  if (!open) return null
  const noteEl = note && <p className={`buy-note buy-note--${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>
  return createPortal(
    <div className="buy-layer" onPointerDown={e => { if (e.target === e.currentTarget && closeable) onClose() }}>
      <div className="buy" role="dialog" aria-modal="true" aria-labelledby="buy-title" ref={panel} data-lenis-prevent>
        <div className="buy-head">
          <h2 className={`buy-title ${view === 'buy' ? 'sr-only' : ''}`} id="buy-title">
            {view === 'done' && result ? 'Your licence key' : view === 'recover' ? 'Get your key again' : 'Buy Starlit'}
          </h2>
          <span className="buy-head-end">
            {mode === 'test' && <span className="buy-badge">Test mode</span>}
            <button type="button" className="buy-x" onClick={onClose} disabled={!closeable} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </span>
        </div>

        {view === 'done' && result && <KeyResult result={result} downloadUrl={downloadUrl} glyph={glyph} />}

        {view === 'buy' && (
          <form onSubmit={pay} noValidate>
            <PriceHead />
            <label className="buy-label" htmlFor="buy-email">Email</label>
            <input id="buy-email" className="buy-input" type="email" autoComplete="email" inputMode="email" spellCheck="false" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
            <p className="buy-hint">Your key shows up here once you’ve paid. Razorpay emails you the receipt.</p>
            {noteEl}
            <button className="btn buy-cta" disabled={busy}>
              {stage === 'idle' && `Pay ${PRICE_LABEL}`}
              {stage === 'ordering' && <><Spinner />Opening checkout</>}
              {stage === 'paying' && <><Spinner />Waiting for payment</>}
              {stage === 'verifying' && <><Spinner />Confirming payment</>}
            </button>
            <button type="button" className="buy-link" onClick={() => { setView('recover'); setNote(null) }} disabled={busy}>Lost your key?</button>
          </form>
        )}

        {view === 'recover' && (
          <form onSubmit={recover} noValidate>
            <p className="buy-text">Use the payment ID from Razorpay’s receipt email. It starts with pay_.</p>
            <label className="buy-label" htmlFor="buy-pay">Payment ID</label>
            <input id="buy-pay" className="buy-input buy-input--mono" autoComplete="off" spellCheck="false" placeholder="pay_…"
              value={payId} onChange={e => setPayId(e.target.value)} disabled={busy} />
            <label className="buy-label" htmlFor="buy-email2">Email you paid with</label>
            <input id="buy-email2" className="buy-input" type="email" autoComplete="email" inputMode="email" spellCheck="false" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
            {noteEl}
            <button className="btn buy-cta" disabled={busy}>{busy ? <><Spinner />Looking it up</> : 'Get my key'}</button>
            <button type="button" className="buy-link" onClick={() => { setView('buy'); setNote(null) }} disabled={busy}>Back to buying</button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
