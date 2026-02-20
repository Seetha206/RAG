import { useState, useRef, useCallback } from 'react';
import { ArrowRight, Search } from 'lucide-react';

interface InputBoxProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function InputBox({ onSend, isLoading }: InputBoxProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  return (
    <div className="relative flex items-center bg-white border-2 border-slate-200 rounded-2xl p-1.5 shadow-xl shadow-slate-200/50 focus-within:border-primary transition-all duration-300">
      <div className="pl-3 pr-2 text-slate-400">
        <Search size={22} />
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your documents..."
        rows={1}
        disabled={isLoading}
        className="flex-1 bg-transparent text-slate-900 placeholder-slate-400 resize-none px-2 py-2.5 text-[0.9375rem] leading-relaxed focus:outline-none max-h-[200px] disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="bg-primary hover:bg-primary/90 text-white p-2.5 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        aria-label="Send message"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

export default InputBox;
