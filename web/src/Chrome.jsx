import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// Starlit's mark: a record with a small satellite on its rim. The app icon is drawn from the
// same shapes (assets-src/logo/make-icon.py).
export function Mark(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.3" fill="currentColor" />
      <circle cx="18.3" cy="5.7" r="2.9" fill="currentColor" stroke="var(--ink, #070912)" strokeWidth="1.4" />
    </svg>
  )
}

// violet -> amber -> teal across the seven letters of the name
const WORDMARK = ['#ab9cff', '#c8a3d6', '#e6a8a1', '#ffaa6a', '#c3bd8a', '#89d0ad', '#4fe3cf']

// The page ends on its name, lit letter by letter, and one quiet line.
export function Footer({ downloadUrl }) {
  const root = useRef(null)
  useGSAP(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // The name lights up letter by letter as you reach the end of the page.
    gsap.to('.wordmark .w', { opacity: 1, stagger: 0.14, ease: 'none',
      scrollTrigger: { trigger: '.wordmark', start: 'top 96%', end: 'bottom 100%', scrub: 0.5 } })
  }, { scope: root })
  return (
    <footer className="footer" ref={root}>
      <div className="wordmark sung" aria-hidden="true">
        {'Starlit'.split('').map((ch, i) => <span className="ww" data-w={ch} key={i}><span className="w" style={{ '--wc': WORDMARK[i] }}>{ch}</span></span>)}
      </div>
      <div className="wrap footer-base">
        <p><span className="footer-copy">© 2026 Starlit</span><span>The songs on this page were written for it.</span></p>
        <a className="to-top" href="#top" aria-label="Back to top">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>
    </footer>
  )
}
