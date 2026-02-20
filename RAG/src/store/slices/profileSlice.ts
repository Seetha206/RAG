import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserInfo } from '../../types/auth.types';

interface ProfileState {
  profile: UserInfo | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ProfileState = {
  profile: null,
  isLoading: false,
  error: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<UserInfo | null>) {
      state.profile = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearProfile() {
      return { ...initialState };
    },
  },
});

export const { setProfile, setLoading, setError, clearProfile } = profileSlice.actions;
export default profileSlice.reducer;
