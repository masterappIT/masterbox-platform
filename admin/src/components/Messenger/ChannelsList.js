import React from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';
import { useTranslation } from 'react-i18next';
import { channelSubtitle } from '../Chat/capabilities';


// allChannels adds a first choice for every channel, chosen as -1.
function ChannelsList({ setChannelData, channelList, setChannelListVisitable, channelListVisitable, isMobile,setSelectedChatroomID, allChannels }) {
  const { t } = useTranslation()

  const handleOnClick = (i) => {
    setChannelListVisitable(false);
    setChannelData(i)
    setSelectedChatroomID(null)
  }
  let channelListHeight = ''
  // let channelListHeight= `calc(${84 * (channelList.length) + 20}px)` 
  const choices = channelList.length + (allChannels ? 1 : 0)
  channelListHeight = `calc(${64 * choices + 20}px)`

  return (
    <div className={`messenger-list-channel-others ${channelListVisitable ? '' : 'messenger-list-hidden'} ${isMobile ? 'messenger-list-channel-others-mobile' : ''}`} style={channelListVisitable ? { height: channelListHeight } : { height: '0px' }}>
      {allChannels && channelList.length > 0 && (
        <div onClick={() => handleOnClick(-1)}>
          <ChatroomItem title={t('all_channels')} isMobile={isMobile} name={t('all_channels')} contentShow={false} />
        </div>
      )}
      {(channelList&&channelList.length) ?channelList.map((channel, i) => (
        <div key={channel.channel_id || i} onClick={() => handleOnClick(i)} >
          <ChatroomItem title={channel.name}
            isMobile={isMobile}
            name={channel.name}
            // The phone number or page name after the source, never the internal id.
            content={channelSubtitle(channel)}
            contentIcon={<Icon name={channel.platform} size='small' customStyles={`mr-[6px] mt-[1px] `}/>}
            />
        </div>
      )):''}
    </div>
  );

}

ChannelsList.propTypes = {
  // title: PropTypes.string,
  // variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
}

ChannelsList.defaultProps = {
  // title: 'Input',
  // color: 'primary',
  // customStyles: null,
  // onClick: null,
}

export default ChannelsList
