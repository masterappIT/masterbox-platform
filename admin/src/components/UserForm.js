import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { selectUserInfo } from '../redux/slices/userSlices';
import { apolloApiHelpers } from '../graphQL';
import { CREATE_ACCOUNT, UPDATE_ACCOUNT } from '../graphQL/account';

export const emptyUser = { email: '', password: '', name: '', mobile: '', role: 'user' };
const localKey = companyId => `masterbox:users:${companyId}`;

export default function UserForm({ mode }) {
  const router = useRouter();
  const userInfo = useSelector(selectUserInfo);
  const companyId = userInfo?.company_id || router.query.id;
  const editingId = mode === 'edit' ? router.query.id : null;
  const [form, setForm] = useState(emptyUser);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId || !companyId) return;
    try {
      const users = JSON.parse(window.localStorage.getItem(localKey(companyId)) || '[]');
      const user = users.find(item => item._id === editingId);
      if (user) setForm({ ...emptyUser, ...user, password: '' });
    } catch (_) { /* Ignore malformed local fallback data. */ }
  }, [companyId, editingId]);

  const update = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const saveLocal = () => {
    const users = JSON.parse(window.localStorage.getItem(localKey(companyId)) || '[]');
    const record = { ...form, _id: editingId || `local-${Date.now()}`, company_id: companyId };
    const next = editingId ? users.map(item => item._id === editingId ? { ...item, ...record } : item) : [...users, record];
    window.localStorage.setItem(localKey(companyId), JSON.stringify(next));
  };
  const submit = async event => {
    event.preventDefault(); setError('');
    if (!companyId) return setError('找不到公司資訊，請重新登入。');
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) return setError('請輸入有效的電子信箱。');
    if (!editingId && form.password.length < 6) return setError('新增使用者的密碼至少需要 6 個字元。');
    setSaving(true);
    const input = { email: form.email.trim(), role: form.role.trim() || 'user', user_info: JSON.stringify({ name: form.name.trim(), mobile: form.mobile.trim() }) };
    if (!editingId) input.password = form.password;
    const result = await apolloApiHelpers('mutation', editingId ? UPDATE_ACCOUNT : CREATE_ACCOUNT, editingId ? { _id: editingId, input } : { company_id: companyId, input });
    if (result?.error) {
      saveLocal();
      setError(`後端暫不可用，已儲存於本機。${result.error}`);
    } else router.push('/user-management');
    setSaving(false);
  };

  return <form onSubmit={submit} className="max-w-2xl rounded bg-white p-6 shadow">
    <h1 className="mb-5 text-xl font-semibold">{editingId ? '編輯使用者' : '新增使用者'}</h1>
    {error && <div className="mb-4 rounded bg-red-100 p-3 text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1">電子信箱<input name="email" required type="email" value={form.email} onChange={update} className="border p-2" /></label>
      {!editingId && <label className="flex flex-col gap-1">密碼<input name="password" required type="password" value={form.password} onChange={update} className="border p-2" /></label>}
      <label className="flex flex-col gap-1">姓名<input name="name" value={form.name} onChange={update} className="border p-2" /></label>
      <label className="flex flex-col gap-1">手機<input name="mobile" value={form.mobile} onChange={update} className="border p-2" /></label>
      <label className="flex flex-col gap-1">角色<select name="role" value={form.role} onChange={update} className="border p-2"><option value="user">一般使用者</option><option value="admin">管理員</option></select></label>
    </div>
    <div className="mt-6 flex gap-3"><button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white">{saving ? '儲存中…' : '儲存'}</button><button type="button" onClick={() => router.back()} className="border px-4 py-2">返回</button></div>
  </form>;
}
