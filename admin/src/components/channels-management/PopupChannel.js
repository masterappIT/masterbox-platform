import React from 'react';
import PropTypes from 'prop-types';
import Popup from '../../stories/components/Popup';

// Meta connects Facebook, Instagram and WhatsApp Business through Meta's login; WhatsApp connects any
// WhatsApp number by scanning a QR code with the phone. The others are shown as coming soon.
const PLATFORMS = [
  { key: 'meta', name: 'Meta', available: true },
  { key: 'whatsapp', name: 'WhatsApp', available: true, tag: '掃碼連結' },
  { key: 'wechat', name: 'Wechat', available: false },
  { key: 'line', name: 'Line', available: false },
];

function PopupChannel({ isShow, onClick, onConnectMeta, onConnectWhatsapp, connecting }) {
  return (
    <Popup isShow={isShow} onClick={onClick} size='fit' label='選擇一個社群平台'>
      <div className='channel-picker'>
        <h2 className='channel-picker-title'>選擇一個社群平台</h2>
        <p className='channel-picker-description'>選擇一個的社群平台，開始您的品牌社群經營</p>
        <ul className='channel-picker-list'>
          {PLATFORMS.map(({ key, name, available, tag }) => (
            <li key={key}>
              <button
                type='button'
                className='channel-picker-card'
                disabled={!available || connecting}
                aria-describedby={available ? undefined : `channel-picker-${key}-note`}
                onClick={available ? (key === 'whatsapp' ? onConnectWhatsapp : onConnectMeta) : undefined}
              >
                <img src={`/design/ui/platform-${key}.svg`} alt='' width={48} height={48} />
                <span className='channel-picker-name'>{key === 'meta' && connecting ? '串接中…' : name}</span>
                {tag && <span className='channel-picker-tag'>{tag}</span>}
                {!available && <span id={`channel-picker-${key}-note`} className='channel-picker-note'>尚未開放</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Popup>
  );
}

PopupChannel.propTypes = {
  isShow: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  onConnectMeta: PropTypes.func.isRequired,
  onConnectWhatsapp: PropTypes.func.isRequired,
  connecting: PropTypes.bool,
};

PopupChannel.defaultProps = {
  isShow: false,
  connecting: false,
};

export default PopupChannel;
