import '/src/styles/globals.scss'
import React, { useState, useEffect } from 'react';
import Sidebar from '/src/stories/components/Sidebar'
import HeaderBar from '/src/stories/components/HeaderBar'
import Loading from '/src/stories/components/Loading'
import { PersistGate } from 'redux-persist/integration/react';
import store, { persistor } from "/src/redux/store"
import { Provider, useSelector } from 'react-redux';
import { ApolloProvider } from '@apollo/client';
import client from '/src/graphQL/index';
import { useRouter } from 'next/router';
import { handleMessagesSubscription, stopMessagesSubscription } from '../src/redux/slices/messagesSlices';
import { selectUserToken, selectUserInfo } from '../src/redux/slices/userSlices';
import { pathInfo } from '../src/utils/pathInfo';
import Head from 'next/head';
import '../i18n';

// These pages keep their own look; everything else gets the shared finish in _Polish.module.scss.
const UNPOLISHED_PAGES = ['/auth', '/chat-management', '/platform-admin', '/404'];

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const pathname = router.pathname;
  // The design's 404 fills the screen; a 500 keeps the menu so people can move on.
  const isFullScreenPage = pathname === '/auth' || pathname === '/404';
  // PersistGate only mounts this on the client, so the menu can be there from the first paint.
  const [showSidebarHeaderBar, setShowSidebarHeaderBar] = useState(!isFullScreenPage);
  const [layoutSet, setLayoutSet] = useState(!isFullScreenPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const token = useSelector(selectUserToken);
  const userInfo = useSelector(selectUserInfo);
  const isSystemPage = ['/404', '/500', '/_error'].includes(pathname);
  const isManagementPage = pathInfo.some(({ path }) => path === pathname && path !== '/');
  const isCustomBotPage = pathname === '/bot-messaging';
  const isAdmin = String(userInfo?.role || '').toLowerCase() === 'admin';
  const isPlatformAdminPage = pathname === '/platform-admin';
  const isPlatformAdmin = ['super_admin', 'platform_admin'].includes(String(userInfo?.role || '').toLowerCase());
  const canPreviewPlatformAdmin = isPlatformAdminPage && process.env.NODE_ENV === 'development' && router.query.preview === '1';

  useEffect(() => {
    setLayoutSet(!isFullScreenPage);
    setShowSidebarHeaderBar(!isFullScreenPage);
  }, [isFullScreenPage]);

  useEffect(() => {
    if (!token) stopMessagesSubscription();
  }, [token]);

  useEffect(() => {
    if (isSystemPage) return;
    const canPreviewBot = isCustomBotPage && process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS === 'true';
    if (!token && pathname !== '/auth' && !canPreviewBot && !canPreviewPlatformAdmin) {
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
  }, [isSystemPage, token, isAdmin, isPlatformAdmin, isPlatformAdminPage, canPreviewPlatformAdmin, isManagementPage, isCustomBotPage, pathname, router, userInfo?._id]);

  return <>
    <Head><link rel='icon' type='image/svg+xml' href='/favicon.svg' /><meta httpEquiv='Expires' content='0' /><meta httpEquiv='Cache-Control' content='no-cache' /><meta httpEquiv='Pragma' content='no-cache' /></Head>
    <ApolloProvider client={client}>
      <div className='flex flex-row w-full h-[var(--app-height)] overflow-hidden'>
        <div className={`z-[20] hidden sm:block transition-all duration-200 ${sidebarCollapsed ? 'w-[64px] min-w-[64px]' : 'w-[208px] min-w-[208px]'}`} style={showSidebarHeaderBar ? {} : { display: 'none' }}><Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} /></div>
        <div className='flex flex-col flex-1 min-w-0 overflow-hidden'>
          <HeaderBar customStyles='z-[10]' showSidebarHeaderBar={showSidebarHeaderBar} />
          <div className={`w-full flex-1 min-h-0 ${pathname === '/' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden overscroll-contain'} ${layoutSet && pathname !== '/' ? 'p-[16px] sm:p-[32px] bg-bg_tertiary' : ''} ${UNPOLISHED_PAGES.includes(pathname) ? '' : 'ui-polish'}`}><Component {...pageProps} /></div>
        </div>
      </div>
    </ApolloProvider>
  </>;
}

function MyApp({ Component, pageProps, router }) {
  const bootScreen = router.pathname === '/auth' ? null : <div className='app-boot'><Loading /></div>;
  return <Provider store={store}><PersistGate loading={bootScreen} persistor={persistor}><AppContent Component={Component} pageProps={pageProps} /></PersistGate></Provider>;
}

if (typeof window !== 'undefined' && window.Cypress) window.store = store;

export default MyApp
