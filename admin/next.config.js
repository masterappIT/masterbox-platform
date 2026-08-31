/** @type {import('next').NextConfig} */

const path = require('path')

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  sassOptions: {
    includePaths: [path.join(__dirname, '/src/styles')],
  },
  env: {
    GRAPHQL_CONNECTION_DEV: process.env.GRAPHQL_CONNECTION_DEV || 'http://localhost:4000/graphql',
    GRAPHQL_CONNECTION_PRODUCTION: process.env.GRAPHQL_CONNECTION_PRODUCTION,
    GRAPHQL_WS_CONNECTION_DEV: process.env.GRAPHQL_WS_CONNECTION_DEV || 'ws://localhost:4000/graphql',
    GRAPHQL_WS_CONNECTION_PRODUCTION: process.env.GRAPHQL_WS_CONNECTION_PRODUCTION,
    API_CONNECTION_DEV: process.env.API_CONNECTION_DEV || 'http://localhost:4000',
    API_CONNECTION_PRODUCTION: process.env.API_CONNECTION_PRODUCTION,
    NEXT_PUBLIC_ENABLE_DEV_BYPASS: process.env.NEXT_PUBLIC_ENABLE_DEV_BYPASS || 'false',  }
}




module.exports = nextConfig

