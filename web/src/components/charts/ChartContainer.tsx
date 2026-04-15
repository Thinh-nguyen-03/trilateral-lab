import styles from './ChartContainer.module.css'

interface Props {
  title: string
  subtitle?: string
  isLoading?: boolean
  height?: number
  children: React.ReactNode
}

export function ChartContainer({ title, subtitle, isLoading, height = 360, children }: Props) {
  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {isLoading ? (
        <div className={styles.skeleton} style={{ height }} />
      ) : (
        <div className={styles.body}>{children}</div>
      )}
    </section>
  )
}
