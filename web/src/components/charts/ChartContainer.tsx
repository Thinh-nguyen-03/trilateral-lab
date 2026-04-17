import styles from './ChartContainer.module.css'

interface Props {
  title: string
  subtitle?: string
  tag?: string
  isLoading?: boolean
  height?: number
  children: React.ReactNode
}

export function ChartContainer({ title, subtitle, tag, isLoading, height = 320, children }: Props) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.titleRow}>
          <span className={styles.bullet} />
          <h2 className={styles.title}>{title.toUpperCase()}</h2>
          {tag && <span className={styles.tag}>{tag}</span>}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={styles.panelBody}>
        {isLoading ? (
          <div className={styles.skeleton} style={{ height }}>
            <span className={styles.skeletonLabel}>LOADING DATASTREAM...</span>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
