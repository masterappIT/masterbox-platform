import Link from 'next/link'
import { useRouter } from 'next/router'
import { sections } from './data'
import { clearPlatformToken } from '../lib/platformApi'

export default function Layout({ children, title, subtitle }) {
  const router = useRouter()
  const active = router.pathname === '/' ? 'overview' : router.pathname.split('/')[1]
  const logout = () => { clearPlatformToken(); router.push('/login') }
  return <div className='console-shell'>
    <aside className='console-sidebar'><div className='console-brand'><span className='brand-mark'>M</span><div><b>MASTERBOX</b><small>PLATFORM CONSOLE</small></div></div><div className='console-user'><span>SA</span><div><b>Platform Admin</b><small>超級管理員</small></div></div><nav>{sections.map(([key, label, icon, href]) => <Link href={href} key={key}><a className={active === key ? 'active' : ''}><i>{icon}</i>{label}</a></Link>)}</nav><button className='console-logout' onClick={logout}>↪ 登出平台</button></aside>
    <main className='console-main'><header><div><span className='console-kicker'>PLATFORM OPERATIONS / {active.toUpperCase()}</span><h1>{title}</h1><p>{subtitle || '跨租戶掌握 MasterBox 平台營運狀態'}</p></div><button className='console-action' onClick={() => alert('資料已更新')}>↻ 更新資料</button></header>{children}</main>
  </div>
}

export function PagePanel({ children, className = '' }) { return <section className={'console-panel page-panel ' + className}>{children}</section> }
export function Status({ value }) { return <span className={'status ' + (value === '運作中' || value === '成功' ? 'ok' : value === '付款逾期' || value === '需要注意' ? 'due' : 'trial')}>{value}</span> }
