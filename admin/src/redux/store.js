import { configureStore } from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage'
import { combineReducers } from "redux";
import { persistReducer, persistStore } from 'redux-persist'
import logger from 'redux-logger'
import thunk from "redux-thunk"
import userSlices from './slices/userSlices';
import companySlices from './slices/companySlices';
import appSlice from './slices/appSlices';
import messagesSlice from './slices/messagesSlices';

const reducers = combineReducers({
  user: userSlices,
  company: companySlices,
  app: appSlice,
  messages: messagesSlice

});

const persistConfig = {
  key: 'root',
  storage
};





const rootReducer = (state, action) => {
  // when a logout action is dispatched it will reset redux state

  if (
    action.type === "user/removeAccessToken"

  ) {
    state = {};
  }

  return reducers(state, action);
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  devTools: process.env.NODE_ENV !== 'production',
  middleware: [thunk, logger]
});
export const persistor = persistStore(store)

export default store;