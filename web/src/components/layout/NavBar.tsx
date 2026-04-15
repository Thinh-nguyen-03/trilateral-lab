import { NavLink } from 'react-router-dom'
import styles from './NavBar.module.css'

export function NavBar() {
  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>Trilateration Lab</span>
      <div className={styles.links}>
        <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>
          Dashboard
        </NavLink>
        <NavLink to="/simulate" className={({ isActive }) => isActive ? styles.active : ''}>
          Simulate
        </NavLink>
      </div>
    </nav>
  )
}
