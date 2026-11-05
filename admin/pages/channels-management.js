import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { tableFactory } from '../src/utils/TableFactory';
import { dummyTableData } from '../src/Data/dummyData';


import { selectUserToken } from '../src/redux/slices/userSlices';
import { useRouter } from 'next/router'
import { useSelector } from "react-redux";
import { fetchCompanyInfo } from '../src/redux/slices/companySlices';
import { selectUserInfo } from '../src/redux/slices/userSlices';
import { useDispatch } from "react-redux";
import { getUserSubscribedChannels, saveChannels, selectChannels } from "../src/redux/slices/messagesSlices";
import { apolloApiHelpers } from '../src/graphQL';
import { CREATE_META_CONNECT_URL, SET_CHANNEL_ENABLED } from '../src/graphQL/channel';


import Table from '../src/stories/components/Table';
import Icon from '../src/stories/components/Icon';
import Headline from '../src/stories/components/Headline';
import Button from '../src/stories/components/Button';
import { useMemo } from 'react';
import TableTop from '../src/components/Table/TableTop';
import Selector from '../src/stories/components/Selector';
import Input from '../src/stories/components/Input';
import Popup from '../src/stories/components/Popup';
import ContentText from '../src/stories/components/ContentText';
import PopupChannel from '../src/components/channels-management/PopupChannel';





const platformNames = {
  fb: 'Facebook',
  ig: 'Instagram',
  whatsapp: 'Whatsapp',
  line: 'Line',
  wechat: 'Wechat',
}

const headerNames = {
  status: '狀態',
  name: '名稱',
  channel: '平台',
}


function ChannelsManagementPage({ platforms, defaultValue }) {

  const router = useRouter()
  const token = useSelector(selectUserToken)
  const userInfo = useSelector(selectUserInfo)
  const dispatch = useDispatch()


  const [currentPlatform, setCurrentPlatform] = useState('fb');

  const [isPopup, setIsPopup] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [connectionResult, setConnectionResult] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [pendingToggles, setPendingToggles] = useState([]);

  const allChannels = useSelector(selectChannels);

  const ChannelsFiltered = useMemo(() => {

    if (allChannels.length) {

      return allChannels
        ?.filter(channel => channel.platform === currentPlatform)
        .map(channel => ({ ...channel, status: channel.enabled ? 1 : 0, channel: platformNames[channel.platform] || channel.platform }));
    }
    return []
  }
    , [allChannels, currentPlatform])



  const tableData = useMemo(() => {

    const table = new tableFactory("channelsMgmt", ChannelsFiltered)

    return {
      header: table.getHeaders().map(col => headerNames[col] || col),
      colsTemplate: table.getGridTemplate(),
      row: table.getRowsData()
    }

  }, [ChannelsFiltered])






  // let tableData = new tableFactory("channelsMgmt", allChannelsData)
  // let tableData = new tableFactory("channelsMgmt", dummyTableData.channelsMgmt)


  // 啟用或停用頻道
  const handleToggle = async (index, enabled) => {
    const channel = ChannelsFiltered[index];
    if (!channel) return;

    setToggleError('');
    setPendingToggles(pending => [...pending, index]);
    const res = await apolloApiHelpers('mutation', SET_CHANNEL_ENABLED, { channelId: channel.channel_id, enabled });
    setPendingToggles(pending => pending.filter(i => i !== index));
    if (res.error) {
      setToggleError(`無法${enabled ? '啟用' : '停用'}「${channel.name}」：${res.error}`);
      return;
    }

    dispatch(saveChannels(allChannels.map(item => item.channel_id === channel.channel_id ? { ...item, enabled: res.enabled } : item)));
  }


  // 點擊傳接按鈕
  const handleConnect = async () => {
    if (isConnecting) return;

    setConnectionError('');
    setConnectionResult('');
    setIsConnecting(true);

    const res = await apolloApiHelpers('mutation', CREATE_META_CONNECT_URL, { returnUrl: `${window.location.origin}/channels-management` });
    if (res.error) {
      setConnectionError(`無法開始串接：${res.error}`);
      setIsConnecting(false);
      return;
    }

    window.location.assign(res);
  }


  // useEffect(() => {
  //   console.log('companyInfocompanyInfo',userInfo)
  //   if (userInfo) {
  //     dispatch(fetchCompanyInfo())
  //   }

  // }, [])



  useEffect(() => {
    dispatch(getUserSubscribedChannels())
  }, [dispatch])

  // 串接完成後由後端導回此頁，並帶上結果
  useEffect(() => {
    const { searchParams } = new URL(window.location.href)
    const connected = searchParams.get('meta_connected')
    const error = searchParams.get('meta_error')
    if (connected === null && !error) return

    const skipped = searchParams.get('meta_skipped')
    const failed = searchParams.get('meta_failed')
    setConnectionError([
      error,
      skipped && `已連接其他公司，未串接：${skipped}`,
      failed && `串接失敗：${failed}`,
    ].filter(Boolean).join('；'))
    if (connected !== null) setConnectionResult(Number(connected) > 0 ? `已串接 ${connected} 個頻道。` : '沒有新串接的頻道。')
    router.replace('/channels-management')
  }, [router])



  // filter
  const handleSetChannelData = ({ value }) => {
    // console.log('channels.filterItem',channel)
    // setCurrentPlatform(channel)
    setCurrentPlatform(value)

  }




  return (
    <>
      {/* <ul className='flex flex-row justify-start items-center space-x-8 h-[74px] px-[24px] py-[8px] p-0 bg-black_white '>
        {platforms.map((item, i) => {
          return (

            <li key={i} className={`flex flex-row justify-start items-center space-x-2 border-b-[2px] px-[3px] py-[6px]   cursor-pointer ${currentPlatform === item.icon ? 'border-primary' : 'border-transparent'} `}
              onClick={() => handleSetChannelData(item.icon)}>

              <Icon name={item.icon} size='large' />
              <Headline title={item.name} />

            </li>
          // )
        })}
      </ul>
      <div className='w-full h-[1px] bg-black_tertiary shadow-[0px_1px_2px_0px_rgba(0,0,0,0.2)] z-[2]'></div> */}



      {tableData ? <Table header={tableData.header} colsTemplate={tableData.colsTemplate} row={tableData.row}
        // {<Table header={tableData.getHeaders()} colsTemplate={tableData.getGridTemplate()}
        topElms={

          <div className='flex flex-col justify-start w-full '>

            <TableTop addTitle={isConnecting ? '串接中…' : `串接${platformNames[currentPlatform] || '平台'}`} addOnClick={handleConnect} deleteOnClick={() => setIsPopup(true)} />
            {connectionResult && <ContentText title={connectionResult} customStyles='mb-[12px]' />}
            {connectionError && <ContentText title={connectionError} color='alert' customStyles='mb-[12px]' />}
            {toggleError && <ContentText title={toggleError} color='alert' customStyles='mb-[12px]' />}
            <div className='flex items-center space-x-2'>
              <Headline size='normal' title='選擇平台' color='black-primary' />

              <Selector option={platforms} flex='row' customStyles='w-[288px]' defaultValue={defaultValue} onChange={handleSetChannelData} minHeight='none' />
            </div>

          </div>
        }
        withCheckbox={false}
        withEdit={false}
        onToggle={handleToggle}
        pendingToggles={pendingToggles}
      />

        : ''}
      <PopupChannel isShow={isPopup} onClick={setIsPopup} />
      {/* <Popup isShow={isPopup ? true : false} onClick={setIsPopup}>
        <div className='flex flex-col items-center justify-center w-full h-full '>
          <Headline title='選擇一個社群平台' size='large' />
          <ContentText title='選擇一個的社群平台，開使您的品牌社群經營' size='large' color='black-tertiary' customStyles='mt-[15px] mb-[24px]'/>
          <div className='flex'>
            <div className='w-[152px] h-[142px] rounded-[6px] flex flex-col justify-center items-center shadow-[0px_2px_8px_0px_rgba(0,0,0,0.15)]'>meta</div>
          </div>

        </div>
      </Popup> */}
    </>
  )
}

ChannelsManagementPage.propTypes = {

}
ChannelsManagementPage.defaultProps = {
  platforms: [
    {
      name: "Facebook",
      icon: "fb",
      value: "fb"
    },
    {
      name: "Instagram",
      icon: "ig",
      value: "ig"
    },
    {
      name: "Whatsapp",
      icon: "whatsapp",
      value: "whatsapp"
    },
    {
      name: "Line",
      icon: "line",
      value: "line"
    },
    {
      name: "Wechat",
      icon: "wechat",
      value: "wechat"

    },
  ],
  defaultValue: {
    name: "Facebook",
    icon: "fb",
    value: "fb"
  },
}

export default ChannelsManagementPage


  // useEffect(() => {
  //   // getUserSubscribedChannels??
  // }, [token])
