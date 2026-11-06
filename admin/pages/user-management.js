import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter } from 'next/router'
import Table from '../src/stories/components/Table'
import TableTop from '../src/components/Table/TableTop'
import Avatar from '../src/stories/components/Avatar'
import Pagination from '../src/stories/components/Pagination'
import ConfirmDialog from '../src/stories/components/ConfirmDialog'
import AlertStack from '../src/stories/components/AlertStack'
import useAlerts from '../src/utils/useAlerts'
import usePagination from '../src/utils/usePagination'
import { apolloApiHelpers } from '../src/graphQL'
import { LIST_ACCOUNTS, DELETE_ACCOUNT, UPDATE_ACCOUNT } from '../src/graphQL/account'
import { GET_USER_SUBSCRIBED_CHANNELS } from '../src/graphQL/channel'
import { selectUserInfo } from '../src/redux/slices/userSlices'

const ROLE_NAMES = { admin: '管理者', user: '使用者' }

function UserManagementPage() {
  const router = useRouter()
  const userInfo = useSelector(selectUserInfo)
  const companyId = userInfo?.company_id
  const { alerts, pushAlert, dismissAlert } = useAlerts()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKeys, setSelectedKeys] = useState([])
  const [pendingIds, setPendingIds] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // The company's channels by id, to name each user's.
  const [channelNames, setChannelNames] = useState({})

  useEffect(() => {
    apolloApiHelpers('query', GET_USER_SUBSCRIBED_CHANNELS, undefined, { fetchPolicy: 'no-cache' }).then((result) => {
      if (Array.isArray(result)) setChannelNames(Object.fromEntries(result.map(({ channel_id: id, name }) => [id, name])))
    })
  }, [])

  const loadAccounts = useCallback(async () => {
    if (!companyId) return
    const result = await apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } }, { fetchPolicy: 'no-cache' })
    setLoadError(Boolean(result?.error))
    setAccounts(result?.error ? [] : result?.items || [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return accounts
    return accounts.filter(({ email, info, role }) => [info?.name, email, ROLE_NAMES[role]].some((value) => String(value || '').toLowerCase().includes(query)))
  }, [accounts, search])
  const { page, pageCount, pageItems, setPage } = usePagination(filtered)

  const toggleAccount = async (index, enabled) => {
    const account = pageItems[index]
    if (!account) return
    setPendingIds((ids) => [...ids, account._id])
    const result = await apolloApiHelpers('mutation', UPDATE_ACCOUNT, { _id: account._id, input: { enabled } })
    setPendingIds((ids) => ids.filter((id) => id !== account._id))
    const name = account.info?.name || account.email
    if (result?.error) return pushAlert('error', `無法${enabled ? '啟用' : '停用'}「${name}」：${result.error}`)
    setAccounts((current) => current.map((row) => (row._id === account._id ? { ...row, enabled: result.enabled } : row)))
    pushAlert('success', `已${result.enabled ? '啟用' : '停用'}「${name}」`)
  }

  const removeSelected = async () => {
    setDeleting(true)
    const failed = []
    for (const id of selectedKeys) {
      const result = await apolloApiHelpers('mutation', DELETE_ACCOUNT, { _id: id })
      if (result?.error) failed.push(result.error)
    }
    await loadAccounts()
    setDeleting(false)
    setConfirming(false)
    setSelectedKeys([])
    if (failed.length) pushAlert('error', `有 ${failed.length} 位使用者刪除失敗：${failed[0]}`)
    else pushAlert('success', `已刪除 ${selectedKeys.length} 位使用者`)
  }

  // Admins work in every channel; a user only in the ones given to them.
  const channelsOf = (account) => {
    if (account.role === 'admin') return '全部頻道'
    const names = (account.channel_ids || []).map((id) => channelNames[id]).filter(Boolean)
    return names.length ? names.join('、') : '未設定（看不到對話）'
  }

  const rows = pageItems.map((account) => {
    const name = account.info?.name || account.email
    return [
      { key: 'name', element: 'custom', value: <span className='flex items-center gap-[12px] min-w-0 px-[8px]'><Avatar name={account.info?.avatar || name} size='small' /><span className='truncate' title={name}>{name}{account._id === userInfo?._id ? '（你）' : ''}</span></span> },
      { key: 'role', element: 'text', value: ROLE_NAMES[account.role] || account.role || '' },
      { key: 'email', element: 'text', value: account.email },
      { key: 'channels', element: 'text', value: channelsOf(account) },
      { key: 'enabled', element: 'toggle', value: account.enabled === false ? 0 : 1, label: `啟用「${name}」`, disabled: account._id === userInfo?._id },
    ]
  })
  const selfSelected = selectedKeys.includes(userInfo?._id)

  return (
    <div className='w-full h-full'>
      <Table
        withCheckbox
        withEdit
        colsTemplate='24px minmax(180px,1.3fr) minmax(80px,0.5fr) minmax(200px,1.4fr) minmax(160px,1.2fr) minmax(80px,0.5fr) 48px'
        header={['名稱', '角色', '電子信箱', '可處理的頻道', '啟用']}
        row={rows}
        rowIds={pageItems.map((account) => account._id)}
        loading={loading}
        emptyText={loadError ? '目前無法讀取使用者，請稍後再試' : search ? '找不到符合的使用者' : '無任何一筆資料，趕快新增一筆資料吧'}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        onToggle={toggleAccount}
        pendingToggles={pageItems.map((account, index) => (pendingIds.includes(account._id) ? index : null)).filter((index) => index !== null)}
        onEdit={(id) => router.push(`/user-management/edit/${id}`)}
        topElms={<TableTop
          searchPlaceholder='依名稱或信箱搜尋'
          searchOnChange={(value) => { setSearch(value); setPage(1) }}
          addTitle='新增使用者'
          addOnClick={() => router.push('/user-management/add/new')}
          deleteOnClick={() => setConfirming(true)}
          deleteDisabled={!selectedKeys.length || selfSelected}
          deleteHint={selfSelected ? '不能刪除自己的帳號' : selectedKeys.length ? undefined : '請先勾選要刪除的使用者'}
        />}
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      />
      <ConfirmDialog
        isShow={confirming}
        title={`確定要刪除 ${selectedKeys.length} 位使用者嗎？`}
        description='刪除後對方將無法登入，且無法復原。'
        busy={deleting}
        onConfirm={removeSelected}
        onCancel={() => setConfirming(false)}
      />
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}

export default UserManagementPage
