import React from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';

export const checkTitle = (currentComponent,currentChatroom) => {

  switch (currentComponent) {
      case 'messenger':
        return '聊天'
      case 'conversations':
        let customer =  currentChatroom.users.find(user => user.id !== currentChatroom.channel_id)
          
        let userName=`${(customer.first_name && customer.first_name) + (customer.last_name && customer.last_name)}`
        
        return userName

      case 'setting':
        return '設定'
      default:
          break;
  }

}

function MobileHeader({  componentHandler,setCurrentComponent,currentChatroom }) {
  
  const currentComponent = componentHandler.current;

  let title = checkTitle(currentComponent,currentChatroom);
  

  return (
    <>
      {currentComponent === 'messenger' &&
        <ListItem
          customStyles='messenger-list-mobilebar'
          startElement={<Headline title={title} size='medium' color='white' customStyles='pl-[4px]' />}
        >
          <Icon name='triangle' customStyles={{width:'8px',height:'6px', marginLeft:'5px'}} />
        </ListItem>}
      {(currentComponent !== 'messenger' && currentComponent === 'setting' )&& <ListItem
        customStyles='messenger-list-mobilebar'
      >
        <Headline title={title} size='medium' color='white' />
      </ListItem>}
      {currentComponent !== 'messenger' && <ListItem
        customStyles='messenger-list-mobilebar'
        startElement={
        <Icon name='back' customStyles={{width:'7px',height:'14px',margin:'2px 0 0 4px' }}
        onClick={()=>setCurrentComponent(componentHandler.history)}
        />}
      >
        <Headline title={title} size='medium' color='white' />
      </ListItem>}

      {currentComponent === 'client'?'':''}
    </>

  );
}

MobileHeader.propTypes = {
  startElement: PropTypes.element,
  endElement: PropTypes.element,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
  // currentComponent: PropTypes.oneOf(['primary', 'secondary'])
}

MobileHeader.defaultProps = {
  startElement: null,
  endElement: null,
  customStyles: null,
  onClick: null,
  // currentComponent: 'primary'

}

export default MobileHeader
