import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import uiReducer from '../store/slices/uiSlice';
import organizationReducer from '../store/slices/organizationSlice';
import profileReducer from '../store/slices/profileSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  organization: organizationReducer,
  profile: profileReducer,
});

function createTestStore() {
  return configureStore({ reducer: rootReducer });
}

interface WrapperProps {
  children: ReactNode;
}

function AllProviders({ children }: WrapperProps) {
  const store = createTestStore();
  return (
    <Provider store={store}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  );
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
