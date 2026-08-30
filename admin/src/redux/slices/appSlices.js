import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  lang: '',
  loading: true
}

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    updateLoadingStatus: (state, action) => {
      state.loading = action.payload
    },

  }
})

export const { updateLoadingStatus } = appSlice.actions;

export const selectLoadingStatus = (state) => state.app.loading;


export default appSlice.reducer