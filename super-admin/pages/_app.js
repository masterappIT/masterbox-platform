import Head from 'next/head'
import '../styles/globals.css'

export default function SuperAdminApp({ Component, pageProps }) {
  return <><Head><title>MasterBox Platform Console</title><link rel='icon' type='image/svg+xml' href='/favicon.svg' /><meta name='robots' content='noindex,nofollow' /></Head><Component {...pageProps} /></>
}
