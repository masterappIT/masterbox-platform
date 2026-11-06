import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Bubble from "../../stories/components/Bubble";
import Avatar from "../../stories/components/Avatar";
import ContentText from '../../stories/components/ContentText';
import { isSticker, withoutRepeatedStickers } from '../../utils/attachments';

const ATTACHMENT_LABELS = {
    image: '圖片',
    video: '影片',
    audio: '語音訊息',
    file: '檔案',
    document: '文件',
    sticker: '貼圖',
    location: '位置',
    contacts: '聯絡人',
    order: '訂單',
    reaction: '表情回應',
    unknown: '不支援的訊息類型',
    unsupported: '不支援的訊息類型',
}

// Files are served over HTTPS; local development serves them from the API on localhost.
const isFileUrl = (url) => /^https:\/\//.test(url || '') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url || '')

// Meta's own attachment links expire and a file may not have been saved, so a broken one falls back to the same text as having no link.
function Attachment({ type, payload, caption, filename }) {
    const [isBroken, setIsBroken] = useState(false)
    const label = ATTACHMENT_LABELS[type] || '附件'
    const url = isFileUrl(payload?.url) && !isBroken ? payload.url : null
    const captionLine = caption ? <div className='mt-[4px]'>{caption}</div> : null

    if (url && (type === 'image' || type === 'sticker')) {
        return <div><a href={url} target='_blank' rel='noopener noreferrer'><img src={url} alt={filename || label} className={isSticker({ type, payload }) ? 'messenger-attachment-sticker' : 'messenger-attachment-media'} onError={() => setIsBroken(true)} /></a>{captionLine}</div>
    }
    if (url && type === 'video') {
        return <div><video src={url} controls preload='metadata' className='messenger-attachment-media' onError={() => setIsBroken(true)} />{captionLine}</div>
    }
    if (url && type === 'audio') {
        return <div><audio src={url} controls preload='metadata' className='messenger-attachment-audio' onError={() => setIsBroken(true)} />{captionLine}</div>
    }
    if (url) {
        return <div><a href={url} target='_blank' rel='noopener noreferrer' className='underline break-all'>📎 {filename || `查看${label}`}</a>{captionLine}</div>
    }
    return <div>[{label}{filename ? `：${filename}` : ''}]{caption ? ` ${caption}` : ''}</div>
}

/**
 * 
 * @param  contents  string || array
 * @param  attachments  array - the message's images and other attachments
 * @param  deliveryError string - why the platform could not deliver this message
 * @param  name string - user name
 * @param  time  string 
 * @param  showAvatar bool
 * @param  justifyItem - one of ['start', 'end]
 * @param  pending bool - showing the message delivery status 
 */



function ChatBubble({ contents, attachments, deliveryError, note, name, time, showAvatar, justifyItem }) {

    // The conversation passes the time already formatted in the admin's language.
    const newTime = typeof time === 'string' && Number.isNaN(Date.parse(time)) ? time : new Date(time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    })

    return (
        <div className={`flex items-start justify-${justifyItem} w-full`}>

            {showAvatar && <Avatar title='' size='small' customStyles='mr-[8px]' name={name} />}
            <div className={`flex flex-col flex-1 items-${justifyItem} align`}>
                <Bubble contents={<>{contents}{withoutRepeatedStickers(attachments)?.map((attachment, i) => <Attachment key={i} {...attachment} />)}</>} color={justifyItem === 'start' && 'secondary'} />
                {deliveryError && <ContentText title={`未送達：${deliveryError}`} size='small' color='alert' customStyles='mt-[3px]' />}
                <ContentText title={note ? `${note}・${newTime}` : newTime} size='small' color='black-tertiary' customStyles='mt-[3px]'/>
            </div>
        </div>
    )
}

ChatBubble.propTypes = {
    contents: PropTypes.node,
    attachments: PropTypes.array,
    deliveryError: PropTypes.string,
    // a short line beside the time, such as who sent it
    note: PropTypes.string,
    name: PropTypes.string,
    time: PropTypes.string,
    showAvatar: PropTypes.bool,
    justifyItem: PropTypes.oneOf(['start', 'end']),
    pending: PropTypes.bool,
}

ChatBubble.defaultProps = {
    contents: null,
    attachments: [],
    deliveryError: null,
    name: 'name',
    time: new Date(),
    showAvatar: true,
    justifyItem: 'start',
    pending: false
}
export default ChatBubble
