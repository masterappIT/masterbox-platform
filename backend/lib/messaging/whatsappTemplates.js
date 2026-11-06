// WhatsApp message templates as Meta returns them, turned into what an agent fills in, and back into the message Meta sends.
// No database or network here, so it is easy to test.

// {{1}} for positional templates, {{first_name}} for named ones.
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const MEDIA_HEADERS = { IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' };
const MEDIA_LABELS = { image: '圖片', video: '影片', document: '文件' };

// Meta rejects a text parameter with a line break, a tab or more than four spaces in a row (error 132018).
const TEXT_PARAM_MAX = 1024;
const HEADER_TEXT_MAX = 60;
const COUPON_MAX = 15;

const placeholders = (text) => {
  const names = [];
  for (const [, name] of String(text || '').matchAll(PLACEHOLDER)) if (!names.includes(name)) names.push(name);
  return names;
};

// Meta's example values: body_text is a list of lists, header_text a list, the named forms a list of { param_name, example }.
const exampleOf = (component, name, index) => {
  const example = component?.example || {};
  const named = [...(example.body_text_named_params || []), ...(example.header_text_named_params || [])].find(param => param?.param_name === name);
  if (named) return String(named.example ?? '');
  const positional = Array.isArray(example.body_text?.[0]) ? example.body_text[0] : example.header_text;
  const value = Array.isArray(positional) ? positional[index] : undefined;
  return value == null ? null : String(value);
};

const isPositional = name => /^\d+$/.test(name);

const unsupportedButton = {
  FLOW: '含有 WhatsApp Flow 按鈕',
  OTP: '是驗證碼範本，需由系統產生驗證碼',
  CATALOG: '含有商品目錄按鈕',
  MPM: '含有多商品按鈕',
  SPM: '含有單一商品按鈕',
  VOICE_CALL: '含有 WhatsApp 通話按鈕',
  ORDER_DETAILS: '含有訂單付款按鈕',
};

/**
 * What the admin shows of an approved template, with every value the agent has to fill in.
 * @param {object} template - from GET /{waba-id}/message_templates
 */
export const templateView = (template) => {
  const components = Array.isArray(template?.components) ? template.components : [];
  const find = type => components.find(component => String(component?.type).toUpperCase() === type);
  const header = find('HEADER');
  const body = find('BODY');
  const footer = find('FOOTER');
  const buttons = find('BUTTONS')?.buttons || [];
  const reasons = [];
  const variables = [];

  const headerFormat = header ? String(header.format || 'TEXT').toUpperCase() : null;
  if (headerFormat === 'TEXT') {
    placeholders(header.text).forEach((name, index) => variables.push({ key: `header:${name}`, component: 'header', name, label: `標題 {{${name}}}`, example: exampleOf(header, name, index) }));
  } else if (MEDIA_HEADERS[headerFormat]) {
    variables.push({ key: 'header:media', component: 'header_media', name: MEDIA_HEADERS[headerFormat], label: `標題${MEDIA_LABELS[MEDIA_HEADERS[headerFormat]]}`, example: null });
  } else if (headerFormat) {
    reasons.push(headerFormat === 'LOCATION' ? '標題是地點' : `標題格式 ${headerFormat} 不支援`);
  }

  placeholders(body?.text).forEach((name, index) => variables.push({ key: `body:${name}`, component: 'body', name, label: `內文 {{${name}}}`, example: exampleOf(body, name, index) }));

  const buttonViews = buttons.map((button, index) => {
    const type = String(button?.type || '').toUpperCase();
    if (unsupportedButton[type]) reasons.push(unsupportedButton[type]);
    if (type === 'URL') {
      placeholders(button.url).forEach(name => variables.push({ key: `button:${index}:${name}`, component: 'button', name, label: `按鈕「${button.text || index + 1}」網址 {{${name}}}`, example: Array.isArray(button.example) ? String(button.example[0] ?? '') : null }));
    }
    if (type === 'COPY_CODE') {
      variables.push({ key: `coupon:${index}`, component: 'coupon', name: String(index), label: '優惠碼', example: typeof button.example === 'string' ? button.example : Array.isArray(button.example) ? String(button.example[0] ?? '') : null });
    }
    return { type, text: button?.text || null, url: button?.url || null, phone_number: button?.phone_number || null };
  });

  if (components.some(component => ['CAROUSEL', 'LIMITED_TIME_OFFER'].includes(String(component?.type).toUpperCase()))) reasons.push('含有輪播或限時優惠');
  if (String(template?.category).toUpperCase() === 'AUTHENTICATION' && !reasons.some(reason => reason.includes('驗證碼'))) reasons.push('是驗證碼範本，需由系統產生驗證碼');
  if (!body) reasons.push('沒有內文');

  return {
    id: String(template?.id || ''),
    name: String(template?.name || ''),
    language: String(template?.language || ''),
    category: template?.category ? String(template.category) : null,
    header_format: headerFormat,
    header_text: headerFormat === 'TEXT' ? header.text || '' : null,
    body_text: body?.text || '',
    footer_text: footer?.text || null,
    buttons: buttonViews,
    variables,
    supported: reasons.length === 0,
    unsupported_reason: reasons.length ? `這個範本${[...new Set(reasons)].join('、')}，目前無法在聊天室發送，請到 WhatsApp 管理工具發送` : null,
  };
};

const fill = (text, values, component) => String(text || '').replace(PLACEHOLDER, (match, name) => values.get(`${component}:${name}`) ?? match);

const checkText = (label, value, max = TEXT_PARAM_MAX) => {
  if (!value.trim()) return `請填寫「${label}」`;
  if (/[\n\t]/.test(value)) return `「${label}」不能換行或使用 Tab`;
  if (/ {5,}/.test(value)) return `「${label}」不能有連續 5 個以上的空格`;
  if ([...value].length > max) return `「${label}」最多 ${max} 個字`;
  return null;
};

/**
 * The template message Meta sends, and the text kept in the conversation.
 * @param view - from templateView
 * @param {{ key: string, value: string }[]} values - what the agent filled in, by variable key
 * @param {{ to: string, headerMedia?: { url: string, filename?: string, kind: string, mimeType?: string } }} options - headerMedia is the stored file for a media header
 * @returns {{ payload: object, text: string, error?: undefined } | { error: string }}
 */
export const templateMessage = (view, values, { to, headerMedia } = {}) => {
  if (!view.supported) return { error: view.unsupported_reason };
  const given = new Map((values || []).filter(entry => entry && typeof entry.key === 'string').map(({ key, value }) => [key, typeof value === 'string' ? value : '']));
  const param = (variable, value) => ({ type: 'text', text: value, ...(isPositional(variable.name) ? {} : { parameter_name: variable.name }) });

  const components = [];
  const headerParams = [];
  const bodyParams = [];
  const buttonParams = new Map();

  for (const variable of view.variables) {
    if (variable.component === 'header_media') {
      if (!headerMedia?.url) return { error: `請上傳${variable.label}` };
      const expected = variable.name === 'document' ? 'file' : variable.name;
      if (headerMedia.kind !== expected) return { error: `${variable.label}需要${MEDIA_LABELS[variable.name]}檔案` };
      if (variable.name === 'document' && headerMedia.mimeType && headerMedia.mimeType !== 'application/pdf') return { error: 'WhatsApp 範本的標題文件只能是 PDF' };
      headerParams.push({ type: variable.name, [variable.name]: { link: headerMedia.url, ...(variable.name === 'document' && headerMedia.filename ? { filename: headerMedia.filename } : {}) } });
      continue;
    }
    const value = given.get(variable.key) ?? '';
    if (variable.component === 'coupon') {
      if (!value.trim()) return { error: '請填寫「優惠碼」' };
      if (!/^[A-Za-z0-9]+$/.test(value) || value.length > COUPON_MAX) return { error: `優惠碼只能是英文字母或數字，最多 ${COUPON_MAX} 個字` };
      buttonParams.set(variable.key, { type: 'button', sub_type: 'copy_code', index: variable.key.split(':')[1], parameters: [{ type: 'coupon_code', coupon_code: value }] });
      continue;
    }
    const problem = variable.component === 'button' && /\s/.test(value) ? `「${variable.label}」不能有空格` : checkText(variable.label, value);
    if (problem) return { error: problem };
    if (variable.component === 'header') headerParams.push(param(variable, value));
    if (variable.component === 'body') bodyParams.push(param(variable, value));
    if (variable.component === 'button') {
      const index = variable.key.split(':')[1];
      const key = `button:${index}`;
      const button = buttonParams.get(key) || { type: 'button', sub_type: 'url', index, parameters: [] };
      button.parameters.push(param(variable, value));
      buttonParams.set(key, button);
    }
  }

  const headerText = view.header_format === 'TEXT' ? fill(view.header_text, given, 'header') : null;
  if (headerText && [...headerText].length > HEADER_TEXT_MAX) return { error: `標題填入後最多 ${HEADER_TEXT_MAX} 個字` };

  if (headerParams.length) components.push({ type: 'header', parameters: headerParams });
  if (bodyParams.length) components.push({ type: 'body', parameters: bodyParams });
  components.push(...[...buttonParams.values()].sort((a, b) => Number(a.index) - Number(b.index)));

  const text = [headerText, fill(view.body_text, given, 'body'), view.footer_text].filter(Boolean).join('\n\n');
  return {
    text,
    payload: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: { name: view.name, language: { code: view.language }, ...(components.length ? { components } : {}) },
    },
  };
};
