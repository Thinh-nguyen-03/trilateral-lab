import { useState } from 'react'
import { StrategyModeForm } from './StrategyModeForm'
import { StepControls } from './StepControls'
import { SimulationPanel } from './SimulationPanel'
import styles from './SidePanel.module.css'

interface AccordionProps {
  title: string
  tag: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Accordion({ title, tag, defaultOpen = true, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.accordion}>
      <button
        className={styles.head}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.headArrow}>{open ? '▾' : '▸'}</span>
        <span className={styles.headTitle}>{title}</span>
        <span className={styles.headTag}>{tag}</span>
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  )
}

interface Props {
  open: boolean
}

export function SidePanel({ open }: Props) {
  return (
    <aside className={`${styles.panel} ${open ? '' : styles.closed}`}>
      <div className={styles.inner}>
        {/* Panel header */}
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>INTEL PANEL</span>
          <span className={styles.panelGlyph}>◈</span>
        </div>

        <Accordion title="CONFIGURATION" tag="CFG">
          <StrategyModeForm />
        </Accordion>

        <Accordion title="CONTROLS" tag="CTRL">
          <StepControls />
        </Accordion>

        <Accordion title="TELEMETRY" tag="TLM">
          <SimulationPanel />
        </Accordion>

        <Accordion title="SHORTCUTS" tag="KB" defaultOpen={false}>
          <ShortcutLegend />
        </Accordion>
      </div>
    </aside>
  )
}

function ShortcutLegend() {
  return (
    <div className={styles.shortcuts}>
      <ShortcutRow keys={['SPACE']}   action="Play / Pause" />
      <ShortcutRow keys={['→']}       action="Step one week" />
      <ShortcutRow keys={['R']}       action="Reset trial" />
    </div>
  )
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className={styles.shortcutRow}>
      <span className={styles.shortcutKeys}>
        {keys.map((k) => <kbd key={k} className={styles.kbd}>{k}</kbd>)}
      </span>
      <span className={styles.shortcutAction}>{action}</span>
    </div>
  )
}
