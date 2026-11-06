import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Popup from '../../stories/components/Popup';
import Button from '../../stories/components/Button';
import { apolloApiHelpers } from '../../graphQL';
import {
  CONNECT_WHATSAPP_WEB, WHATSAPP_WEB_CONNECTION, REQUEST_WHATSAPP_WEB_PAIRING_CODE,
  CANCEL_WHATSAPP_WEB, UPDATE_WHATSAPP_WEB_CHANNEL, CHAT_ROOM_ASSIGNEES,
} from '../../graphQL/channel';

// WhatsApp offers a new QR code about every 20 seconds; asking more often keeps the shown one current.
const POLL_MS = 2500;
const WAITING = ['starting', 'qr', 'authenticated'];
const FAILED = ['logged_out', 'qr_timeout', 'rejected', 'failed', 'offline'];

const STEPS = [
  '在手機上開啟 WhatsApp',
  '點選「設定」→「已連結的裝置」→「連結裝置」',
  '將手機對準右側的 QR 碼掃描',
];

function Progress({ connection }) {
  const progress = connection.progress || { chats_total: 0, chats_done: 0, messages: 0 };
  const percent = progress.chats_total ? Math.round((progress.chats_done / progress.chats_total) * 100) : 0;
  const done = connection.state === 'ready';
  return (
    <ol className='wa-connect-progress'>
      <li className='is-done'><span>連結裝置</span></li>
      <li className={done || progress.chats_total ? 'is-done' : 'is-active'}>
        <span>讀取聊天列表</span>
        {progress.chats_total > 0 && <em>{progress.chats_total} 個對話</em>}
      </li>
      <li className={done ? 'is-done' : 'is-active'}>
        <span>同步聊天記錄（最近一年）</span>
        {!done && <em>{percent}%</em>}
        {!done && <div className='wa-connect-bar' role='progressbar' aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>}
      </li>
      <li className={done ? 'is-done' : ''}><span>開始接收新訊息</span>{!done && <em>等待中</em>}</li>
    </ol>
  );
}

Progress.propTypes = { connection: PropTypes.object.isRequired };

/**
 * Connects a WhatsApp number by scanning a QR code with the phone: a new channel, or scanning again for `channel`.
 * Steps: QR code → copying chats → naming the channel and choosing its agents.
 */
function WhatsappWebConnect({ isShow, channel, onClose, onDone, pushAlert }) {
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState(null);
  const [pairing, setPairing] = useState({ open: false, phone: '', code: null, loading: false });
  const [form, setForm] = useState({ name: '', agentIds: [], saving: false });
  const [agents, setAgents] = useState([]);
  const channelId = connection?.channel_id || channel?.channel_id || null;
  const named = useRef(false);
  const reconnecting = Boolean(channel);

  const start = useCallback(async () => {
    setError(null);
    setConnection(null);
    setPairing({ open: false, phone: '', code: null, loading: false });
    const res = await apolloApiHelpers('mutation', CONNECT_WHATSAPP_WEB, { channelId: channel?.channel_id || null });
    if (res.error) return setError(res.error);
    setConnection(res);
  }, [channel]);

  // A new attempt each time the dialog opens.
  useEffect(() => {
    if (!isShow) return;
    named.current = false;
    setForm({ name: channel?.name || '', agentIds: [], saving: false });
    start();
  }, [isShow, channel, start]);

  // Asks until the number is fully synced, or the attempt failed and needs a new code.
  const polling = Boolean(isShow && channelId && connection && !FAILED.includes(connection.state) && connection.state !== 'ready');
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(async () => {
      const res = await apolloApiHelpers('query', WHATSAPP_WEB_CONNECTION, { channelId }, { fetchPolicy: 'no-cache' });
      if (!res.error) setConnection(res);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, channelId]);

  // Once a phone connects, suggest its WhatsApp name and load who could work in the channel.
  useEffect(() => {
    if (!connection || reconnecting || named.current || !['syncing', 'ready'].includes(connection.state)) return;
    named.current = true;
    setForm((current) => ({ ...current, name: current.name || connection.name || connection.phone || '' }));
    apolloApiHelpers('query', CHAT_ROOM_ASSIGNEES, {}, { fetchPolicy: 'no-cache' }).then((res) => { if (Array.isArray(res)) setAgents(res); });
  }, [connection, reconnecting]);

  const close = async () => {
    // Leaving before any phone scanned removes the new channel, so the list doesn't fill with empty ones.
    if (!reconnecting && channelId && (!connection || WAITING.includes(connection.state) || FAILED.includes(connection.state))) {
      await apolloApiHelpers('mutation', CANCEL_WHATSAPP_WEB, { channelId });
    }
    onClose(Boolean(channelId && connection && !WAITING.includes(connection.state)));
  };

  const requestCode = async () => {
    setPairing((current) => ({ ...current, loading: true, code: null }));
    const res = await apolloApiHelpers('mutation', REQUEST_WHATSAPP_WEB_PAIRING_CODE, { channelId, phone: pairing.phone });
    if (res?.error) {
      setPairing((current) => ({ ...current, loading: false }));
      return pushAlert('error', `無法取得配對碼：${res.error}`);
    }
    setPairing((current) => ({ ...current, loading: false, code: res }));
  };

  const finish = async () => {
    if (reconnecting) return onDone();
    if (!form.name.trim()) return pushAlert('error', '請輸入社群名稱');
    setForm((current) => ({ ...current, saving: true }));
    const res = await apolloApiHelpers('mutation', UPDATE_WHATSAPP_WEB_CHANNEL, { channelId, name: form.name.trim(), agentIds: form.agentIds });
    setForm((current) => ({ ...current, saving: false }));
    if (res.error) return pushAlert('error', `無法儲存：${res.error}`);
    onDone(res.name);
  };

  const state = connection?.state;
  const title = reconnecting ? `重新連結「${channel.name}」` : '連結 WhatsApp';
  let body;

  if (error) {
    body = (
      <div className='wa-connect-center'>
        <p className='wa-connect-error'>{error}</p>
        <Button title='再試一次' variant='contained' color='primary' rounded='small' onClick={start} />
      </div>
    );
  } else if (!connection || state === 'starting' || state === 'authenticated') {
    body = <div className='wa-connect-center'><div className='wa-connect-spinner' aria-hidden='true' /><p>{state === 'authenticated' ? '已掃描，正在登入…' : '正在產生 QR 碼…'}</p></div>;
  } else if (state === 'qr') {
    body = (
      <div className='wa-connect-scan'>
        <div className='wa-connect-steps'>
          <ol>{STEPS.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className='wa-connect-note'>
            <strong>請注意</strong>
            <span>手機需保持連網；超過 14 天未開啟 WhatsApp，連結會自動失效。</span>
            {reconnecting && channel.whatsapp_web?.phone && <span>只能用原本的號碼 {channel.whatsapp_web.phone} 掃描。</span>}
            <span>群組對話不會同步。</span>
          </div>
          {!pairing.open
            ? <button type='button' className='wa-connect-link' onClick={() => setPairing((current) => ({ ...current, open: true }))}>改用電話號碼連結</button>
            : (
              <div className='wa-connect-pairing'>
                <label htmlFor='wa-pairing-phone'>含國碼的電話號碼</label>
                <div>
                  <input id='wa-pairing-phone' type='tel' placeholder='例：886912345678' value={pairing.phone} onChange={(event) => setPairing((current) => ({ ...current, phone: event.target.value }))} />
                  <Button title={pairing.loading ? '取得中…' : '取得配對碼'} variant='outlined' color='primary' rounded='small' disabled={pairing.loading || !pairing.phone.trim()} onClick={requestCode} />
                </div>
                {pairing.code && <p>在手機「已連結的裝置」→「改用電話號碼連結」輸入：<strong className='wa-connect-code'>{pairing.code}</strong></p>}
              </div>
            )}
        </div>
        <div className='wa-connect-qr'>
          {connection.qr ? <img src={connection.qr} alt='WhatsApp 連結用 QR 碼' width={240} height={240} /> : <div className='wa-connect-spinner' aria-hidden='true' />}
          <p className='wa-connect-waiting'>等待掃描…</p>
          <p className='wa-connect-hint'>QR 碼會自動更新</p>
        </div>
      </div>
    );
  } else if (FAILED.includes(state)) {
    body = (
      <div className='wa-connect-center'>
        <p className='wa-connect-error'>{connection.error || (state === 'qr_timeout' ? 'QR 碼已過期' : '連結失敗')}</p>
        <Button title='重新產生 QR 碼' variant='contained' color='primary' rounded='small' onClick={start} />
      </div>
    );
  } else {
    const ready = state === 'ready';
    body = (
      <div className='wa-connect-done'>
        <div className='wa-connect-account'>
          <img src='/design/ui/platform-whatsapp.svg' alt='' width={40} height={40} />
          <div><strong>{connection.name || 'WhatsApp'}</strong><span>{connection.phone}</span></div>
          <span className='wa-connect-badge'>{ready ? '已連結' : '同步中'}</span>
        </div>
        <Progress connection={connection} />
        {!reconnecting && (
          <div className='wa-connect-form'>
            <label htmlFor='wa-channel-name'>社群名稱</label>
            <input id='wa-channel-name' value={form.name} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            {agents.length > 0 && (
              <fieldset>
                <legend>指定專員</legend>
                <div className='wa-connect-agents'>
                  {agents.filter(({ role }) => role !== 'admin').map((agent) => (
                    <label key={agent.id}>
                      <input
                        type='checkbox'
                        checked={form.agentIds.includes(agent.id)}
                        onChange={(event) => setForm((current) => ({ ...current, agentIds: event.target.checked ? [...current.agentIds, agent.id] : current.agentIds.filter((id) => id !== agent.id) }))}
                      />
                      {agent.name}
                    </label>
                  ))}
                </div>
                <p className='wa-connect-hint'>管理員可以看到所有頻道，不需要指定。</p>
              </fieldset>
            )}
          </div>
        )}
        <div className='wa-connect-actions'>
          {!ready && <span className='wa-connect-hint'>聊天記錄會在背景繼續同步</span>}
          <Button title={form.saving ? '儲存中…' : '完成'} variant='contained' color='primary' rounded='small' disabled={form.saving} onClick={finish} />
        </div>
      </div>
    );
  }

  return (
    <Popup isShow={isShow} onClick={close} size='fit' label={title}>
      <div className='wa-connect'>
        <h2 className='wa-connect-title'>{title}</h2>
        {body}
      </div>
    </Popup>
  );
}

WhatsappWebConnect.propTypes = {
  isShow: PropTypes.bool,
  // Scanning again for an existing channel; null connects a new number.
  channel: PropTypes.shape({ channel_id: PropTypes.string, name: PropTypes.string, whatsapp_web: PropTypes.object }),
  // Called with true when a phone connected, so the list should reload.
  onClose: PropTypes.func.isRequired,
  onDone: PropTypes.func.isRequired,
  pushAlert: PropTypes.func.isRequired,
};

WhatsappWebConnect.defaultProps = {
  isShow: false,
  channel: null,
};

export default WhatsappWebConnect;
