import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface PopupState {
  isInviteMemberOpen: boolean;
  isDeleteConfirmOpen: boolean;
  isEditProfileOpen: boolean;
  isChangePasswordOpen: boolean;
  isCreateOrgOpen: boolean;
}

interface UiState {
  popups: PopupState;
  isGlobalLoading: boolean;
}

const initialState: UiState = {
  popups: {
    isInviteMemberOpen: false,
    isDeleteConfirmOpen: false,
    isEditProfileOpen: false,
    isChangePasswordOpen: false,
    isCreateOrgOpen: false,
  },
  isGlobalLoading: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openPopup(state, action: PayloadAction<keyof PopupState>) {
      state.popups[action.payload] = true;
    },
    closePopup(state, action: PayloadAction<keyof PopupState>) {
      state.popups[action.payload] = false;
    },
    closeAllPopups(state) {
      const keys = Object.keys(state.popups) as (keyof PopupState)[];
      keys.forEach((key) => {
        state.popups[key] = false;
      });
    },
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.isGlobalLoading = action.payload;
    },
  },
});

export const { openPopup, closePopup, closeAllPopups, setGlobalLoading } = uiSlice.actions;
export default uiSlice.reducer;
