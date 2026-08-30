import React, { useState } from 'react';
import PropTypes from 'prop-types';

import Link from 'next/link';
import Icon from './Icon';
import Card from './Card';
import List from './List';
import ListItem from './ListItem';
import Headline from './Headline';
import ImageBox from './ImageBox';
import { pathInfo } from '../../utils/pathInfo';

import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';


const SidebarListItem = ({ index, icon, title, focus, path, collapsed }) => {

  const router = useRouter()



  return (
    <div
      className='sidebar-nav-item'
      role='button'
      tabIndex={0}
      onClick={() => router.push(path)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          router.push(path);
        }
      }}
    >
      <ListItem key={index.toString()} startElement={<Icon name={icon} size='large' customStyles='ml-[4px]' />} customStyles={`sidebar-content-list-item ${focus ? 'sidebar-content-list-item-focus' : ''} ${collapsed ? 'sidebar-content-list-item-collapsed' : ''}`} >
        <Headline title={title} customStyles='ml-[10px]' />
      </ListItem>
    </div>
  )
}

function Sidebar({ logo, items, customStyles, toBottom, onClick, collapsed, onToggle }) {
  const { t } = useTranslation();


  const isTailwind = typeof customStyles === 'string';
  const router = useRouter()
  const pathname = router.pathname;
  // console.log('pathname', pathname)

  // if(pathname==='/'){
  //   router.push('/messenger')
  // }
  // const [selectItem, setSelectItem] = useState(null);

  // function bgColorHandler(e) {
  //   if (selectItem != null) {
  //     selectItem.classList.remove('selected');
  //   }
  //   if (e.target.classList.contains('single-selection')) {
  //     e.target.classList.add('selected');
  //     setSelectItem(e.target);
  //   } else {
  //     e.target.parentElement.classList.add('selected');
  //     setSelectItem(e.target.parentElement);
  //   }
  // }



  return (
    <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className='sidebar-logo'>
        <div className='sidebar-logo-mark'><ImageBox src={logo} /></div>
        <button type='button' className='sidebar-toggle' onClick={onToggle} aria-label={collapsed ? '展開選單' : '收起選單'} title={collapsed ? '展開選單' : '收起選單'}><span aria-hidden='true' /></button>
      </div>
      <div className='sidebar-content'>
        <List customStyles='sidebar-content-list'>
          {items.map(({ icon, title, path }, index) => {
            return (
              index <= items.length - (toBottom + 1) &&
              <SidebarListItem key={index} index={index} icon={icon} title={t(title)} focus={pathname === `${path}` ? true : false} path={path} collapsed={collapsed} />
            )
          })}

        </List>

        <List customStyles='sidebar-content-list '>
          {items.map(({ icon, title, path }, index) => {
            return (
              index > items.length - (toBottom + 1) &&
              <SidebarListItem key={index} index={index} icon={icon} title={title} focus={pathname === `${path}` ? true : false} path={path} collapsed={collapsed} />
            )
          })}
        </List>

      </div>
    </div>
  );
}


Sidebar.propTypes = {
  logo: PropTypes.string,
  items: PropTypes.array,
  customStyles: PropTypes.oneOfType([PropTypes.string, PropTypes.object]), 
  onClick: PropTypes.func,
  toBottom: PropTypes.number,
  collapsed: PropTypes.bool,
  onToggle: PropTypes.func,
};

Sidebar.defaultProps = {
  logo: '/img/logo.svg',
  items: pathInfo,
  customStyles: null,
  onClick: null,
  toBottom: null,
  collapsed: false,
  onToggle: null,
};
export default Sidebar;