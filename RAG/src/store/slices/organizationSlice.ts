import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrgInfo, OrgMember } from '../../types/org.types';

interface OrganizationState {
  currentOrg: OrgInfo | null;
  orgList: OrgInfo[];
  members: OrgMember[];
  isLoading: boolean;
  error: string | null;
}

const initialState: OrganizationState = {
  currentOrg: null,
  orgList: [],
  members: [],
  isLoading: false,
  error: null,
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    setCurrentOrg(state, action: PayloadAction<OrgInfo | null>) {
      state.currentOrg = action.payload;
    },
    setOrgList(state, action: PayloadAction<OrgInfo[]>) {
      state.orgList = action.payload;
    },
    setMembers(state, action: PayloadAction<OrgMember[]>) {
      state.members = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearOrgState() {
      return { ...initialState };
    },
  },
});

export const { setCurrentOrg, setOrgList, setMembers, setLoading, setError, clearOrgState } =
  organizationSlice.actions;
export default organizationSlice.reducer;
