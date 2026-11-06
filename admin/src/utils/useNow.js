import { useEffect, useState } from 'react'

/** The current time, moving on every `intervalMs`, for countdowns. */
export default function useNow(intervalMs = 60 * 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
