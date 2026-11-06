import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import Card from '../stories/components/Card';
import Input from '../stories/components/Input';
import Button from '../stories/components/Button';
import Loading from '../stories/components/Loading';
import AlertStack from '../stories/components/AlertStack';
import useAlerts from '../utils/useAlerts';
import { selectUserInfo } from '../redux/slices/userSlices';
import { apolloApiHelpers } from '../graphQL';
import { CREATE_ACCOUNT, UPDATE_ACCOUNT, LIST_ACCOUNTS } from '../graphQL/account';
import { GET_USER_SUBSCRIBED_CHANNELS } from '../graphQL/channel';

const EMPTY_FORM = { email: '', password: '', name: '', role: 'admin', channelIds: [] };
const PLATFORM_NAMES = { fb: 'Facebook', ig: 'Instagram', whatsapp: 'WhatsApp', line: 'LINE', wechat: 'WeChat' };
const MIN_PASSWORD_LENGTH = 6;

export default function UserForm({ mode }) {
  const router = useRouter();
  const userInfo = useSelector(selectUserInfo);
  const companyId = userInfo?.company_id;
  const editingId = mode === 'edit' && typeof router.query.id === 'string' ? router.query.id : null;
  const { alerts, pushAlert, dismissAlert } = useAlerts();
  const [form, setForm] = useState(EMPTY_FORM);
  // Kept as-is so saving the form doesn't wipe fields it doesn't show, like the avatar.
  const [savedInfo, setSavedInfo] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadState, setLoadState] = useState(mode === 'edit' ? 'loading' : 'ready');
  // The company's channels: an admin sees them all.
  const [channels, setChannels] = useState(null);

  useEffect(() => {
    let active = true;
    apolloApiHelpers('query', GET_USER_SUBSCRIBED_CHANNELS, undefined, { fetchPolicy: 'no-cache' }).then((result) => {
      if (active) setChannels(Array.isArray(result) ? result : []);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editingId || !companyId) return undefined;
    let active = true;
    apolloApiHelpers('query', LIST_ACCOUNTS, { input: { company_id: companyId } }, { fetchPolicy: 'no-cache' }).then((result) => {
      if (!active) return;
      const account = result?.error ? null : result?.items?.find((item) => item._id === editingId);
      if (!account) return setLoadState(result?.error ? 'error' : 'missing');
      const { __typename, ...info } = account.info || {};
      setSavedInfo(info);
      setForm({ ...EMPTY_FORM, email: account.email || '', name: info.name || '', role: account.role || 'user', channelIds: account.channel_ids || [] });
      setLoadState('ready');
    });
    return () => { active = false; };
  }, [companyId, editingId]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = '請輸入有效的電子信箱';
    if (!form.name.trim()) next.name = '請輸入使用者名稱';
    if (!editingId && form.password.length < MIN_PASSWORD_LENGTH) next.password = `密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (saving || !companyId || !validate()) return;
    setSaving(true);
    const input = { email: form.email.trim(), role: form.role, user_info: JSON.stringify({ ...savedInfo, name: form.name.trim() }) };
    // Admins work in every channel, so only a user's channels are saved.
    if (form.role === 'user') input.channel_ids = form.channelIds;
    if (!editingId) input.password = form.password;
    const result = await apolloApiHelpers('mutation', editingId ? UPDATE_ACCOUNT : CREATE_ACCOUNT, editingId ? { _id: editingId, input } : { company_id: companyId, input });
    if (result?.error) {
      setSaving(false);
      return pushAlert('error', `無法儲存使用者：${result.error}`);
    }
    router.push('/user-management');
  };

  if (loadState === 'loading') return <div className='flex justify-center pt-[96px]'><Loading /></div>;
  if (loadState !== 'ready') {
    return (
      <div className='flex flex-col items-center gap-[16px] pt-[96px] text-grayscale'>
        <p className='m-0'>{loadState === 'missing' ? '找不到這位使用者，可能已被刪除。' : '目前無法讀取使用者，請稍後再試。'}</p>
        <Button title='返回列表' color='grayscale' onClick={() => router.push('/user-management')} />
      </div>
    );
  }

  const isSelf = editingId && editingId === userInfo?._id;
  const toggleChannel = (channelId, checked) => setForm((previous) => ({
    ...previous,
    channelIds: checked ? [...new Set([...previous.channelIds, channelId])] : previous.channelIds.filter((id) => id !== channelId),
  }));
  return (
    <div className='flex justify-center'>
      <Card rounded customStyles='user-form'>
        <form onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
          <div className='user-form-head'>
            <h2 className='user-form-title'>基本資料</h2>
            <div className='flex gap-[8px]'>
              <Button title='返回' color='grayscale' disabled={saving} onClick={() => router.push('/user-management')} />
              <Button title={saving ? '儲存中…' : '儲存'} disabled={saving} onClick={submit} />
            </div>
          </div>

          <Input title='電子信箱' name='email' type='email' placeholder='使用者的電子信箱（登入帳號）' value={form.email} onChange={update} errorText={errors.email || ''} minHeight='large' />
          {!editingId && <Input title='密碼' name='password' type='password' placeholder={`至少 ${MIN_PASSWORD_LENGTH} 個字元`} value={form.password} onChange={update} errorText={errors.password || ''} minHeight='large' />}

          <div className='user-form-row'>
            <div className='flex-1 min-w-0'>
              <Input title='使用者名稱' name='name' placeholder='使用者名稱' value={form.name} onChange={update} errorText={errors.name || ''} minHeight='none' />
              <p className='user-form-hint'>此名稱將顯示給 MasterBox 的其他成員，與您互動的客戶不會看到此名稱</p>
            </div>
            <label className='flex-1 min-w-0 user-form-select'>
              <span>角色</span>
              <select name='role' value={form.role} onChange={update} disabled={Boolean(isSelf)} title={isSelf ? '不能變更自己的角色' : undefined}>
                <option value='admin'>管理者</option>
                <option value='user'>使用者</option>
              </select>
            </label>
          </div>
          <fieldset className='user-form-channels'>
            <legend>可處理的頻道</legend>
            {form.role === 'admin' ? (
              <p className='user-form-hint'>管理者可以看到並回覆所有頻道的對話。</p>
            ) : channels === null ? (
              <p className='user-form-hint'>正在讀取頻道…</p>
            ) : channels.length === 0 ? (
              <p className='user-form-hint'>公司還沒有串接任何頻道。到「社群平台管理」串接後，再回來勾選。</p>
            ) : (
              <>
                <p className='user-form-hint'>使用者只會看到勾選頻道的對話，也只能被指派這些頻道的對話。</p>
                <div className='user-form-channels-list'>
                  {channels.map(({ channel_id: channelId, name, platform }) => (
                    <label key={channelId} className='user-form-channel'>
                      <input type='checkbox' checked={form.channelIds.includes(channelId)} onChange={(event) => toggleChannel(channelId, event.target.checked)} />
                      <span>{name}</span>
                      <small>{PLATFORM_NAMES[platform] || platform}</small>
                    </label>
                  ))}
                </div>
                {!form.channelIds.length && <p className='user-form-warning'>沒有勾選任何頻道時，這位使用者看不到任何對話。</p>}
              </>
            )}
          </fieldset>
          {/* Lets Enter submit the form; the visible save button is a div. */}
          <button type='submit' className='hidden' aria-hidden='true' tabIndex={-1} />
        </form>
      </Card>
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  );
}
