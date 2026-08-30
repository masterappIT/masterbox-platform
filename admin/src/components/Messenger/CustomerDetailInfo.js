import React, { useEffect, useState } from "react";
import Avatar from "../../stories/components/Avatar";
import Button from "../../stories/components/Button";
import ContentText from "../../stories/components/ContentText";
import Headline from "../../stories/components/Headline";
import Icon from "../../stories/components/Icon";
import Label from "../../stories/components/Label";
import Linebar from "../../stories/components/Linebar";
import List from "../../stories/components/List";
import ListItem from "../../stories/components/ListItem";
import Popup from "../../stories/components/Popup";
import ClientTagsArea from "./ClientTagsArea";
import SubscriptionLabel from "./SubscriptionLabel";

//使用者基本資料
// const userInfo = {
//   headshot: "",
//   name: "用戶名稱",
//   subscribe: true,
//   detail: [
//     { 性別: "女" },
//     { 電話: "0912345678" },
//     { 信箱: "mastertest@gmail.com" },
//     { 生日: "1999-09-09" },
//     { 位置: "Taiwan" },
//   ],
//   active: "2022-07-15 17:23",
//   channel: "web",
// };
const userInfo = {
  headshot: "",
  name: "用戶名稱",
  subscribe: true,
  detail: [
    { 性別: "女" },
    { 電話: "0912345678" },
    { 信箱: "mastertest123@gmail.com" },
    { 生日: "1999-09-09" },
    { 位置: "Taiwan" },
  ],
  最近互動: "2022-07-15 17:23",
  渠道名稱: "web",
};
//使用者歷史資料
const userHistory = [
  {
    date: "20220811",
    time: "13:50:04",
    type: "訂單",
    snapshot: "product00.jpeg",
    title: "MOOTO跆拳道服",
    status: 0,
  },
  {
    date: "20220811",
    time: "13:50:04",
    type: "訂單",
    snapshot: "product02.jpeg",
    title: "直條紋道服",
    status: 3,
  },

  {
    date: "20220811",
    time: "13:50:04",
    type: "互動",
    name: "用戶名稱",
    action: "7天內瀏覽10次",
  },
  {
    date: "20220811",
    time: "13:50:04",
    type: "互動",
    name: "用戶名稱",
    action: "回覆了一則訊息",
  },
];

function BasicInfoBox({ chatPeopleInfo, subscriptionHandler }) {
  return (
    <div className="customerDetailInfo-cuntomer">
      <Avatar size='large' />
      <Headline size='normal' title='用戶名稱' customStyles=' mt-[16px] mb-[8px]' />
      <SubscriptionLabel isSubscription={chatPeopleInfo['訂閱狀態']} onClick={subscriptionHandler} />
      <List customStyles='space-y-2 flex-wrap mt-[16px]'>
        {userInfo.detail.map((item, i) => {
          let key = Object.keys(item)[0];
          return (
            <ListItem
              key={i}
              startElement={<ContentText title={key} size='normal' color='black-secondary' />}
              customStyles={{ padding: '0 32px', whiteSpace: 'nowrap' }}
            >
              <ContentText title={item[key]} size='normal' color='black-secondary' customStyles='whitespace-normal' />
            </ListItem>
          );
        })}
      </List>


      <div className="bar"></div>

      <List customStyles='space-y-2'>
        {Object.keys(userInfo).filter(i => i === '最近互動' || i === '渠道名稱').map((key, i) =>
          <ListItem
            key={i}
            startElement={<ContentText title={key} size='normal' color='black-secondary' />}
            customStyles={{ padding: '0 32px', whiteSpace: 'nowrap', flexWrap: 'nowrap' }}
          >
            <ContentText title={userInfo[key]} size='normal' color='black-secondary' customStyles='whitespace-normal' />
          </ListItem>
        )}
      </List>
    </div>
  );
}

function checkStatusData(status) {
  let colorSet = {
    0: 'tertiary',//紅色
    1: 'primary',//黃色
    2: 'secondary',//綠色
  };
  return [
    { txt: '待收貨', color: colorSet[0] },
    { txt: '備貨中', color: colorSet[0] },
    { txt: '運送中', color: colorSet[1] },
    { txt: '可取貨', color: colorSet[1] },
    { txt: '已取貨', color: colorSet[2] },
  ]
}

function OrderHistory({ history }) {
  let data = checkStatusData(history.status)
  return (
    <>
      <Headline size='normal' title={history.date} color='primary' customStyles='mt-5 mb-1' />
      <ListItem
        startElement={<Button title={history.type} customStyles={{ padding: '3px 18px', height: '25px', whiteSpace: 'nowrap' }} />}
        endElement={
          <div className="user-history-content">
            <Headline title={history.title} size='normal' />
            <ContentText title={`購買日期: ${history.date}`} size='small' color='black-secondary' customStyles='mb-2' />
            <Label title={data && data[history.status].txt} color={data && data[history.status].color} />
          </div>
        }
        customStyles={{ padding: 0, alignItems: 'flex-start' }}
      >
        <Avatar rounded={false} customStyles={{ borderRadius: '5px', width: '70px', height: '70px', aspectRatio: '1 / 1' }} title={history.snapshot} />
      </ListItem>
    </>
  );
}

function ActionHistory({ history }) {
  return (
    <>
      <Headline size='normal' title={history.date} color='primary' customStyles='mt-5 mb-1' />
      <ListItem
        startElement={<Button title={history.type} customStyles={{ padding: '3px 18px', height: '25px', whiteSpace: 'nowrap' }} color='secondary' />}
        endElement={<ContentText title={history.action} size='normal' />}
        customStyles={{ padding: 0 }}
      >
      </ListItem>
    </>
  );
}



function UserHistory() {
  return (
    <div className="customerDetailInfo-history">
      <div className="customerDetailInfo-history-top">
        <Headline size='medium' title='用戶歷程' customStyles='' color='black-secondary' />
        <div className="customerDetailInfo-history-top-search">
          <input type="text" placeholder={"搜尋"} className='customerDetailInfo-history-top-search-input' style={{ border: 'none' }} />
          <Icon name='search' customStyles='customerDetailInfo-history-top-icon' />
        </div>
      </div>
      <div className="customerDetailInfo-history-bottom">

        {userHistory.map((history, i) => {

          if (history["type"] === "訂單") {
            return <OrderHistory key={i} history={history} orderStatus={history} />;
          } else {
            return <ActionHistory key={i} history={history} />;
          }
        })}
      </div>

    </div>
  );
}

function Others({ chatPeopleTags, pressHandler, deleteTag }) {
  return (
    <div className="customerDetailInfo-others">
      <ClientTagsArea chatPeopleTags={chatPeopleTags} deleteTag={deleteTag} pressHandler={pressHandler} />
    </div>
  );
}

export default function CustomerDetailInfo({ isCustomerDetailInfo, setIsCustomerDetailInfo, chatPeopleInfo, chatPeopleTags, setChatPeopleInfo, setChatPeopleTags, subscriptionHandler, pressHandler, deleteTag }) {
  return (
    <Popup isShow={isCustomerDetailInfo ? true : false} onClick={setIsCustomerDetailInfo} size='large' customStyles='customerDetailInfo'>
      {/* <div className={`customerDetailInfo ${isCustomerDetailInfo ? '' : 'customerDetailInfo-hidden'} `}> */}
      {/* <div className={`customerDetailInfo ${isCustomerDetailInfo ? '' : 'customerDetailInfo-hidden'} `}> */}
        <BasicInfoBox chatPeopleInfo={chatPeopleInfo} subscriptionHandler={subscriptionHandler} />
        <UserHistory />

        <div className="flex-1">

          <Others setIsCustomerDetailInfo={setIsCustomerDetailInfo} chatPeopleTags={chatPeopleTags} pressHandler={pressHandler} deleteTag={deleteTag} />
        </div>
      {/* </div> */}
    </Popup>

  );
}
