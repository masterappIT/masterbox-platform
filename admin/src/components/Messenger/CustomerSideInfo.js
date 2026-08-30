import React, { useState, useEffect } from "react";
import Avatar from "../../stories/components/Avatar";
import Button from "../../stories/components/Button";
import ContentText from "../../stories/components/ContentText";
import Headline from "../../stories/components/Headline";
import Icon from "../../stories/components/Icon";
import List from "../../stories/components/List";
import ListItem from "../../stories/components/ListItem";
import ClientTagsArea from "./ClientTagsArea";
import SubscriptionLabel from "./SubscriptionLabel";

//component

export default function CustomerSideInfo({ isCustomerSideInfo, setIsCustomerSideInfo, isCustomerDetailInfo, setIsCustomerDetailInfo, chatPeopleInfo, chatPeopleTags, setChatPeopleInfo, setChatPeopleTags, subscriptionHandler, pressHandler, deleteTag }) {
  function sideInfoHandler() {
    setIsCustomerDetailInfo(true);
  }

  return (
    <div className={`messenger-sideInfo ${isCustomerSideInfo ? '' : 'messenger-sideInfo-hidden'}`}>
      <Icon name='closeBtn'
        onClick={() => setIsCustomerSideInfo(false)}
        customStyles='self-end m-[10px] cursor-pointer'
      />
      <div className="messenger-sideInfo-client">
        <div className="messenger-sideInfo-client-left">
          <Avatar size='large' />
          <Button title='檢視更多'
            onClick={sideInfoHandler}
            variant='text'
            color='grayscale'
            customStyles={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#E6E6E6' }}
          />
        </div>
        <List customStyles="messenger-sideInfo-client-right">
          <Headline size='normal' title='用戶名稱' />

          {Object.keys(chatPeopleInfo).map((key, i) =>
            <ListItem
              key={i}
              startElement={<ContentText title={key} size='normal' color='black-tertiary' />}
              customStyles={{ padding: 0, height: '32px' }}
            >
              {key === '訂閱狀態' ?
                <SubscriptionLabel isSubscription={chatPeopleInfo[key]} onClick={subscriptionHandler} />
                // <Label title={chatPeopleInfo[key] ? '已訂閱' : '未訂閱'} />
                : <Headline title={chatPeopleInfo[key]} size='small' color='black-secondary' />
              }
            </ListItem>
          )}
        </List>
      </div>
      <div className="messenger-sideInfo-tags">

        <ClientTagsArea chatPeopleTags={chatPeopleTags} deleteTag={deleteTag} pressHandler={pressHandler} />
      </div>

    </div>
  );
}
