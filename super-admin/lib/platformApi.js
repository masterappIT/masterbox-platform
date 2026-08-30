import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const API_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL || ''
export function getPlatformToken() { return typeof window === 'undefined' ? '' : window.localStorage.getItem('masterbox_platform_token') || '' }
export function clearPlatformToken() { if (typeof window !== 'undefined') window.localStorage.removeItem('masterbox_platform_token') }
export async function platformFetch(path, options = {}) {
  if (!API_URL) return null
  const token = getPlatformToken()
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/platform-admin${path}`, { ...options, headers })
  if (!response.ok) { const error = new Error(`Platform API request failed (${response.status})`); error.status = response.status; throw error }
  return response.status === 204 ? null : response.json()
}
export function usePlatformData(path, fallback) {
  const router = useRouter(); const [data, setData] = useState(fallback); const [loading, setLoading] = useState(Boolean(API_URL)); const [error, setError] = useState('')
  useEffect(() => { let active = true; if (!API_URL) { setLoading(false); return undefined }; setLoading(true); setError(''); platformFetch(path).then(result => { if (active && result) setData(result.items || result) }).catch(err => { if (!active) return; if (err.status === 401 || err.status === 403) { clearPlatformToken(); router.replace(`/login?returnTo=${encodeURIComponent(router.asPath)}`) } else setError('暫時無法取得平台資料，已顯示 mock 資料') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [path, router])
  return { data, loading, error }
}
export function DataNotice({ loading, error }) { return loading || error ? <div className='data-notice' role={error ? 'alert' : 'status'}>{loading ? '資料載入中…' : error}</div> : null }
