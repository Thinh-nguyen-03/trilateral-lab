import { NavLink } from 'react-router-dom'
import styles from './NavBar.module.css'

export function NavBar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <span className={styles.bracket}>[</span>
        <span className={styles.brandName}>TRI·LAT</span>
        <span className={styles.bracket}>]</span>
        <span className={styles.brandSub}>INTELLIGENCE LAB</span>
      </div>

      <div className={styles.links}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAmber : ''}`}
        >
          <span className={styles.dot} />
          ANALYSIS
        </NavLink>
        <NavLink
          to="/simulate"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.linkGreen : ''}`}
        >
          <span className={styles.dot} />
          SIMULATE
        </NavLink>
      </div>
    </nav>
  )
}
