import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './stores/app'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { ToastContainer } from './components/Toast'
import { Dashboard } from './pages/Dashboard'
import { Platforms } from './pages/Platforms'
import { ProxyPage } from './pages/Proxy'
import { Logs } from './pages/Logs'
import { Settings } from './pages/Settings'

export default function App() {
  const loadData = useAppStore((s) => s.loadData)
  const addLog = useAppStore((s) => s.addLog)
  const setProxyRunning = useAppStore((s) => s.setProxyRunning)
  const showToast = useAppStore((s) => s.showToast)

  useEffect(() => {
    loadData()

    // 监听事件
    window.api.onLogAdded((log) => addLog(log))
    window.api.onProxyStatusChanged((running) => setProxyRunning(running))
    window.api.onToast((toast) => showToast(toast))
  }, [])

  return (
    <HashRouter>
      <div className="flex h-screen flex-col bg-bg-primary">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-bg-primary">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/platforms" element={<Platforms />} />
              <Route path="/proxy" element={<ProxyPage />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
        <ToastContainer />
      </div>
    </HashRouter>
  )
}
