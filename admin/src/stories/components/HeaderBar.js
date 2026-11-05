import React, { useState } from "react";
import Avatar from "./Avatar";
import ContentText from "./ContentText";
import Dropdown from "./Dropdown";
import Icon from "./Icon";
import List from "./List";
import ListItem from "./ListItem";
import { logout } from '/src/redux/store';
import { useRouter } from 'next/router';
import { useSelector } from "react-redux";
import { selectUserInfo } from "../../redux/slices/userSlices";
import { findHeaderBarTitle } from "../../utils/pathInfo"
import UserInfoPopup from "../../components/User/UserInfoPopup";

import { useTranslation } from 'react-i18next';








function HeaderBar({ customStyles, showSidebarHeaderBar }) {
  const isTailwind = typeof customStyles === 'string';
  const { t } = useTranslation();

  const setIsPopupDefault=false
  const [isPopup, setIsPopup] = useState(setIsPopupDefault);

  const router = useRouter()

  const { email } = useSelector(selectUserInfo)


  // console.log('userInfo',email)


  const headerTitle = findHeaderBarTitle(router.pathname)



  const list = [{ title: t('your_information'), onClick: () => { setIsPopup(true) } }, { title: t('logout'), onClick: () => logout() }]
  return (
    <>
      <div className={`${showSidebarHeaderBar ? 'hidden sm:block' : 'hidden'} overflow-visible bg-white shadow-[0px_1px_4px_0px_rgba(0,0,0,0.25)] ${customStyles}`}>
        <div className='flex items-center justify-between gap-[16px] h-[61px] px-[32px]'>
          <h1 className='m-0 min-w-0 pl-[12px] border-l-[3px] border-primary text-[18px] leading-[25px] font-medium text-black_primary truncate'>{headerTitle ? t(headerTitle) : ''}</h1>
          <div className='flex items-center justify-end gap-[16px] shrink-0'>
            <Icon name='inbox' customStyles='w-[24px] h-[24px]' />
            <span className='max-w-[280px] text-[12px] leading-[16px] text-black_primary truncate' title={email}>{`${t('user')} : ${email || ''}`}</span>
            <Dropdown list={list} justify='right' distance='far' outSideElement={<Avatar size='mini' border name={email} />}>
              <List>
                {list.map(({ title, onClick }, index) => <ListItem key={index} onClick={() => onClick()} customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_lightest'><a><ContentText title={title} /></a></ListItem>)}
              </List>
            </Dropdown>
          </div>
        </div>
      </div>
      <UserInfoPopup isShow={isPopup} onClick={setIsPopup} currentComponent='basicInfo'/>
    </>
  );
}

export default HeaderBar;