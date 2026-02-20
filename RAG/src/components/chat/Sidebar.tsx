import { MessageSquarePlus, Trash2, MessageSquare } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  createConversation,
  setActiveConversation,
  deleteConversation,
  selectConversations,
  selectActiveConversationId,
} from '../../store/slices/chatSlice';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function Sidebar() {
  const dispatch = useAppDispatch();
  const conversations = useAppSelector(selectConversations);
  const activeId = useAppSelector(selectActiveConversationId);

  const handleNewChat = () => {
    const now = new Date().toISOString();
    dispatch(
      createConversation({
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: now,
        updatedAt: now,
      })
    );
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch(deleteConversation(id));
  };

  return (
    <aside className="w-64 h-full bg-white flex flex-col border-r border-slate-200 flex-shrink-0">
      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 hover:border-primary/30 transition-colors duration-200"
        >
          <MessageSquarePlus size={18} className="text-primary" />
          <span className="font-medium">New Chat</span>
        </button>
      </div>

      {/* Conversation List */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="text-xs text-slate-400 text-center mt-8 px-4">
            No conversations yet. Start a new chat!
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => dispatch(setActiveConversation(conv.id))}
                  className={`w-full group flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors duration-150 ${
                    activeId === conv.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare
                    size={16}
                    className={`flex-shrink-0 ${
                      activeId === conv.id
                        ? 'text-primary'
                        : 'text-slate-400'
                    }`}
                  />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 transition-all duration-150"
                    aria-label="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200">
        <p className="text-xs text-slate-400 text-center">SellBot AI Chat</p>
      </div>
    </aside>
  );
}

export default Sidebar;
