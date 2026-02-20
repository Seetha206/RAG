import { useState } from 'react';
import { Copy, Check, User, Sparkles, FileText, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../../types/chat.types';
import type { Source } from '../../types/rag.types';

interface MessageBubbleProps {
  message: Message;
}

function SourcesSection({
  sources,
  processingTimeMs,
}: {
  sources: Source[];
  processingTimeMs?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-3 border-t border-slate-200 pt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <FileText size={12} />
        <span>
          {sources.length} source{sources.length !== 1 ? 's' : ''}
        </span>
        {processingTimeMs !== undefined && (
          <span className="text-slate-400 ml-2">
            ({(processingTimeMs / 1000).toFixed(1)}s)
          </span>
        )}
        <ChevronDown
          size={12}
          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {sources.map((source, index) => (
            <div
              key={index}
              className="text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-700 font-medium">
                  {source.filename}
                </span>
                <span className="text-slate-400">
                  chunk {source.chunk_index} |{' '}
                  {(source.similarity_score * 100).toFixed(0)}% match
                </span>
              </div>
              <p className="text-slate-500 line-clamp-3">{source.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [isCopied, setIsCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className={`group flex gap-3 px-4 py-4 max-w-3xl mx-auto w-full ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={16} className="text-white" />
        </div>
      )}

      {/* Message content */}
      <div
        className={`relative max-w-[85%] ${
          isUser
            ? 'bg-primary rounded-2xl rounded-br-md px-4 py-2.5'
            : 'flex-1'
        }`}
      >
        <div className={isUser ? 'text-white text-[0.9375rem]' : 'prose'}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code(props) {
                  const { children, className, ref: _ref, ...rest } = props;
                  const match = /language-(\w+)/.exec(className ?? '');
                  const codeString = String(children).replace(/\n$/, '');

                  if (match) {
                    return (
                      <div className="relative group/code">
                        <div className="flex items-center justify-between bg-[#1e293b] rounded-t-lg px-4 py-1.5 border border-b-0 border-slate-300">
                          <span className="text-xs text-slate-400">
                            {match[1]}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(codeString);
                            }}
                            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                          >
                            <Copy size={12} />
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          {...rest}
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            borderBottomLeftRadius: '8px',
                            borderBottomRightRadius: '8px',
                            border: '1px solid #cbd5e1',
                            borderTop: 'none',
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }

                  return (
                    <code {...rest} className={className}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* RAG Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesSection
            sources={message.sources}
            processingTimeMs={message.processingTimeMs}
          />
        )}

        {/* Timestamp + Copy */}
        <div
          className={`flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
            isUser ? 'justify-end' : 'justify-start'
          }`}
        >
          <span className="text-[11px] text-slate-400">
            {formatTime(message.timestamp)}
          </span>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Copy message"
          >
            {isCopied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Avatar for user */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User size={16} className="text-primary" />
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
