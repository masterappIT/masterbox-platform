import { useCallback, useEffect, useRef, useState } from 'react'

const SUCCESS_VISIBLE_MS = 4000

// Success notices clear themselves; errors stay until they are dismissed.
export default function useAlerts() {
  const [alerts, setAlerts] = useState([])
  const nextId = useRef(1)
  const timers = useRef([])

  const dismissAlert = useCallback((id) => setAlerts((current) => current.filter((alert) => alert.id !== id)), [])

  const pushAlert = useCallback((type, message) => {
    const id = nextId.current++
    setAlerts((current) => [...current, { id, type, message }])
    if (type === 'success') timers.current.push(setTimeout(() => dismissAlert(id), SUCCESS_VISIBLE_MS))
  }, [dismissAlert])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return { alerts, pushAlert, dismissAlert }
}
