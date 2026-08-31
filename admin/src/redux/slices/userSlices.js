import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers } from '../../graphQL';
import { LOGIN, REFRESH_TOKEN } from '../../graphQL/account';
import { SUBSCRIBE_MESSAGE } from '../../graphQL/subscription';
import { handleMessagesSubscription } from './messagesSlices';
import { REGISTER_ACCOUNT } from '../../graphQL/account';
import errorHandler, { type } from '../../utils/errorHandler';


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
  async (_, { dispatch }) => {
    try {

      const { info, refreshToken } = (await import('../store')).default.getState().user

      const res = await apolloApiHelpers('mutation', REFRESH_TOKEN, { refreshToken, account_id:info._id, company_id: info.company_id })
      const error = res.error
      if (error) {
        console.log('error', error)

        // if(error.includes('incorrect')) return new errorHandler(type.INVALID_PARAMS, 'email').throwAlert();
      }
      dispatch(saveUserInfo(res))
    } catch (error) {
      console.log('error', error)
    }


  }
)


export const handleLogin = createAsyncThunk(
  'user/login',
  async ({ email, password }, { dispatch }) => {


    try {

      const res = await apolloApiHelpers('mutation', LOGIN, { email: email.trim().toLowerCase() === 'test' ? 'test@masterbox.local' : email.trim().toLowerCase(), password })

    const error = res?.error
      if (error) {
        if (error.includes('Incorrect email')) return new errorHandler(type.INVALID_PARAMS, 'email').throwAlert();
        if (error.includes('Incorrect password')) return new errorHandler(type.INVALID_PARAMS, 'password').throwAlert();
        throw new Error(error);
      }

      if (!res?.token) throw new Error('登入失敗，伺服器未提供驗證 Token')

      dispatch(saveUserInfo(res))
      return dispatch(handleMessagesSubscription())

    } catch (error) {
      console.log('handleLogin_error', error)
    }

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


    removeAccessToken: (state, action) => {
      // state.accessToken = null
    }
  }
})

export const { saveUserInfo, removeAccessToken } = userSlice.actions;

export const selectUserToken = (state) => state.user.accessToken;
export const selectUserInfo = (state) => state.user.info;


export default userSlice.reducer