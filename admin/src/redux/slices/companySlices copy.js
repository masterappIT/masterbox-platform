import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apolloApiHelpers } from '../../graphQL';
import { COMPANY, REGISTERCOMPANY, UPDATE_COMPANY_INFO } from '../../graphQL/company';

// import { getCookie } from 'cookies-next';
import store from '../store';
import { handleRegister } from './userSlices';


export const registerCompanyInfo = createAsyncThunk(
  //? 
  'company/registerCompanyInfo',
  async (data, { dispatch }) => {

    // const companyId = store.getState().user.info.company_id;
    // if (!companyId) return alert('miss company id')
    const res = await apolloApiHelpers('mutation', REGISTERCOMPANY, data)
    if (res.error) {
      return alert(res.error)
    }
    dispatch(saveCompanyInfoFromServer(res))
    const { _id } = res
    const { email, password } = data
    dispatch(handleRegister({ _id, email, password }))

  }
)

export const fetchCompanyInfo = createAsyncThunk(
  'company/fetchCompanyInfo',
  async (_, { dispatch }) => {

    const companyId = store.getState().user.info.company_id;
    if (!companyId) return alert('miss company id')
    const res = await apolloApiHelpers('query', COMPANY, { id: companyId })

    if (res.error) {
      return alert(res.error)
    }
    dispatch(saveCompanyInfoFromServer(res))
  }
)


export const updateCompanyInfo = createAsyncThunk(
  'company/updateCompanyInfo',
  async (data, { dispatch }) => {

    const companyId = store.getState().user.info.company_id;

    const res = await apolloApiHelpers('mutation', UPDATE_COMPANY_INFO, {
      "updateCompanyInput": {
        _id: companyId, ...data
      }
    })

    if (res.error) {
      return alert(res.error)
    }
    dispatch(saveCompanyInfoFromServer(res))

    alert('儲存成功')


  }
)


const initialState = {
  info: {
    basic: {

    },
     //功能權限
     permissions:{
  
    },
  },
  channels: [],
  //自定義標籤
  labels: [],
  error: null,
}



export const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {

    saveCompanyInfoFromServer: (state, { payload }) => {

      const info = { ...payload }

      state.channels = info.channels;

      delete info.channels

      state.labels = info.labels

      delete info.labels;

      state.info.principal_info = info.principal_info

      delete info.principal_info;

      state.info.subscription.plan = info.subscription?.name;
      state.info.subscription.period = `${info.subscription?.period?.start} - ${info.subscription?.period?.end}`

      delete info.subscription;

      state.info.basic = info

    },
    // old
    saveCompanyInfo: (state, action) => {
      state.info = action.payload;
    },


    saveCompanyData: (state, action) => {
      state.info = action.payload
    },
    saveCompanyUrl: (state, action) => {
      state.info.url = action.payload
    },
    saveCompanyBanners: (state, action) => {
      state.banners = action.payload
    },

    // extraReducers: {
    //   [fetchCustomTemplateData.fulfilled]: (state, action) => {
    //     state.customTemplateData = action.payload
    //   }
    // }



  }
})

export const { saveCompanyInfo, saveCompanyBanners, saveCompanyInfoFromServer } = companySlice.actions;

export const selectCompanyInfo = (state) => state.company?.info;
export const selectCompanyBanners = (state) => state.company.banners;
export const selectCompanyUrl = (state) => state.company?.info?.url;


export default companySlice.reducer

