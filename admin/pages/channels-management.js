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
import { addChannels, selectChannels } from "../src/redux/slices/messagesSlices";


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





const apiUri = (process.env.NODE_ENV === 'production'
  ? process.env.API_CONNECTION_PRODUCTION
  : process.env.API_CONNECTION_DEV)

const platformNames = {
  fb: 'Facebook',
  ig: 'Instagram',
  whatsapp: 'Whatsapp',
  line: 'Line',
  wechat: 'Wechat',
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

  const allChannels = useSelector(selectChannels);

  const ChannelsFiltered = useMemo(() => {

    if (allChannels.length) {

      return allChannels?.filter(channel => channel.platform === currentPlatform);
    }
    return []
  }
    , [allChannels, currentPlatform])



  const tableData = useMemo(() => {

    const table = new tableFactory("channelsMgmt", ChannelsFiltered)

    return {
      header: table.getHeaders(),
      colsTemplate: table.getGridTemplate(),
      row: table.getRowsData()
    }

  }, [ChannelsFiltered])

  console.log('currentPlatform :>> ', currentPlatform);





  // let tableData = new tableFactory("channelsMgmt", allChannelsData)
  // let tableData = new tableFactory("channelsMgmt", dummyTableData.channelsMgmt)


  // 點擊傳接按鈕
  const handleConnect = async () => {
    if (isConnecting) return;

    const companyId = userInfo?.company_id;
    if (!companyId) {
      setConnectionError('找不到公司資料，無法進行串接。');
      return;
    }

    setConnectionError('');
    setIsConnecting(true);
    const baseUri = apiUri?.replace(/\/$/, '');
    if (!baseUri) {
      setConnectionError('未設定 Backend API 位址，無法進行串接。');
      setIsConnecting(false);
      return;
    }

    try {
      window.location.assign(`${baseUri}/meta/login?id=${encodeURIComponent(companyId)}`);
    } catch (error) {
      setConnectionError('串接頁面開啟失敗，請稍後再試。');
      setIsConnecting(false);
    }
  }


  // useEffect(() => {
  //   console.log('companyInfocompanyInfo',userInfo)
  //   if (userInfo) {
  //     dispatch(fetchCompanyInfo())
  //   }

  // }, [])



  // 重新點擊按鈕重設資料
  useEffect(() => {

    const path = new URL(window.location.href)
    //res from add channels
    if (path.search) {
      const channels = path.searchParams.getAll('channels[]').reduce((parsedChannels, value) => {
        try {
          const channel = JSON.parse(value)
          if (channel && typeof channel === 'object') parsedChannels.push(channel)
        } catch (error) {
          setConnectionError('串接回傳資料格式錯誤，部分頻道未加入。')
        }
        return parsedChannels
      }, [])

      if (channels.length) dispatch(addChannels(channels))
      router.replace('/channels-management')
    }

  }, [dispatch, router])



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
            {connectionError && <ContentText title={connectionError} color='alert' customStyles='mb-[12px]' />}
            <div className='flex items-center space-x-2'>
              <Headline size='normal' title='選擇平台' color='black-primary' />

              <Selector option={platforms} flex='row' customStyles='w-[288px]' defaultValue={defaultValue} onChange={handleSetChannelData} minHeight='none' />
            </div>

          </div>
        }
        withCheckbox={false}
        withEdit={false}
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
