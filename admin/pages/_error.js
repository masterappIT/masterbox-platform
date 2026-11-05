import { NotFoundView, ServerErrorView } from '../src/components/SystemPages'

function ErrorPage({ statusCode }) {
  return statusCode === 404 ? <NotFoundView /> : <ServerErrorView />
}

ErrorPage.getInitialProps = ({ res, err }) => ({ statusCode: res?.statusCode || err?.statusCode || 500 })

export default ErrorPage
