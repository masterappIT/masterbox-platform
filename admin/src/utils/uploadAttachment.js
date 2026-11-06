import { apiBaseUri, getAccessToken, refreshSession } from '../graphQL';

class UploadError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// XMLHttpRequest rather than fetch, because only it reports how much of the file has been sent.
const send = (file, platform, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${apiBaseUri}/api/uploads?platform=${encodeURIComponent(platform || '')}`);
  const token = getAccessToken();
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
  xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || ''));
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
  };
  xhr.onload = () => {
    let body = null;
    try { body = JSON.parse(xhr.responseText); } catch (error) { }
    if (xhr.status === 201 && body?.url) {
      onProgress?.(100);
      resolve(body);
    } else {
      reject(new UploadError(body?.error || `上傳失敗（${xhr.status}）`, xhr.status));
    }
  };
  xhr.onerror = () => reject(new UploadError('上傳失敗，請檢查網路連線後重試', 0));
  xhr.send(file);
});

/**
 * Uploads a file the agent is about to send.
 * @param {File} file
 * @param {string} platform - fb, ig or whatsapp; the server applies that platform's limits
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<{ url, filename, mime_type, size, kind }>}
 */
export const uploadAttachment = async (file, platform, onProgress) => {
  try {
    return await send(file, platform, onProgress);
  } catch (error) {
    if (error.status !== 401) throw error;
    // The login expired while the agent was typing; renew it once and try again.
    await refreshSession().catch(() => { throw new UploadError('登入已失效，請重新登入', 401); });
    return send(file, platform, onProgress);
  }
};

// How an uploaded file appears in a message's contents.
export const toMessageAttachment = ({ url, filename, mime_type, size, kind }) => ({
  type: kind, payload: { url }, filename, mime_type, size,
});
