import Head from 'next/head'
import '@fontsource/manrope/400'
import '@fontsource/manrope/500'
import '@fontsource/manrope/600'
import '@fontsource/manrope/700'
import '@fontsource/manrope/800'
import '@fontsource/dm-mono/400'
import '@fontsource/dm-mono/500'
import '../styles/globals.css'

export default function SuperAdminApp({ Component, pageProps }) {
  return <><Head><title>MasterBox Platform Console</title><link rel='icon' type='image/svg+xml' href='/favicon.svg' /><meta name='robots' content='noindex,nofollow' /></Head><Component {...pageProps} /></>
}
