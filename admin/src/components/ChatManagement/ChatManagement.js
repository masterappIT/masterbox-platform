import React, { useEffect, useMemo, useState } from 'react';
import { gql, NetworkStatus, useMutation, useQuery } from '@apollo/client';

const ROOMS_QUERY = gql`query ChatManagementRooms { chatRooms { id title platform channel_id lastMessage updatedAt } }`;
const MESSAGES_QUERY = gql`query ChatManagementMessages($roomId: ID) { messages(roomId: $roomId) { _id contents platform channel_id to_chat_room_id isMine sentAt } }`;
const SEND_MESSAGE = gql`mutation ChatManagementSendMessage($messageInput: MessageInput) { appSendMessage(MessageInput: $messageInput) { _id contents platform channel_id to_chat_room_id sentAt } }`;

const getName = (user) => `${user?.first_name || ''}${user?.last_name || ''}`.trim() || '未命名客戶';
const messageText = (contents) => {
  try {
    const parsed = typeof contents === 'string' ? JSON.parse(contents) : contents;
    return parsed?.text?.body || parsed?.text || parsed?.message || '';
  } catch (error) {
    return contents || '';
  }
};

export default function ChatManagement() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const roomsQuery = useQuery(ROOMS_QUERY, {
    variables: {},
    pollInterval: 15000,
    notifyOnNetworkStatusChange: true,
  });
  const rooms = useMemo(() => roomsQuery.data?.chatRooms || [], [roomsQuery.data]);

  useEffect(() => {
    setSelectedRoom((current) => rooms.find((room) => room.id === current?.id) || rooms[0] || null);
  }, [rooms]);

  const messagesQuery = useQuery(MESSAGES_QUERY, {
    skip: !selectedRoom,
    variables: { roomId: selectedRoom?.title || selectedRoom?.id },
    pollInterval: 5000,
    notifyOnNetworkStatusChange: true,
    onCompleted: () => setLastUpdated(new Date()),
  });
  const serverMessages = useMemo(() => messagesQuery.data?.messages || [], [messagesQuery.data]);
  const messages = useMemo(
    () => [...serverMessages, ...localMessages.filter((item) => item.roomId === selectedRoom?.id)],
    [serverMessages, localMessages, selectedRoom],
  );
  const [sendMessage, sendState] = useMutation(SEND_MESSAGE);
  const customer = null;
  const isRefreshing = messagesQuery.networkStatus === NetworkStatus.refetch || messagesQuery.networkStatus === NetworkStatus.poll;

  const refreshConversation = async () => {
    if (!selectedRoom || isRefreshing) return;
    await Promise.all([messagesQuery.refetch(), roomsQuery.refetch()]);
  };

  const submit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedRoom || sendState.loading) return;
    const optimisticId = `local-${Date.now()}`;
    const input = {
      to_chat_room_id: selectedRoom.id,
      platform: selectedRoom.platform,
      channel_id: selectedRoom.channel_id,
      contents: text,
    };
    setDraft('');
    setLocalMessages((items) => [...items, {
      _id: optimisticId,
      roomId: selectedRoom.id,
      sender: selectedRoom.channel_id,
      contents: text,
      sentAt: new Date().toISOString(),
    }]);
    try {
      await sendMessage({ variables: { messageInput: input } });
      await messagesQuery.refetch();
      setLocalMessages((items) => items.filter((item) => item._id !== optimisticId));
    } catch (error) {
      setLocalMessages((items) => items.filter((item) => item._id !== optimisticId));
      setDraft(text);
    }
  };

  if (roomsQuery.loading && !rooms.length) return <section className="chat-management-state"><strong>載入對話管理</strong><span>正在取得對話…</span></section>;
  if (roomsQuery.error) return <section className="chat-management-state chat-management-state-error"><strong>無法載入對話</strong><span>{roomsQuery.error.message}</span><button type="button" onClick={() => roomsQuery.refetch()}>重試</button></section>;

  return (
    <main className="chat-management">
      <header className="chat-management-header">
        <div><p className="chat-management-eyebrow">MASTERBOX</p><h1>Chat Box</h1><span>集中管理各社群頻道的客戶訊息</span></div>
        <span className="chat-management-count">{rooms.length} 個對話</span>
      </header>
      <div className="chat-management-grid">
        <aside className="chat-management-sidebar">
          <label htmlFor="channel-select">對話</label>
          <div className="chat-management-list">
            {rooms.length ? rooms.map((room) => (
              <button type="button" className={`chat-management-room ${selectedRoom?.id === room.id ? 'is-selected' : ''}`} key={room.id} onClick={() => { setSelectedRoom(room); setLocalMessages([]); }}>
                <span className="chat-management-avatar">{getName({ first_name: room.title }).slice(0, 1)}</span>
                <span><strong>{room.title || '未命名對話'}</strong><small>{room.platform} · {room.id}</small></span>
              </button>
            )) : <p className="chat-management-muted">目前沒有對話。</p>}
          </div>
        </aside>
        <section className="chat-management-conversation">
          {selectedRoom ? <>
            <div className="chat-management-conversation-header">
              <div><h2>{selectedRoom.title || '未命名對話'}</h2><span>{selectedRoom.platform} · {selectedRoom.id}</span></div>
              <div className="chat-management-actions">
                <button type="button" className="chat-management-icon-action" disabled title="語音通話即將推出" aria-label="語音通話即將推出">☎</button>
                <button type="button" className="chat-management-icon-action" disabled title="視訊通話即將推出" aria-label="視訊通話即將推出">▣</button>
                <button type="button" className="chat-management-refresh" onClick={refreshConversation} disabled={isRefreshing}>{isRefreshing ? '更新中…' : '重新整理'}</button>
                <span className="chat-management-status">● 已連線</span>
              </div>
            </div>
            <div className="chat-management-security" aria-label="對話安全設定">
              <span><strong>加密</strong><small>傳輸層加密</small></span>
              <span><strong>消失訊息</strong><small>未啟用</small></span>
              <span className="chat-management-sync"><strong>自動更新</strong><small>{lastUpdated ? `最近 ${lastUpdated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : '每 5 秒'}</small></span>
            </div>
            <div className="chat-management-messages">
              {messagesQuery.loading && !messages.length ? <p className="chat-management-muted">載入訊息中…</p> : messagesQuery.error ? <p className="chat-management-error">無法載入訊息。請重試。</p> : messages.length ? messages.map((message) => {
                const mine = message.isMine;
                return <div className={`chat-management-message ${mine ? 'is-mine' : ''}`} key={message._id || `${message.sentAt}-${message.sender}`}><p>{messageText(message.contents)}</p><time>{message.sentAt ? new Date(message.sentAt).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''}</time></div>;
              }) : <p className="chat-management-muted">尚未有訊息，開始一段對話吧。</p>}
            </div>
            <form className="chat-management-compose" onSubmit={submit}><input aria-label="訊息內容" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="輸入訊息…" disabled={sendState.loading} /><button type="submit" disabled={!draft.trim() || sendState.loading}>{sendState.loading ? '傳送中…' : '發送'}</button></form>
            {sendState.error && <p className="chat-management-error chat-management-send-error">訊息傳送失敗：{sendState.error.message}</p>}
          </> : <div className="chat-management-empty"><h2>選擇一個對話</h2><p>從左側選擇客戶，即可查看訊息並回覆。</p></div>}
        </section>
      </div>
    </main>
  );
}
