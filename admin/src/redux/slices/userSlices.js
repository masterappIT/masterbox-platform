import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers } from '../../graphQL';
import { LOGIN, REFRESH_TOKEN } from '../../graphQL/account';
import { SUBSCRIBE_MESSAGE } from '../../graphQL/subscription';
import { handleMessagesSubscription } from './messagesSlices';
import { REGISTER_ACCOUNT } from '../../graphQL/account';


/**
 * @param {String} email
 * @param {String} password
 */
export const handleRegister = createAsyncThunk(
  'user/register',
  async ({ _id, email, password }, { dispatch }) => {
    try {
      const res = await apolloApiHelpers('mutation', REGISTER_ACCOUNT, { company_id: _id, email: email, password: password })
      const error = res.error
      if (error) {
        // if(error.includes('incorrect')) return new errorHandler(type.INVALID_PARAMS, 'email').throwAlert();
      }
      dispatch(saveUserInfo(res))
    } catch (error) {
      console.log('error', error)
    }


  }
)

export const handleTokenExpired = createAsyncThunk(
  'user/refreshToken',
  async (_, { dispatch, getState }) => {
    const { info, refreshToken } = getState().user
    const endSession = () => {
      window.sessionStorage.setItem('sessionExpired', '1')
      dispatch(removeAccessToken())
    }

    if (!refreshToken) {
      endSession()
      return null
    }

    const res = await apolloApiHelpers('mutation', REFRESH_TOKEN, { refreshToken, account_id: info._id, company_id: info.company_id })
    if (!res?.token) {
      // Keep the session through a network failure; only a rejected refresh token ends it.
      if (/refresh token|Account not found/i.test(res?.error || '')) endSession()
      return null
    }

    dispatch(saveTokens(res))
    return res.token
  }
)


export const handleLogin = createAsyncThunk(
  'user/login',
  async ({ email, password }, { dispatch }) => {
    const res = await apolloApiHelpers('mutation', LOGIN, { email: email.trim().toLowerCase() === 'test' ? 'test@masterbox.local' : email.trim().toLowerCase(), password })

    if (res?.error?.includes('Incorrect email or password')) return { error: 'login_invalid_credentials' }
    if (!res?.token) return { error: 'login_failed_try_later' }

    dispatch(saveUserInfo(res))
    dispatch(handleMessagesSubscription())
    return {}
  }
)

const initialState = {
  info: {

  },
  accessToken: null,
  refreshToken: null,
  error: null,
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {

    saveUserInfo: (state, { payload }) => {
      const { token, refreshToken, ...info } = payload;
      state.accessToken = token;
      state.refreshToken = refreshToken;
      state.info = info;
    },

    saveTokens: (state, { payload }) => {
      state.accessToken = payload.token;
      state.refreshToken = payload.refreshToken;
    },


    removeAccessToken: (state, action) => {
      // state.accessToken = null
    }
  }
})

export const { saveUserInfo, saveTokens, removeAccessToken } = userSlice.actions;

export const selectUserToken = (state) => state.user.accessToken;
export const selectUserInfo = (state) => state.user.info;


export default userSlice.reducer