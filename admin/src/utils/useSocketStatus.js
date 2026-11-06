import { useEffect, useState } from 'react'
import { getSocketStatus, onSocketStatus } from '../graphQL'

/** Whether live messages are arriving: 'connecting', 'connected' or 'disconnected' (it keeps trying again on its own). */
export default function useSocketStatus() {
  const [status, setStatus] = useState(getSocketStatus)
  useEffect(() => {
    setStatus(getSocketStatus())
    return onSocketStatus(setStatus)
  }, [])
  return status
}
