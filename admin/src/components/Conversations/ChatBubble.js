import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Bubble from "../../stories/components/Bubble";
import Avatar from "../../stories/components/Avatar";
import ContentText from '../../stories/components/ContentText';

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

// Meta's attachment links expire, so a broken one falls back to the same text as having no link.
function Attachment({ type, payload, caption, filename }) {
    const [isBroken, setIsBroken] = useState(false)
    const label = ATTACHMENT_LABELS[type] || '附件'
    const url = /^https:\/\//.test(payload?.url || '') && !isBroken ? payload.url : null

    if (url && (type === 'image' || type === 'sticker')) {
        return <img src={url} alt={label} className='max-w-[240px] rounded-[6px]' onError={() => setIsBroken(true)} />
    }
    if (url) {
        return <a href={url} target='_blank' rel='noopener noreferrer' className='underline'>查看{label}</a>
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



function ChatBubble({ contents, attachments, deliveryError, name, time, showAvatar, justifyItem }) {

    const newTime = new Date(time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    })

    // console.log('ChatBubble',newTime)
    return (
        <div className={`flex items-start justify-${justifyItem} w-full`}>

            {showAvatar && <Avatar title='' size='small' customStyles='mr-[8px]' name={name} />}
            <div className={`flex flex-col flex-1 items-${justifyItem} align`}>
                <Bubble contents={<>{contents}{attachments?.map((attachment, i) => <Attachment key={i} {...attachment} />)}</>} color={justifyItem === 'start' && 'secondary'} />
                {deliveryError && <ContentText title={`未送達：${deliveryError}`} size='small' color='alert' customStyles='mt-[3px]' />}
                <ContentText title={newTime} size='small' color='black-tertiary' customStyles='mt-[3px]'/>
            </div>
        </div>
    )
}

ChatBubble.propTypes = {
    contents: PropTypes.node,
    attachments: PropTypes.array,
    deliveryError: PropTypes.string,
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
