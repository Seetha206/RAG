import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Message, Conversation } from '../../types/chat.types';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
}

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  isLoading: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    createConversation(state, action: PayloadAction<Conversation>) {
      state.conversations.unshift(action.payload);
      state.activeConversationId = action.payload.id;
    },
    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
    },
    addMessage(
      state,
      action: PayloadAction<{ conversationId: string; message: Message }>
    ) {
      const conversation = state.conversations.find(
        (c) => c.id === action.payload.conversationId
      );
      if (conversation) {
        conversation.messages.push(action.payload.message);
        conversation.updatedAt = action.payload.message.timestamp;
        if (
          conversation.messages.length === 1 &&
          action.payload.message.role === 'user'
        ) {
          conversation.title =
            action.payload.message.content.slice(0, 40) +
            (action.payload.message.content.length > 40 ? '...' : '');
        }
      }
    },
    deleteConversation(state, action: PayloadAction<string>) {
      state.conversations = state.conversations.filter(
        (c) => c.id !== action.payload
      );
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = state.conversations[0]?.id ?? null;
      }
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    clearAllConversations(state) {
      state.conversations = [];
      state.activeConversationId = null;
    },
  },
});

export const {
  createConversation,
  setActiveConversation,
  addMessage,
  deleteConversation,
  setLoading,
  clearAllConversations,
} = chatSlice.actions;

export const selectConversations = (state: { chat: ChatState }) =>
  state.chat.conversations;
export const selectActiveConversationId = (state: { chat: ChatState }) =>
  state.chat.activeConversationId;
export const selectActiveConversation = (state: { chat: ChatState }) =>
  state.chat.conversations.find(
    (c) => c.id === state.chat.activeConversationId
  ) ?? null;
export const selectIsLoading = (state: { chat: ChatState }) =>
  state.chat.isLoading;

export default chatSlice.reducer;
