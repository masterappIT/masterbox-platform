import React, { useState } from "react";
import Avatar from "./Avatar";
import Card from "./Card";
import ContentText from "./ContentText";
import Dropdown from "./Dropdown";
import Headline from "./Headline";
import Icon from "./Icon";
import List from "./List";
import ListItem from "./ListItem";
import store from '/src/redux/store';
import { removeAccessToken } from '/src/redux/slices/userSlices';
import { useRouter } from 'next/router';
import { useSelector } from "react-redux";
import { selectUserInfo } from "../../redux/slices/userSlices";
import { findHeaderBarTitle } from "../../utils/pathInfo"
import Popup from "./Popup";
import Input from "./Input";
import Button from "./Button";
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
  const handleLogout = (event) => {

    store.dispatch(removeAccessToken())

    router.reload()

  }


  const headerTitle = findHeaderBarTitle(router.pathname)



  const list = [{ title: t('your_information'), onClick: () => { setIsPopup(true) } }, { title: t('subscription_fee'), onClick: () => { } }, { title: t('logout'), onClick: () => handleLogout() }]
  return (
    <>
      <div className={`${showSidebarHeaderBar ? 'hidden sm:block' : 'hidden'}   overflow-visible shadow-[0px_2px_2px_0_rgba(57,57,57,0.18)] ${customStyles}`}>
        <div className='hidden sm:block h-[68px] transition-all sticky bg-transparent top-0  flex items-center' style={showSidebarHeaderBar ? {} : { display: "none" }}>
          <ListItem customStyles='h-[68px]'
            startElement={<Headline title={t(headerTitle)} size='medium' customStyles='pl-[12px] border-l-4 border-primary ' />}
            endElement={
              <div className="flex flex-row items-center justify-end">
                <Icon name='inbox' />
                <ContentText title={`${t('user')} :  ${email}`} customStyles='px-[10px]' />
                {/* <Dropdown list={list} justify='right' distance='far'><Avatar size='mini' border title='product02.jpeg' /></Dropdown> */}
                <Dropdown list={list} justify='right' distance='far' outSideElement={<Avatar size='mini' border name={email} title='product02.jpeg' />}>
                  <List >
                    {list && list.map(({ title, onClick }, index) => <ListItem key={index} onClick={(e) => onClick()} customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light'><a><ContentText title={title} size='normal' color='black-primary'></ContentText></a></ListItem>)}
                  </List>
                </Dropdown>
              </div>
            }
          >
            <List title='' customStyles='flex-1' />
          </ListItem>
        </div>
      </div>
      <UserInfoPopup isShow={isPopup} onClick={setIsPopup} currentComponent='basicInfo'/>
    </>
  );
}

export default HeaderBar;