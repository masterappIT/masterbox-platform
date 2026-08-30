import React from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';
import MobileHeader from './MobileHeader';








function MobileSettingDetail({ list }) {


  return (
    <List customStyles='pt-[45px]'>
      {list.map((l, i) => {
        return (
          <ListItem key={i}
            startElement={<Headline title={l} customStyles='flex-1'/>}
            endElement={<><ContentText title='繁體中文' color='black-tertiary' /><Icon name='next' customStyles={{width:'5.4px',height:'9px'}}/></>}
            customStyles={{ padding: '16px 12px' }}>
          </ListItem>
        )
      })}
    </List>
  );

}

MobileSettingDetail.propTypes = {
  list: PropTypes.array
  // title: PropTypes.string,
  // variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
}

MobileSettingDetail.defaultProps = {
  list: ['語言設定', '顏色模式', '登出']
}

export default MobileSettingDetail
