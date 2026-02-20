import { Sparkles, HelpCircle, Settings, User } from 'lucide-react';
import Sidebar from './components/chat/Sidebar';
import ChatWindow from './components/chat/ChatWindow';

function App() {
  return (
    <div className="flex flex-col h-screen bg-chat-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-white p-1.5 rounded-lg flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <h2 className="text-slate-900 text-lg font-bold tracking-tight">
            SellBot AI
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <HelpCircle size={20} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <Settings size={20} />
          </button>
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChatWindow />
      </div>
    </div>
  );
}

export default App;
