import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery } from '@apollo/client'
import Table from '../src/stories/components/Table'
import TableTop from '../src/components/Table/TableTop'
import Pagination from '../src/stories/components/Pagination'
import ConfirmDialog from '../src/stories/components/ConfirmDialog'
import AlertStack from '../src/stories/components/AlertStack'
import useAlerts from '../src/utils/useAlerts'
import usePagination from '../src/utils/usePagination'
import { MESSAGE_TEMPLATES, DELETE_MESSAGE_TEMPLATE } from '../src/graphQL/messageTemplate'
import { parseTemplateMessages, platformLabel } from '../src/utils/messageTemplate'

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-TW', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function MessagingTemplatePage() {
  const router = useRouter()
  const { data, loading, error, refetch } = useQuery(MESSAGE_TEMPLATES, { fetchPolicy: 'cache-and-network' })
  const [deleteTemplate] = useMutation(DELETE_MESSAGE_TEMPLATE)
  const { alerts, pushAlert, dismissAlert } = useAlerts()
  const [search, setSearch] = useState('')
  const [selectedKeys, setSelectedKeys] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const templates = useMemo(() => {
    const query = search.trim().toLowerCase()
    const all = data?.messageTemplates || []
    return query ? all.filter((template) => template.name.toLowerCase().includes(query)) : all
  }, [data, search])
  const { page, pageCount, pageItems, setPage } = usePagination(templates)

  const rows = pageItems.map((template) => {
    const messages = parseTemplateMessages(template.contents)
    return [
      { key: 'name', element: 'text', value: template.name },
      { key: 'platform', element: 'custom', value: <span className='flex items-center gap-[8px] min-w-0 px-[8px]'><img src={`/svg/${template.platform}.svg`} alt='' width={20} height={20} /><span className='truncate'>{platformLabel(template.platform)}</span></span> },
      { key: 'contents', element: 'text', value: messages.length ? messages.join(' / ') : '（沒有文字內容）' },
      { key: 'updatedAt', element: 'text', value: formatDate(template.updatedAt) },
    ]
  })

  const removeSelected = async () => {
    setDeleting(true)
    const failed = []
    for (const id of selectedKeys) {
      try { await deleteTemplate({ variables: { id } }) } catch (err) { failed.push(err.message) }
    }
    setDeleting(false)
    setConfirming(false)
    await refetch()
    if (failed.length) pushAlert('error', `有 ${failed.length} 個範本刪除失敗：${failed[0]}`)
    else pushAlert('success', `已刪除 ${selectedKeys.length} 個範本`)
    setSelectedKeys([])
  }

  const isFirstLoad = loading && !data
  return (
    <div className='w-full h-full'>
      <Table
        withCheckbox
        withEdit
        colsTemplate='24px minmax(160px,1.2fr) minmax(120px,0.8fr) minmax(200px,2fr) minmax(150px,0.8fr) 48px'
        header={['訊息名稱', '平台', '內容', '最後更新']}
        row={rows}
        rowIds={pageItems.map((template) => template.id)}
        loading={isFirstLoad}
        emptyText={error ? '目前無法讀取訊息範本，請稍後再試' : search ? '找不到符合的範本' : '無任何一筆資料，趕快新增一筆資料吧'}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        onEdit={(id) => router.push(`/messaging-template/edit?id=${id}`)}
        topElms={<TableTop
          searchPlaceholder='依標題搜尋名稱'
          searchOnChange={(value) => { setSearch(value); setPage(1) }}
          addTitle='新增範本'
          addOnClick={() => router.push('/messaging-template/edit')}
          deleteOnClick={() => setConfirming(true)}
          deleteDisabled={!selectedKeys.length}
          deleteHint={selectedKeys.length ? undefined : '請先勾選要刪除的範本'}
        />}
        footer={<Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      />
      <ConfirmDialog
        isShow={confirming}
        title={`確定要刪除 ${selectedKeys.length} 個範本嗎？`}
        description='刪除後無法復原。'
        busy={deleting}
        onConfirm={removeSelected}
        onCancel={() => setConfirming(false)}
      />
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  )
}

export default MessagingTemplatePage
