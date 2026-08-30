import Head from 'next/head'
import '../styles/globals.css'

export default function SuperAdminApp({ Component, pageProps }) {
  return <><Head><title>MasterBox Platform Console</title><meta name='robots' content='noindex,nofollow' /></Head><Component {...pageProps} /></>
}
