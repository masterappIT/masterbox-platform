import { useState } from 'react'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const base = process.env.NEXT_PUBLIC_PLATFORM_API_URL
      if (!base) throw new Error('尚未設定平台 API 位址')
      const endpoint = challengeToken ? '/api/platform-admin/auth/mfa/verify' : '/api/platform-admin/auth/login'
      const body = challengeToken ? { challengeToken, code } : { id, password }
      const response = await fetch(`${base.replace(/\/$/, '')}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '登入失敗')
      if (data.mfaRequired && data.challengeToken) { setChallengeToken(data.challengeToken); return }
      if (!data.token) throw new Error('登入回應無效')
      localStorage.setItem('masterbox_platform_token', data.token)
      router.push('/')
    } catch (err) { setError(err.message || '登入失敗') } finally { setSubmitting(false) }
  }
  return <main className='login-shell'><form className='login-card' onSubmit={submit}><span className='console-kicker'>MASTERBOX PLATFORM CONSOLE</span><h1>{challengeToken ? '輸入驗證碼' : '平台管理員登入'}</h1><p>{challengeToken ? '請輸入驗證器 App 顯示的 6 位數驗證碼。' : '僅限授權的平台營運人員使用。'}</p>{!challengeToken && <><label>管理員 ID<input type='text' required value={id} onChange={e => setId(e.target.value)} autoComplete='username' /></label><label>密碼<input type='password' required value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password' /></label></>}{challengeToken && <label>一次性驗證碼<input inputMode='numeric' pattern='[0-9]{6}' maxLength='6' required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoComplete='one-time-code' /></label>}{error && <div className='login-error' role='alert'>{error}</div>}<button className='primary-action' type='submit' disabled={submitting}>{submitting ? '驗證中…' : challengeToken ? '完成 MFA 登入' : '登入平台'}</button></form></main>
}
