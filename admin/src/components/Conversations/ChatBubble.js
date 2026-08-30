import React from 'react'
import PropTypes from 'prop-types'
import Bubble from "../../stories/components/Bubble";
import Avatar from "../../stories/components/Avatar";
import ContentText from '../../stories/components/ContentText';

/**
 * 
 * @param  contents  string || array
 * @param  name string - user name
 * @param  time  string 
 * @param  showAvatar bool
 * @param  justifyItem - one of ['start', 'end]
 * @param  pending bool - showing the message delivery status 
 */



function ChatBubble({ contents, name, time, showAvatar, justifyItem }) {

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
                <Bubble contents={contents} color={justifyItem === 'start' && 'secondary'} />
                <ContentText title={newTime} size='small' color='black-tertiary' customStyles='mt-[3px]'/>
            </div>
        </div>
    )
}

ChatBubble.propTypes = {
    contents: PropTypes.string || PropTypes.array,
    name: PropTypes.string,
    time: PropTypes.string,
    showAvatar: PropTypes.bool,
    justifyItem: PropTypes.oneOf(['start', 'end']),
    pending: PropTypes.bool,
}

ChatBubble.defaultProps = {
    contents: 'this is the chat contents',
    name: 'name',
    time: new Date(),
    showAvatar: true,
    justifyItem: 'start',
    pending: false
}
export default ChatBubble
