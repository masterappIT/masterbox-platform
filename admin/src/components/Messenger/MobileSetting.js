import React from 'react'
import PropTypes from 'prop-types'
import List from '../../stories/components/List';
import ChatroomItem from '../../stories/components/ChatroomItem';
import ContentText from '../../stories/components/ContentText';
import ListItem from '../../stories/components/ListItem';
import Icon from '../../stories/components/Icon';
import Headline from '../../stories/components/Headline';
import MobileHeader from './MobileHeader';

import store from '/src/redux/store';
import { removeAccessToken } from '/src/redux/slices/userSlices';
import { useRouter } from 'next/router';






function MobileSetting({ set }) {
  const router = useRouter()

  const handleLogout = (event) => {

    store.dispatch(removeAccessToken())

    router.reload()

  }

  return (
    <List customStyles='pt-[45px]'>
      {set.map((s, i) => {
        return (
          <ListItem key={i}
            startElement={<Headline title={s.title} customStyles='flex-1' onClick={()=>handleLogout()}/>}
            endElement={s.title!=='登出'? <><ContentText title={s.list[0]} color='black-tertiary' /><Icon name='next' customStyles={{ width: '5.4px', height: '9px' }} /></>:''}
            customStyles={{ padding: '16px 12px',cursor: 'pointer' }}>
          </ListItem>
        )
      })}
    </List>
  );

}

MobileSetting.propTypes = {
  set: PropTypes.array
  // title: PropTypes.string,
  // variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  // customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  // onClick: PropTypes.func,
}

MobileSetting.defaultProps = {
  set: [
    {
      title: '語言設定',
      list: ['繁體中文(台灣)', '英文']
    },
    {
      title: '顏色模式',
      list: ['亮模式', '暗模式']
    },
    { title: '登出'},
  ]
}

export default MobileSetting
