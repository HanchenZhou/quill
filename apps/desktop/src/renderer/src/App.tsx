import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './state/app'
import { ThemeProvider } from './state/theme'
import { PrefsProvider } from './state/prefs'
import { Sidebar } from './components/Sidebar'
import { RightPane } from './components/RightPane'
import { EmptyState } from './components/EmptyState'
import { StatusBar } from './components/StatusBar'
import { DragOverlay } from './components/DragOverlay'
import { AgentPanel } from './components/AgentPanel'
import { OpenChoiceDialog } from './components/OpenChoiceDialog'

const AGENT_OPEN_KEY = 'quill.agent.open'

function readAgentOpen(): boolean {
  try {
    return window.localStorage.getItem(AGENT_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function Shell() {
  const { state, mode, save, openChoiceRequest } = useApp()
  const [agentOpen, setAgentOpen] = useState<boolean>(() => readAgentOpen())

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENT_OPEN_KEY, agentOpen ? '1' : '0')
    } catch {
      /* localStorage may be disabled — best-effort persist only */
    }
  }, [agentOpen])

  // Cmd+S save, Cmd+J toggle agent panel
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void save()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setAgentOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  return (
    <div className="relative h-screen w-screen flex flex-col bg-[var(--paper)] text-[var(--ink)] overflow-hidden">
      <div
        className="h-7 shrink-0 border-b border-[var(--rule)] bg-[var(--paper-dim)]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      <div className="flex-1 flex min-h-0">
        {mode === 'empty' && <EmptyState />}
        {mode === 'workspace' && !state.sidebarCollapsed && <Sidebar />}
        {(mode === 'workspace' || mode === 'single') && <RightPane />}
        {agentOpen && <AgentPanel onClose={() => setAgentOpen(false)} />}
      </div>

      <StatusBar />
      <DragOverlay />
      {openChoiceRequest && (
        <OpenChoiceDialog
          request={openChoiceRequest}
          onResolve={openChoiceRequest.resolve}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </PrefsProvider>
    </ThemeProvider>
  )
}
