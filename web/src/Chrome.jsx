import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// Starlit's mark: a record in eclipse, its rim lit in the three album colours, with a small
// satellite riding the edge. Same artwork as the app icon (assets-src/logo).
export function Mark(props) {
  return <img className="mark" src="/mark.png" alt="" width="64" height="64" aria-hidden="true" {...props} />
}

const LINKS = [['screens', 'Second screen'], ['styles', 'Styles'], ['turntable', 'Record player'], ['details', 'Other features']]

// There is no navigation bar: the page is one scroll, and these links at the bottom are the way back.
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
      <div className="wrap footer-top">
        <div className="footer-brand">
          <span className="brand"><Mark />Starlit</span>
          <p>A lyrics visualizer for Windows. Free to download.</p>
        </div>
        <nav className="footer-links" aria-label="Sections">
          {LINKS.map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}
          <a href={downloadUrl}>Download</a>
        </nav>
      </div>
      <div className="wordmark sung" aria-hidden="true">
        {'Starlit'.split('').map((ch, i) => <span className="ww" data-w={ch} key={i}><span className="w">{ch}</span></span>)}
      </div>
      <div className="wrap footer-base">
        <span>© 2026 Starlit</span>
        <span>The songs on this page are demo tracks made for it.</span>
        <a href="#top">Back to top</a>
      </div>
    </footer>
  )
}
