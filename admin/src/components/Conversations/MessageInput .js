import React, { useState } from 'react'
import PropTypes from 'prop-types'
import Button from "../../stories/components/Button";
import Icon from "../../stories/components/Icon";


function ActionIcon({ icon, size }) {
    return <Icon name={icon} customStyles='messenger-room-send-inputArea-iconArea-icon' size={size} />;
}
const actions = [
    { icon: "emoji", action: "" },
    { icon: "attach", action: "" },
];

function MessageInput({ handlePushMessage, isMobile }) {

    const [message, setMessage] = useState('');
    // function enterPressHandler(e) {
    //     if (e.key === "Enter") {
    //         handlePushMessage({ text: message })
    //     }
    //   }
    function handleClickBtn() {
        handlePushMessage({ text: message })
        setMessage('')
    }

    return (
        <div className={`messenger-room-send`}>
            <div className={`messenger-room-send-inputArea`}>
                <input
                    className={`messenger-room-send-inputArea-input`}
                    type="text"
                    placeholder="寫下一些訊息吧"
                    value={message}
                    // onKeyPress={() => enterPressHandler({ text: message })}
                    onChange={(event) => setMessage(event.target.value)}
                    style={isMobile ? { backgroundColor: '#F08F36', color: 'white', fontSize: '14px', width: '90%', height: '45px', marginRight: '10px', borderRadius: '8px' } : { fontSize: '14px' }}
                />
                <div className="messenger-room-send-inputArea-iconArea">
                    {actions.map(({ icon, action }, i) => {
                        return <ActionIcon key={i} icon={icon} onClick={action} size={`${isMobile ? 'small' : 'medium'}`} />;
                    })}
                </div>
            </div>
            <Button title={isMobile ? '' : '發送'} rounded='large' customStyles={isMobile ? { height: '44px', padding: '0px' } : { height: '44px' }} startElement={<Icon name='send' size='small' />}
                onClick={() => handleClickBtn()} />
        </div>
    )
}

MessageInput.propTypes = {}

export default MessageInput 
