const DEFAULTS = {
  exchangePath: '/api/embed/exchange',
  messagesPath: '/api/embed/messages',
  wsPath: '/api/embed/socket',
  tokenRefreshSkewMs: 30_000,
  reconnect: true,
  reconnectBaseDelayMs: 500,
  reconnectMaxDelayMs: 10_000,
};

const hasScope = (token, required) => {
  const scopes = token?.scopes;
  return !scopes || scopes.includes('embed') || scopes.includes(required);
};

/** Browser-only client. Supply only an ephemeral embed token or provider. */
export class MasterBoxChat {
  constructor({ baseUrl = '', token, tokenProvider, conversationId, fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket, ...options } = {}) {
    if (!conversationId) throw new Error('conversationId is required');
    if (!token && !tokenProvider) throw new Error('tokenProvider or short-lived token is required');
    if (typeof fetchImpl !== 'function') throw new Error('fetch is not available in this environment');
    this.baseUrl = baseUrl.replace(/\/$/, ''); this.conversationId = conversationId;
    this.fetch = fetchImpl; this.WebSocket = WebSocketImpl; this.options = { ...DEFAULTS, ...options };
    this.token = typeof token === 'string' ? { accessToken: token } : token; this.tokenProvider = tokenProvider;
    this.socket = null; this.listeners = new Map(); this.reconnectTimer = null; this.reconnectAttempt = 0; this.manualDisconnect = false;
  }
  on(event, handler) { if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(handler); return () => this.listeners.get(event)?.delete(handler); }
  emit(event, payload) { this.listeners.get(event)?.forEach((handler) => { try { handler(payload); } catch (error) { this.listeners.get('error')?.forEach((h) => h(error)); } }); }
  async getToken(force = false) {
    const expiresAt = this.token?.expiresAt ? new Date(this.token.expiresAt).getTime() : Infinity;
    if (!force && this.token?.accessToken && expiresAt - Date.now() > this.options.tokenRefreshSkewMs) return this.token;
    if (!this.tokenProvider) { if (this.token?.accessToken && expiresAt > Date.now()) return this.token; throw new Error('Short-lived embed token is missing or expired'); }
    const result = await this.tokenProvider(); this.token = typeof result === 'string' ? { accessToken: result } : result;
    if (!this.token?.accessToken) throw new Error('Token provider returned no accessToken'); return this.token;
  }
  async request(path, init = {}, requiredScope) {
    if (requiredScope && !hasScope(this.token, requiredScope)) throw new Error(`Token lacks required scope: ${requiredScope}`);
    const send = async (force) => { const token = await this.getToken(force); const headers = new Headers(init.headers || {}); headers.set('content-type', 'application/json'); headers.set('authorization', `Bearer ${token.accessToken}`); return this.fetch(`${this.baseUrl}${path}`, { ...init, headers }); };
    let response = await send(false); if (response.status === 401 && this.tokenProvider) response = await send(true);
    if (!response.ok) { const error = new Error(`MasterBox request failed (${response.status})`); error.status = response.status; throw error; }
    return response.status === 204 ? null : response.json();
  }
  /** Exchange a one-time host-issued embed token; permanent API keys stay server-side. */
  async exchangeToken(token) {
    if (!token) throw new Error('token is required');
    const response = await this.fetch(`${this.baseUrl}${this.options.exchangePath}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
    const result = await response.json();
    if (!result.accessToken) throw new Error('Token exchange response contained no browser accessToken');
    if (result.conversationId && result.conversationId !== this.conversationId) throw new Error('Token is not scoped to this conversation');
    if (result.scopes && !hasScope(result, 'embed')) throw new Error('Token lacks embed scope');
    this.token = result;
    return result;
  }
  listMessages({ cursor, limit } = {}) { const query = new URLSearchParams({ conversationId: this.conversationId }); if (cursor) query.set('cursor', cursor); if (limit) query.set('limit', String(limit)); return this.request(`${this.options.messagesPath}?${query}`, {}, 'messages:read'); }
  sendMessage(text, { ttlSeconds, metadata } = {}) { if (!text?.trim()) throw new Error('Message text is required'); return this.request(this.options.messagesPath, { method: 'POST', body: JSON.stringify({ conversationId: this.conversationId, text, ...(ttlSeconds ? { ttlSeconds } : {}), ...(metadata === undefined ? {} : { metadata }) }) }, 'messages:write'); }
  connect() { if (!this.WebSocket) throw new Error('WebSocket is not available in this environment'); this.manualDisconnect = false; this.#openSocket(); return this; }
  async #openSocket() {
    try { const { accessToken } = await this.getToken(); if (this.manualDisconnect) return; const base = this.baseUrl || globalThis.location?.origin; if (!base) throw new Error('baseUrl is required outside a browser'); const url = new URL(this.options.wsPath, base); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('conversationId', this.conversationId); url.searchParams.set('access_token', accessToken); this.socket = new this.WebSocket(url);
      this.socket.onopen = () => { this.reconnectAttempt = 0; this.emit('open'); }; this.socket.onclose = (event) => { this.socket = null; this.emit('close', event); this.#scheduleReconnect(); }; this.socket.onerror = (event) => this.emit('error', event);
      this.socket.onmessage = ({ data }) => { try { const event = typeof data === 'string' ? JSON.parse(data) : data; if (!event?.type) throw new Error('Invalid WebSocket event'); this.emit(event.type, event); this.emit('event', event); } catch (error) { this.emit('error', error); } };
    } catch (error) { this.emit('error', error); this.#scheduleReconnect(); }
  }
  #scheduleReconnect() { if (!this.options.reconnect || this.manualDisconnect || this.reconnectTimer) return; const delay = Math.min(this.options.reconnectMaxDelayMs, this.options.reconnectBaseDelayMs * 2 ** this.reconnectAttempt++); this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.#openSocket(); }, delay); }
  disconnect() { this.manualDisconnect = true; clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.socket?.close(); this.socket = null; }
}
export const events = ['message.created', 'message.deleted', 'message.expired', 'call.started', 'call.ended'];
