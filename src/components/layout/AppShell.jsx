import { useState } from 'react'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import Panel from '../common/Panel.jsx'
import Tabs, { TabPanel } from '../common/Tabs.jsx'
import EmptyState from '../common/EmptyState.jsx'
import CodeEditor from '../editor/CodeEditor.jsx'
import EditorToolbar from '../editor/EditorToolbar.jsx'
import ConsolePanel from '../console/ConsolePanel.jsx'
import CallStackVisualizer from '../visualizers/CallStackVisualizer.jsx'
import ScopeVisualizer from '../visualizers/ScopeVisualizer.jsx'
import ClosureVisualizer from '../visualizers/ClosureVisualizer.jsx'
import EventLoopVisualizer from '../visualizers/EventLoopVisualizer.jsx'
import PromiseVisualizer from '../visualizers/PromiseVisualizer.jsx'
import WebApiVisualizer from '../visualizers/WebApiVisualizer.jsx'
import MemoryVisualizer from '../visualizers/MemoryVisualizer.jsx'
import TimelineVisualizer from '../execution/TimelineVisualizer.jsx'
import PerformancePanel from '../execution/PerformancePanel.jsx'
import AIExplanationPanel from '../ai/AIExplanationPanel.jsx'
import CommandPalette from '../common/CommandPalette.jsx'
import { useExecution } from '../../context/ExecutionContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js'
import { EXAMPLES } from '../../data/examples.js'
import styles from './AppShell.module.css'

const VISUALIZER_TABS = [
  { id: 'callstack', label: 'Call Stack' },
  { id: 'scopes', label: 'Scopes' },
  { id: 'closures', label: 'Closures' },
  { id: 'eventloop', label: 'Event Loop' },
  { id: 'promises', label: 'Promises' },
  { id: 'memory', label: 'Memory' },
  { id: 'webapis', label: 'Web APIs' },
]

const BOTTOM_TABS = [
  { id: 'console', label: 'Console' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'performance', label: 'Performance' },
  { id: 'ai', label: 'AI Explanation' },
]

const VISUALIZER_COMPONENTS = {
  callstack: CallStackVisualizer,
  scopes: ScopeVisualizer,
  closures: ClosureVisualizer,
  eventloop: EventLoopVisualizer,
  promises: PromiseVisualizer,
  webapis: WebApiVisualizer,
  memory: MemoryVisualizer,
}

const VISUALIZER_COPY = {}

const BOTTOM_COMPONENTS = {
  console: ConsolePanel,
  timeline: TimelineVisualizer,
  performance: PerformancePanel,
  ai: AIExplanationPanel,
}

const BOTTOM_COPY = {}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [visualizerTab, setVisualizerTab] = useState(VISUALIZER_TABS[0].id)
  const [bottomTab, setBottomTab] = useState(BOTTOM_TABS[0].id)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { state, run, stop, reset, setSourceCode, selectExample, playback } = useExecution()
  const { sourceCode, activeExampleId } = state
  const { cycleTheme } = useTheme()

  useKeyboardShortcuts({
    onRun: () => run(sourceCode),
    onStop: () => stop(),
    onTogglePalette: () => setPaletteOpen((open) => !open),
    onPlayPause: () => {
      if (!playback.isFinished) return
      if (playback.isPlaying) playback.pause()
      else playback.play()
    },
    onStepForward: () => playback.isFinished && playback.stepForward(),
    onStepBackward: () => playback.isFinished && playback.stepBackward(),
  })

  const commands = [
    { id: 'run', label: 'Run code', shortcut: 'Ctrl/Cmd+Enter', action: () => run(sourceCode) },
    { id: 'stop', label: 'Stop execution', shortcut: 'Esc', action: () => stop() },
    { id: 'reset', label: 'Reset', action: () => reset() },
    { id: 'play', label: 'Play timeline', shortcut: 'Space', disabled: !playback.isFinished, action: () => playback.play() },
    { id: 'pause', label: 'Pause timeline', shortcut: 'Space', disabled: !playback.isPlaying, action: () => playback.pause() },
    { id: 'step-forward', label: 'Step forward', shortcut: '→', disabled: !playback.isFinished, action: () => playback.stepForward() },
    { id: 'step-backward', label: 'Step backward', shortcut: '←', disabled: !playback.isFinished, action: () => playback.stepBackward() },
    { id: 'open-eventloop', label: 'Open Event Loop visualizer', action: () => setVisualizerTab('eventloop') },
    { id: 'open-closures', label: 'Open Closure visualizer', action: () => setVisualizerTab('closures') },
    { id: 'explain-ai', label: 'Explain with AI', action: () => setBottomTab('ai') },
    { id: 'toggle-theme', label: 'Toggle theme', action: () => cycleTheme() },
    ...EXAMPLES.map((example) => ({
      id: `example-${example.id}`,
      label: `Load example: ${example.title}`,
      action: () => selectExample(example),
    })),
  ]

  return (
    <div className={styles.shell}>
      <Header
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        sidebarOpen={sidebarOpen}
        sourceCode={sourceCode}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <div className={[styles.body, sidebarOpen ? '' : styles.sidebarCollapsed].filter(Boolean).join(' ')}>
        <div className={styles.sidebarSlot}>
          <Sidebar activeExampleId={activeExampleId} onSelectExample={selectExample} />
        </div>

        <div className={styles.workspace}>
          <div className={styles.upper}>
            <div className={styles.editorSlot}>
              <Panel
                noPadding
                header={
                  <EditorToolbar value={sourceCode} onChange={setSourceCode} cursorPosition={cursorPosition} />
                }
              >
                <CodeEditor value={sourceCode} onChange={setSourceCode} onCursorChange={setCursorPosition} />
              </Panel>
            </div>

            <div className={styles.visualizerSlot}>
              <Panel
                noPadding
                header={
                  <Tabs
                    idBase="visualizer"
                    tabs={VISUALIZER_TABS}
                    activeId={visualizerTab}
                    onChange={setVisualizerTab}
                    size="sm"
                  />
                }
              >
                {VISUALIZER_TABS.map((tab) => {
                  const VisualizerComponent = VISUALIZER_COMPONENTS[tab.id]
                  return (
                    <TabPanel key={tab.id} idBase="visualizer" id={tab.id} activeId={visualizerTab} className={styles.tabPanel}>
                      {VisualizerComponent ? (
                        <VisualizerComponent />
                      ) : (
                        <EmptyState icon="◇" title={tab.label} description={VISUALIZER_COPY[tab.id]} />
                      )}
                    </TabPanel>
                  )
                })}
              </Panel>
            </div>
          </div>

          <div className={styles.lower}>
            <Panel
              noPadding
              header={
                <Tabs idBase="bottom" tabs={BOTTOM_TABS} activeId={bottomTab} onChange={setBottomTab} size="sm" />
              }
            >
              {BOTTOM_TABS.map((tab) => {
                const BottomComponent = BOTTOM_COMPONENTS[tab.id]
                return (
                  <TabPanel key={tab.id} idBase="bottom" id={tab.id} activeId={bottomTab} className={styles.tabPanel}>
                    {BottomComponent ? (
                      <BottomComponent />
                    ) : (
                      <EmptyState icon="▤" title={tab.label} description={BOTTOM_COPY[tab.id]} />
                    )}
                  </TabPanel>
                )
              })}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppShell
