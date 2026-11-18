import { Code2, Cpu, ArrowRight, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { translations, type Lang } from '../appShared'

/** IT illustration for the mobile hero: laptop with code, graduation cap, React and Python tiles. */
export function HeroIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 320 260" role="img" aria-label="Laptop with code and a graduation cap">
      <defs>
        <linearGradient id="hi-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#163c33" /><stop offset="1" stopColor="#0b221c" /></linearGradient>
        <linearGradient id="hi-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9c9c4" /><stop offset="1" stopColor="#6f8580" /></linearGradient>
        <linearGradient id="hi-cap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b4a52" /><stop offset="1" stopColor="#151d22" /></linearGradient>
        <radialGradient id="hi-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#3ee08f" stopOpacity="0.55" /><stop offset="1" stopColor="#3ee08f" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="170" cy="200" rx="140" ry="46" fill="url(#hi-glow)" />
      <ellipse cx="170" cy="204" rx="122" ry="30" fill="none" stroke="#3ee08f" strokeOpacity="0.7" strokeWidth="2" />
      <g transform="rotate(-14 170 140)">
        <rect x="92" y="62" width="150" height="104" rx="12" fill="url(#hi-body)" />
        <rect x="100" y="70" width="134" height="88" rx="7" fill="url(#hi-screen)" />
        <text x="167" y="125" textAnchor="middle" fontFamily="Consolas, monospace" fontWeight="700" fontSize="34" fill="#3ee08f">&lt;/&gt;</text>
        <path d="M78 168 h178 l14 20 H64 Z" fill="url(#hi-body)" />
        <rect x="142" y="172" width="50" height="6" rx="3" fill="#56696a" />
      </g>
      <g transform="translate(176 6) rotate(18)">
        <path d="M0 30 L62 0 L124 30 L62 60 Z" fill="url(#hi-cap)" />
        <path d="M30 44 v22 c0 10 64 10 64 0 v-22 l-32 16 Z" fill="#202a30" />
        <path d="M112 36 v38" stroke="#f2b632" strokeWidth="3" />
        <path d="M105 74 h14 l-3 18 h-8 Z" fill="#f2b632" />
      </g>
      <g transform="translate(20 34) rotate(-10)">
        <rect width="58" height="58" rx="14" fill="#152a33" stroke="#2c4b57" />
        <g transform="translate(29 29)" fill="none" stroke="#61dafb" strokeWidth="2.4">
          <ellipse rx="19" ry="7.5" />
          <ellipse rx="19" ry="7.5" transform="rotate(60)" />
          <ellipse rx="19" ry="7.5" transform="rotate(120)" />
          <circle r="3.2" fill="#61dafb" stroke="none" />
        </g>
      </g>
      <g transform="translate(250 160) rotate(8)">
        <rect width="56" height="56" rx="14" fill="#1c2a3a" stroke="#2f4560" />
        <path d="M27 11c-8 0-8 4-8 6v5h9v2H15c-5 0-7 4-7 9s2 9 6 9h3v-6c0-4 3-7 7-7h9c4 0 6-3 6-6v-6c0-4-4-6-12-6z" fill="#3c78aa" />
        <path d="M29 45c8 0 8-4 8-6v-5h-9v-2h13c5 0 7-4 7-9s-2-9-6-9h-3v6c0 4-3 7-7 7h-9c-4 0-6 3-6 6v6c0 4 4 6 12 6z" fill="#f7cc3c" />
      </g>
      <path d="M150 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#3ee08f" opacity="0.8" />
      <path d="M232 236 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#3ee08f" opacity="0.7" />
    </svg>
  )
}

/** Home-page hero: headline (desktop + 3-line mobile title), start / courses buttons and the code illustration. */
export default function HeroSection({ t, startLearningLink }: { t: (typeof translations)[Lang]; startLearningLink: string }) {
  return (
    <section className="hero-section">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">LEVEL UP</span>
          <h1>
            <span className="hero-title-desktop">{t.heroTitle}</span>
            <span className="hero-title-mobile">
              {t.home.titleLines.map((line, index) => (
                <span key={line} className={index === t.home.titleLines.length - 1 ? 'hero-title-line accent' : 'hero-title-line'}>{line}</span>
              ))}
            </span>
          </h1>
          <p><span className="hero-title-desktop">{t.heroSubtitle}</span><span className="hero-title-mobile">{t.home.subtitle}</span></p>
          <div className="hero-actions">
            <Link to={startLearningLink} className="btn btn-primary btn-lg hero-start-button">
              <Play size={16} className="hero-start-icon" fill="currentColor" />
              <span>{t.buttons.start}</span>
              <ArrowRight size={18} className="hero-start-icon" />
            </Link>
            <button type="button" className="btn btn-secondary btn-lg hero-courses-button" onClick={() => { document.getElementById('popular-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{t.buttons.coursesBtn}</button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="tech-panel">
            <div className="code-badges"><span>HTML</span><span>CSS</span><span>JS</span><span>AI</span></div>
            <div className="code-window">
              <div className="window-bar"><span /><span /><span /></div>
              <pre>{`const course = {\n  stack: ['HTML','CSS','JS'],\n  goal: 'Build products',\n  result: 'LEVEL UP'\n};`}</pre>
            </div>
            <div className="floating-card floating-one"><Cpu size={18} /> AI mentor</div>
            <div className="floating-card floating-two"><Code2 size={18} /> 20 lessons</div>
          </div>
          <HeroIllustration />
        </div>
      </div>
    </section>
  )
}
