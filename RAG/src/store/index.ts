import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import organizationReducer from './slices/organizationSlice';
import profileReducer from './slices/profileSlice';
import chatReducer from './slices/chatSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  organization: organizationReducer,
  profile: profileReducer,
  chat: chatReducer,
});

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'organization', 'chat'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
