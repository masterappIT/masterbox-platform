import React, { useState, useEffect } from "react";
import ContentText from "../../stories/components/ContentText";

import Dropdown from "../../stories/components/Dropdown";
import Icon from "../../stories/components/Icon";
import List from "../../stories/components/List";
import ListItem from "../../stories/components/ListItem";

// const list = [{ title: '繁體中文', onClick: () => { changeLanguage("zh-tw") } }, { title: 'English', onClick: () => { changeLanguage("en") } }]

const LanguageSelector = ({ list, currentLanguages,customStyles }) => {
  const isTailwind = typeof customStyles === 'string';

  let languages
  switch (currentLanguages) {
    case 'zh-TW':
      languages="繁體中文"
      break;
    case 'en':
      languages="English"
      break;
  
    default:
      languages=currentLanguages
      break;
  }

  return (
    <>
    <div className="languageSelector"  >
    {/* <div className={` flex flex-col justify-center ${isTailwind && customStyles} `} style={!isTailwind ? { ...customStyles } : {}}  > */}
      <Dropdown list={list} justify='left' distance='close' outSideElement={
        <div className="w-[108px] h-[28px] flex items-center justify-start space-x-2 bg-[#00000099] py-[6px] px-[8px] rounded-[14px] relative">
          <Icon name='earth' size='small'/><ContentText title={languages} color='white' size='small' customStyles='whitespace-nowrap' /><Icon name='arrow-down' customStyles={{ filter: 'brightness(0.5) invert(1)',position:'absolute', right:'8px'}} size='mini' />
        </div>

      }
      customStyles={{left:'10px', top:'5px'}}>
        <List >
          {list && list.map(({ title, onClick }, index) => <ListItem key={index} onClick={() => onClick()} customStyles='whitespace-nowrap cursor-pointer hover:bg-primary_light'><ContentText title={title} size='normal' color='black-primary'></ContentText></ListItem>)}
        </List>
      </Dropdown>

    </div>
    </>
  );
};

export default LanguageSelector;
