import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Table from '../src/stories/components/Table';
import { tableFactory } from '../src/utils/TableFactory';
import TableTop from '../src/components/Table/TableTop';
import { apolloApiHelpers } from '../src/graphQL';
import { LIST_ACCOUNTS, DELETE_ACCOUNT, UPDATE_ACCOUNT } from '../src/graphQL/account';
import { selectUserInfo } from '../src/redux/slices/userSlices';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';

const headerNames = { status: '狀態', img: '頭像', name: '名稱', role: '角色', email: '電子信箱' };
const roleNames = { admin: '管理員', user: '一般成員' };

function UserManagementPage() {
  const router = useRouter();
  const companyId = useSelector(selectUserInfo)?.company_id;
  const [rows, setRows] = useState([]); const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [pendingToggles, setPendingToggles] = useState([]);
  const loadAccounts = useCallback(async () => {
    if (!companyId) return; setLoading(true); setError('');
    const result = await apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } });
    if (result?.error) { setRows([]); setError('目前無法讀取使用者，請稍後再試。'); }
    else setRows(result?.items || []);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  const normalized = useMemo(() => rows.map(account => ({ status: account.enabled === false ? 0 : 1, img: account.info?.avatar || account.info?.name || account.email, name: account.info?.name || account.name || account.email, id: account._id || account.id, role: roleNames[account.role] || roleNames.user, email: account.email || '' })), [rows]);
  // getRowsData() rewrites the factory's rows, so build the table once per change rather than on every render.
  const tableData = useMemo(() => { const q = search.trim().toLowerCase(); const filtered = q ? normalized.filter(row => [row.name, row.email, row.id, row.role].some(value => String(value).toLowerCase().includes(q))) : normalized; const table = new tableFactory('accountsMgmt', filtered); return { filtered, header: table.getHeaders().map(col => headerNames[col] || col), colsTemplate: table.getGridTemplate(), row: table.getRowsData() }; }, [normalized, search]);
  const toggleAccount = async (index, enabled) => {
    const account = tableData.filtered[index]; if (!account) return;
    setError(''); setPendingToggles(pending => [...pending, index]);
    const result = await apolloApiHelpers('mutation', UPDATE_ACCOUNT, { _id: account.id, input: { enabled } });
    setPendingToggles(pending => pending.filter(i => i !== index));
    if (result?.error) return setError(`無法${enabled ? '啟用' : '停用'}「${account.name}」：${result.error}`);
    setRows(current => current.map(row => (row._id || row.id) === account.id ? { ...row, enabled: result.enabled } : row));
  };
  const edit = () => selectedKeys.length === 1 && router.push(`/user-management/edit/${selectedKeys[0]}`);
  const remove = async () => {
    if (!selectedKeys.length || !window.confirm(`確定要刪除選取的 ${selectedKeys.length} 位使用者嗎？`)) return;
    setLoading(true); for (const id of selectedKeys) { const result = await apolloApiHelpers('mutation', DELETE_ACCOUNT, { _id: id }); if (result?.error) { setError(result.error); break; } }
    setSelectedKeys([]); await loadAccounts();
  };
  if (!companyId) return <div className="p-4">正在取得公司資訊…</div>;
  return <div className="w-full h-full"><TableTop addTitle={selectedKeys.length === 1 ? '編輯使用者' : '新增使用者'} searchOnClick={setSearch} addOnClick={selectedKeys.length === 1 ? edit : () => router.push('/user-management/add/new')} deleteOnClick={remove} />{error && <div className="mb-4 rounded bg-yellow-100 p-3 text-yellow-800">{error}</div>}{loading ? <div className="p-4">載入中…</div> : <Table withCheckbox withEdit header={tableData.header} row={tableData.row} colsTemplate={tableData.colsTemplate} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} onToggle={toggleAccount} pendingToggles={pendingToggles} rowIds={tableData.filtered.map(row => row.id)} />}</div>;
}
export default UserManagementPage
