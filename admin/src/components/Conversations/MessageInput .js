import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Button from "../../stories/components/Button";
import Icon from "../../stories/components/Icon";
import ContentText from "../../stories/components/ContentText";
import { useSelector } from 'react-redux';
import EmojiPicker from './EmojiPicker';
import QuickReplyPicker from './QuickReplyPicker';
import ReplyWindowNotice from './ReplyWindowNotice';
import WhatsappTemplateDialog from './WhatsappTemplateDialog';
import { replyWindowOf, canSendFreeform } from '../../utils/replyWindow';
import useNow from '../../utils/useNow';
import { selectUserInfo } from '../../redux/slices/userSlices';
import { checkAttachment, ACCEPT_ATTRIBUTE } from '../../utils/attachmentRules';
import { uploadAttachment, toMessageAttachment } from '../../utils/uploadAttachment';

// The text box grows with what is typed up to this height, then scrolls.
const MAX_INPUT_HEIGHT = 120;

const formatSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

function AttachmentPreview({ attachment, progress, isBusy, onRemove }) {
    const { file, previewUrl, kind } = attachment
    return (
        <div className='messenger-room-send-attachment'>
            {kind === 'image' && previewUrl && <img src={previewUrl} alt={file.name} className='messenger-room-send-attachment-thumb' />}
            {kind === 'video' && previewUrl && <video src={previewUrl} muted className='messenger-room-send-attachment-thumb' />}
            {!previewUrl && <div className='messenger-room-send-attachment-icon' aria-hidden='true'>{kind === 'audio' ? '🎵' : '📄'}</div>}
            <div className='messenger-room-send-attachment-info'>
                <div className='messenger-room-send-attachment-name' title={file.name}>{file.name}</div>
                <div className='messenger-room-send-attachment-meta'>
                    {formatSize(file.size)}{attachment.uploaded ? '・已上傳' : progress !== null ? `・上傳中 ${progress}%` : ''}
                </div>
                {progress !== null && !attachment.uploaded && (
                    <div className='messenger-room-send-attachment-progress' role='progressbar' aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                        <div style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
            {!isBusy && <button type='button' className='messenger-room-send-attachment-remove' aria-label='移除附件' onClick={onRemove}>✕</button>}
        </div>
    )
}

// room: the open conversation, for Meta's reply window and its WhatsApp templates.
function MessageInput({ handlePushMessage, isMobile, platform, room }) {

    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState(null);
    // 'idle' | 'uploading' | 'sending'
    const [status, setStatus] = useState('idle');
    const [progress, setProgress] = useState(null);
    const [sendError, setSendError] = useState('');
    const [pickError, setPickError] = useState('');
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    // 'button' or 'slash': typing / in an empty box opens it too, and Esc gives the / back.
    const [quickReplyOpenedBy, setQuickReplyOpenedBy] = useState(null);
    const [isTemplateOpen, setIsTemplateOpen] = useState(false);
    // The send failed because WhatsApp's 24 hours ran out while the agent was typing.
    const [needsTemplate, setNeedsTemplate] = useState(false);
    const userInfo = useSelector(selectUserInfo);
    const isAdmin = String(userInfo?.role || '').toLowerCase() === 'admin';
    const now = useNow();
    const replyState = room ? replyWindowOf(room, now) : null;
    const canWrite = !replyState || canSendFreeform(replyState);
    const isWhatsapp = platform === 'whatsapp' && Boolean(room?.id);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    // Where the cursor was, so an emoji goes there even after the text box lost focus.
    const selectionRef = useRef({ start: 0, end: 0 });
    const caretAfterRenderRef = useRef(null);
    const isBusy = status !== 'idle';

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT)}px`;
        textarea.style.overflowY = textarea.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
        if (caretAfterRenderRef.current !== null) {
            const caret = caretAfterRenderRef.current;
            caretAfterRenderRef.current = null;
            textarea.focus();
            textarea.setSelectionRange(caret, caret);
            selectionRef.current = { start: caret, end: caret };
        }
    }, [message]);

    // The preview's object URL holds the file in memory until it is released.
    useEffect(() => () => { if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl) }, [attachment?.previewUrl]);

    function rememberSelection() {
        const textarea = textareaRef.current;
        if (textarea) selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
    }

    // Puts text where the cursor was, replacing any selection, and leaves the cursor after it.
    function insertText(text) {
        if (isBusy) return;
        const textarea = textareaRef.current;
        const { start, end } = document.activeElement === textarea
            ? { start: textarea.selectionStart, end: textarea.selectionEnd }
            : selectionRef.current;
        const safeStart = Math.min(start, message.length), safeEnd = Math.min(Math.max(end, safeStart), message.length);
        caretAfterRenderRef.current = safeStart + text.length;
        setMessage(message.slice(0, safeStart) + text + message.slice(safeEnd));
    }

    const closeEmoji = useCallback(() => setIsEmojiOpen(false), []);

    const quickReplyRef = useRef(null);
    quickReplyRef.current = quickReplyOpenedBy;
    const closeQuickReply = useCallback((reason) => {
        const openedBy = quickReplyRef.current;
        setQuickReplyOpenedBy(null);
        if (reason !== 'escape') return;
        if (openedBy === 'slash') {
            caretAfterRenderRef.current = 1;
            setMessage((current) => current || '/');
        }
        textareaRef.current?.focus();
    }, []);

    function handleChange(event) {
        const { value } = event.target;
        // A / in an empty box is the shortcut for quick replies.
        if (!message && value === '/' && canWrite) {
            selectionRef.current = { start: 0, end: 0 };
            setIsEmojiOpen(false);
            setQuickReplyOpenedBy('slash');
            return;
        }
        setMessage(value);
    }

    function pickFile(file) {
        if (!file || isBusy) return;
        setSendError('');
        const check = checkAttachment(platform, { mime: file.type, filename: file.name, size: file.size });
        if (!check.ok) {
            setPickError(`無法附加「${file.name}」：${check.reason}`);
            return;
        }
        setPickError('');
        setProgress(null);
        setAttachment({ file, kind: check.kind, previewUrl: ['image', 'video'].includes(check.kind) ? URL.createObjectURL(file) : null });
    }

    function openFilePicker() {
        if (isBusy) return;
        // Explain right away instead of letting the agent pick a file that can't be sent.
        const check = checkAttachment(platform, { mime: 'application/pdf' });
        if (!check.ok && /尚未支援/.test(check.reason)) {
            setPickError(check.reason);
            return;
        }
        fileInputRef.current?.click();
    }

    function removeAttachment() {
        setAttachment(null);
        setProgress(null);
    }

    async function send() {
        if (isBusy) return;
        if (!canWrite) {
            if (isWhatsapp) setIsTemplateOpen(true);
            return;
        }
        const text = message.trim();
        if (!text && !attachment) return;
        setSendError('');
        setPickError('');
        setNeedsTemplate(false);
        setIsEmojiOpen(false);
        try {
            // A file uploaded on an earlier try is sent again without uploading it twice.
            let uploaded = attachment?.uploaded;
            if (attachment && !uploaded) {
                setStatus('uploading');
                setProgress(0);
                uploaded = await uploadAttachment(attachment.file, platform, setProgress);
                setAttachment(current => current && { ...current, uploaded });
            }
            setStatus('sending');
            await handlePushMessage({
                ...(text ? { text } : {}),
                ...(uploaded ? { attachments: [toMessageAttachment(uploaded)] } : {}),
            });
            setMessage('');
            removeAttachment();
        } catch (error) {
            // The file went out on its own and only the text failed, so only the text is left to send.
            if (error?.sentAttachment) removeAttachment();
            setNeedsTemplate(Boolean(error?.templateRequired));
            setSendError(`${error?.sentAttachment ? '' : '訊息未送出：'}${error?.message || error}`);
        } finally {
            setStatus('idle');
        }
    }

    function handleKeyDown(event) {
        // Enter while choosing Chinese characters confirms the characters, not the message (Safari reports it as keyCode 229).
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        send();
    }

    function handlePaste(event) {
        const file = event.clipboardData?.files?.[0];
        if (!file) return;
        event.preventDefault();
        pickFile(file);
    }

    const buttonTitle = !canWrite && isWhatsapp ? '使用範本' : status === 'uploading' ? `上傳中 ${progress ?? 0}%` : status === 'sending' ? '發送中…' : '發送';
    const iconSize = isMobile ? 'small' : 'medium';
    const templateButton = isWhatsapp && <button type='button' className='messenger-room-send-retry' onClick={() => setIsTemplateOpen(true)}>使用範本發送</button>;
    const placeholder = canWrite ? '寫下一些訊息吧，輸入 / 插入快速回覆'
        : replyState?.state === 'unsupported' ? '目前無法回覆這個平台的訊息' : '已超過回覆期限，請改用 WhatsApp 範本';

    return (
        <>
        {replyState && <ReplyWindowNotice window={replyState} platform={platform} now={now} action={replyState.templateRequired ? templateButton : null} />}
        {(sendError || pickError) && (
            <div className='shrink-0 flex items-center gap-[8px] px-[16px] py-[6px]'>
                <ContentText title={sendError || pickError} color='alert' customStyles='flex-1' />
                {sendError && needsTemplate && templateButton}
                {sendError && !needsTemplate && <button type='button' className='messenger-room-send-retry' onClick={send} disabled={isBusy}>重試</button>}
            </div>
        )}
        {attachment && (
            <div className='shrink-0 px-[12px] pt-[8px]'>
                <AttachmentPreview attachment={attachment} progress={progress} isBusy={isBusy} onRemove={removeAttachment} />
            </div>
        )}
        <div className={`messenger-room-send`}>
            <div className={`messenger-room-send-inputArea`}>
                <textarea
                    ref={textareaRef}
                    className={`messenger-room-send-inputArea-input`}
                    rows={1}
                    placeholder={placeholder}
                    title="Enter 送出，Shift+Enter 換行，輸入 / 插入快速回覆"
                    value={message}
                    readOnly={isBusy}
                    disabled={!canWrite}
                    aria-label='訊息'
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onSelect={rememberSelection}
                    onBlur={rememberSelection}
                    onPaste={handlePaste}
                    style={isMobile ? { backgroundColor: '#F08F36', color: 'white', fontSize: '14px', width: '90%', marginRight: '10px', borderRadius: '8px' } : { fontSize: '14px' }}
                />
                <div className="messenger-room-send-inputArea-iconArea">
                    <button type='button' data-emoji-toggle aria-label='插入表情' aria-expanded={isEmojiOpen} className='messenger-room-send-inputArea-iconArea-button'
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => { setQuickReplyOpenedBy(null); setIsEmojiOpen(open => !open); }} disabled={isBusy || !canWrite}>
                        <Icon name='emoji' customStyles='messenger-room-send-inputArea-iconArea-icon' size={iconSize} />
                    </button>
                    <button type='button' data-quick-reply-toggle aria-label='插入快速回覆' title='插入快速回覆（也可以在空白輸入框輸入 /）' aria-expanded={Boolean(quickReplyOpenedBy)}
                        className='messenger-room-send-inputArea-iconArea-button messenger-room-send-quickReply'
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => { setIsEmojiOpen(false); setQuickReplyOpenedBy(open => (open ? null : 'button')); }} disabled={isBusy || !canWrite}>
                        <img src='/design/ui/action-text.svg' alt='' width={22} height={22} />
                    </button>
                    {isWhatsapp && (
                        <button type='button' aria-label='使用 WhatsApp 範本發送' title='使用 WhatsApp 已核准的範本發送' className='messenger-room-send-inputArea-iconArea-button'
                            onClick={() => setIsTemplateOpen(true)} disabled={isBusy}>
                            <img src='/svg/whatsapp.svg' alt='' width={22} height={22} />
                        </button>
                    )}
                    <button type='button' aria-label='附加檔案' className='messenger-room-send-inputArea-iconArea-button' onClick={openFilePicker} disabled={isBusy || !canWrite}>
                        <Icon name='attach' customStyles='messenger-room-send-inputArea-iconArea-icon' size={iconSize} />
                    </button>
                    <input ref={fileInputRef} type='file' accept={ACCEPT_ATTRIBUTE} hidden
                        onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = ''; }} />
                </div>
                {isEmojiOpen && <EmojiPicker onSelect={insertText} onClose={closeEmoji} />}
                {quickReplyOpenedBy && <QuickReplyPicker platform={platform} isAdmin={isAdmin} onPick={insertText} onClose={closeQuickReply} />}
            </div>
            <Button title={isMobile ? '' : buttonTitle} disabled={!canWrite && !isWhatsapp} rounded='large' customStyles={isMobile ? { height: '44px', padding: '0px', opacity: isBusy ? 0.6 : 1 } : { height: '44px', opacity: isBusy ? 0.6 : 1, minWidth: '96px' }} startElement={<Icon name='send' size='small' />}
                onClick={() => send()} />
        </div>
        {isTemplateOpen && room?.id && <WhatsappTemplateDialog room={room} onClose={() => setIsTemplateOpen(false)} onSent={() => { setSendError(''); setNeedsTemplate(false); }} />}
        </>
    )
}

MessageInput.propTypes = {
    handlePushMessage: PropTypes.func.isRequired,
    isMobile: PropTypes.bool,
    // fb, ig or whatsapp: decides which files can be attached
    platform: PropTypes.string,
    room: PropTypes.shape({ id: PropTypes.string, platform: PropTypes.string, lastCustomerMessageAt: PropTypes.string, replyWindow: PropTypes.object }),
}

export default MessageInput
