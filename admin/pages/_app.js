import '/src/styles/globals.scss'
import React, { useState, useEffect } from 'react';
import Sidebar from '/src/stories/components/Sidebar'
import HeaderBar from '/src/stories/components/HeaderBar'
import { PersistGate } from 'redux-persist/integration/react';
import store, { persistor } from "/src/redux/store"
import { Provider, useSelector } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import client from '/src/graphQL/index';
import { useRouter } from 'next/router';
import { handleMessagesSubscription } from '../src/redux/slices/messagesSlices';
import { selectUserToken, selectUserInfo } from '../src/redux/slices/userSlices';
import { pathInfo } from '../src/utils/pathInfo';
import Head from 'next/head';
import '../i18n';

function AppContent({ Component, pageProps }) {
  const [showSidebarHeaderBar, setShowSidebarHeaderBar] = useState(false);
  const [layoutSet, setLayoutSet] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const pathname = router.pathname;
  const token = useSelector(selectUserToken);
  const userInfo = useSelector(selectUserInfo);
  const isManagementPage = pathInfo.some(({ path }) => path === pathname && path !== '/');
  const isCustomBotPage = pathname === '/bot-messaging';
  const isAdmin = String(userInfo?.role || '').toLowerCase() === 'admin';
  const isPlatformAdminPage = pathname === '/platform-admin';
  const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(String(userInfo?.role || '').toLowerCase());
  const canPreviewPlatformAdmin = isPlatformAdminPage && process.env.NODE_ENV === 'development' && router.query.preview === '1';

  useEffect(() => {
    setLayoutSet(pathname !== '/auth');
    setShowSidebarHeaderBar(pathname !== '/auth');
  }, [pathname]);

  useEffect(() => {
    const canPreviewBot = isCustomBotPage && process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === 'true';
    if (!token && !canPreviewBot && !canPreviewPlatformAdmin) {
      router.replace('/auth');
      return;
    }
    if (isPlatformAdminPage && !isPlatformAdmin && !canPreviewPlatformAdmin) {
      router.replace('/');
      return;
    }
    if (isManagementPage && !isAdmin && !canPreviewBot) {
      router.replace('/');
      return;
    }
    if (userInfo?._id) store.dispatch(handleMessagesSubscription());
  }, [token, isAdmin, isPlatformAdmin, isPlatformAdminPage, canPreviewPlatformAdmin, isManagementPage, isCustomBotPage, pathname, router, userInfo?._id]);

  useEffect(() => {
    const stopScrolling = (e) => e.preventDefault();
    window.addEventListener('touchmove', stopScrolling, { passive: false });
    return () => window.removeEventListener('touchmove', stopScrolling);
  }, []);

  return <>
    <Head><meta httpEquiv='Expires' content='0' /><meta httpEquiv='Cache-Control' content='no-cache' /><meta httpEquiv='Pragma' content='no-cache' /></Head>
    <ApolloProvider client={client}>
      <div className='flex flex-row w-screen h-screen overflow-hidden'>
        <div className={`z-[20] hidden sm:block transition-all duration-200 ${sidebarCollapsed ? 'w-[64px] min-w-[64px]' : 'w-[208px] min-w-[208px]'}`} style={showSidebarHeaderBar ? {} : { display: 'none' }}><Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} /></div>
        <div className='flex flex-col w-full overflow-hidden'>
          <HeaderBar customStyles='z-[10]' showSidebarHeaderBar={showSidebarHeaderBar} />
          <div className={`${showSidebarHeaderBar ? 'w-full sm:h-[calc(100vh-68px)]' : 'w-[100vw]'} h-[100vh] ${pathname === '/' || pathname === '/messenger' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${layoutSet && pathname !== '/' && pathname !== '/messenger' ? 'p-[32px] bg-bg_tertiary' : ''}`}><Component {...pageProps} /></div>
        </div>
      </div>
    </ApolloProvider>
  </>;
}

function MyApp({ Component, pageProps }) {
  return <Provider store={store}><PersistGate loading={null} persistor={persistor}><AppContent Component={Component} pageProps={pageProps} /></PersistGate></Provider>;
}

if (typeof window !== 'undefined' && window.Cypress) window.store = store;

export default MyApp
