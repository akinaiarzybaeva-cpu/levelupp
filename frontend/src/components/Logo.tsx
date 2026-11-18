import { Link } from 'react-router-dom'
// Optimised 384px WebP of assets/лого.png (826 KB -> ~21 KB); displayed at <=170px wide.
import siteLogo from '../assets/logo.webp'

/** LevelUp logo. With `to` it is a link (header / sidebars), without it a plain image (auth card). */
export default function Logo({ to, className = 'brand', imageClassName = 'brand-logo-image', ariaLabel = 'LEVEL UP home', onClick }: {
  to?: string
  className?: string
  imageClassName?: string
  ariaLabel?: string
  onClick?: () => void
}) {
  const image = <img src={siteLogo} alt="LEVEL UP" className={imageClassName} />
  if (!to) return image
  return (
    <Link className={className} to={to} aria-label={ariaLabel} onClick={onClick}>
      {image}
    </Link>
  )
}
