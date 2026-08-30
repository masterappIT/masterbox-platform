import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Table from '../src/stories/components/Table';
import { tableFactory } from '../src/utils/TableFactory';
import TableTop from '../src/components/Table/TableTop';
import { apolloApiHelpers } from '../src/graphQL';
import { LIST_ACCOUNTS, DELETE_ACCOUNT } from '../src/graphQL/account';
import { selectUserInfo } from '../src/redux/slices/userSlices';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';

const localKey = companyId => `masterbox:users:${companyId}`;

function UserManagementPage() {
  const router = useRouter();
  const companyId = useSelector(selectUserInfo)?.company_id;
  const [rows, setRows] = useState([]); const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const loadAccounts = useCallback(async () => {
    if (!companyId) return; setLoading(true); setError('');
    const result = await apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } });
    if (result?.error) {
      try { setRows(JSON.parse(window.localStorage.getItem(localKey(companyId)) || '[]')); } catch (_) { setRows([]); }
      setError('後端暫不可用，顯示本機資料。');
    } else setRows(result?.items || []);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  const normalized = useMemo(() => rows.map(account => ({ status: 1, img: account.info?.avatar || account.info?.name || account.email, name: account.info?.name || account.name || account.email, id: account._id || account.id, role: account.role || 'user', email: account.email || '', last_online_time: account.last_online_time || '-', is_online: Boolean(account.is_online) })), [rows]);
  const tableData = useMemo(() => { const q = search.trim().toLowerCase(); const filtered = q ? normalized.filter(row => [row.name, row.email, row.id, row.role].some(value => String(value).toLowerCase().includes(q))) : normalized; return new tableFactory('userMgmt', filtered); }, [normalized, search]);
  const edit = () => selectedKeys.length === 1 && router.push(`/user-management/edit/${selectedKeys[0]}`);
  const remove = async () => {
    if (!selectedKeys.length || !window.confirm(`確定要刪除選取的 ${selectedKeys.length} 位使用者嗎？`)) return;
    setLoading(true); for (const id of selectedKeys) { const result = await apolloApiHelpers('mutation', DELETE_ACCOUNT, { _id: id }); if (result?.error) { setError(result.error); break; } }
    setSelectedKeys([]); await loadAccounts();
  };
  if (!companyId) return <div className="p-4">正在取得公司資訊…</div>;
  return <div className="w-full h-full"><TableTop addTitle={selectedKeys.length === 1 ? '編輯使用者' : '新增使用者'} searchOnClick={setSearch} addOnClick={selectedKeys.length === 1 ? edit : () => router.push('/user-management/add/new')} deleteOnClick={remove} />{error && <div className="mb-4 rounded bg-yellow-100 p-3 text-yellow-800">{error}</div>}{loading ? <div className="p-4">載入中…</div> : <Table withCheckbox withEdit header={tableData.getHeaders()} row={tableData.getRowsData()} colsTemplate={tableData.getGridTemplate()} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />}</div>;
}
export default UserManagementPage
