import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Table from '../src/stories/components/Table';
import { tableFactory } from '../src/utils/TableFactory';
import TableTop from '../src/components/Table/TableTop';
import { apolloApiHelpers } from '../src/graphQL';
import { LIST_ACCOUNTS, CREATE_ACCOUNT, UPDATE_ACCOUNT, DELETE_ACCOUNT } from '../src/graphQL/account';
import { selectUserInfo } from '../src/redux/slices/userSlices';
import { useSelector } from 'react-redux';

const emptyForm = { email: '', password: '', name: '', mobile: '', role: 'user' };

function CustomersManagementPage() {
    const userInfo = useSelector(selectUserInfo);
    const companyId = userInfo?.company_id;
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadAccounts = useCallback(async () => {
        setLoading(true); setError('');
        const result = await apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } });
        if (result?.error) setError(result.error);
        else setRows(result?.items || []);
        setLoading(false);
    }, [companyId]);
    useEffect(() => { if (companyId) loadAccounts(); }, [companyId, loadAccounts]);

    const normalizedRows = useMemo(() => rows.map(account => ({ status: 1, img: account.info?.avatar || account.info?.name || account.email, name: account.info?.name || account.email, id: account._id || account.id, role: account.role || 'user', email: account.email, last_online_time: account.last_online_time || '-', is_online: Boolean(account.is_online) })), [rows]);
    const tableData = useMemo(() => { const query = search.trim().toLowerCase(); const filtered = query ? normalizedRows.filter(row => [row.name, row.email, row.id, row.role].some(value => String(value).toLowerCase().includes(query))) : normalizedRows; return new tableFactory('userMgmt', filtered); }, [normalizedRows, search]);

    const openForm = () => {
        const selected = normalizedRows.find(row => row.id === selectedKeys[0]);
        setEditingId(selected?.id || null);
        setForm(selected ? { email: selected.email || '', password: '', name: selected.name || '', mobile: '', role: selected.role || 'user' } : emptyForm);
        setShowForm(true);
    };
    const saveAccount = async event => {
        event.preventDefault(); setSaving(true); setError('');
        const input = editingId ? { email: form.email, role: form.role, user_info: JSON.stringify({ name: form.name, mobile: form.mobile }) } : { email: form.email, password: form.password, role: form.role, user_info: JSON.stringify({ name: form.name, mobile: form.mobile }) };
        const variables = editingId ? { _id: editingId, input } : { company_id: companyId, input };
        const result = await apolloApiHelpers('mutation', editingId ? UPDATE_ACCOUNT : CREATE_ACCOUNT, variables);
        if (result?.error) setError(result.error); else { setShowForm(false); setSelectedKeys([]); await loadAccounts(); }
        setSaving(false);
    };
    const removeSelected = async () => {
        if (!selectedKeys.length || !window.confirm(`確定要刪除選取的 ${selectedKeys.length} 位客戶嗎？`)) return;
        setLoading(true); setError('');
        for (const id of selectedKeys) { const result = await apolloApiHelpers('mutation', DELETE_ACCOUNT, { _id: id }); if (result?.error) { setError(result.error); break; } }
        setSelectedKeys([]); await loadAccounts();
    };

    if (!companyId) return <div className="p-4">正在取得公司資訊…</div>;
    return <div className="w-full h-full">
        <TableTop addTitle={selectedKeys.length === 1 ? '編輯客戶' : '新增客戶'} searchOnClick={setSearch} addOnClick={openForm} deleteOnClick={removeSelected} />
        {error && <div className="mb-4 rounded bg-red-100 p-3 text-red-700">{error}</div>}
        {showForm && <form onSubmit={saveAccount} className="mb-5 rounded bg-white p-4 shadow flex flex-wrap gap-3 items-end">
            <label className="flex flex-col">Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border p-2" /></label>
            {!editingId && <label className="flex flex-col">密碼<input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="border p-2" /></label>}
            <label className="flex flex-col">姓名<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border p-2" /></label>
            <label className="flex flex-col">角色<input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="border p-2" /></label>
            <button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white">{saving ? '儲存中…' : '儲存'}</button><button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2">取消</button>
        </form>}
        {loading ? <div className="p-4">載入中…</div> : !normalizedRows.length ? <div className="p-4">目前沒有客戶資料。</div> : <Table withCheckbox withEdit header={tableData.getHeaders()} row={tableData.getRowsData()} colsTemplate={tableData.getGridTemplate()} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />}
    </div>;
}
export default CustomersManagementPage
