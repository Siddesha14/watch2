import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: string;
  senderSocketId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  localSocketId: string | null;
  unreadCount?: number;
  onClearUnread?: () => void;
}

const QUICK_EMOJIS = ['😊', '😂', '🔥', '😮', '🍿', '🎉', '❤️', '👏', '😱', '👎'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  localSocketId,
  unreadCount = 0,
  onClearUnread
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (onClearUnread && unreadCount > 0) {
      onClearUnread();
    }
  }, [messages, onClearUnread, unreadCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="w-full h-full flex flex-col glass rounded-2xl p-4 border border-white/5 shadow-2xl overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
        <h3 className="text-sm font-semibold tracking-wide text-gray-200 uppercase flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          Live Chat
        </h3>
        {unreadCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
            {unreadCount} New
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 px-4">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30 text-indigo-400" />
            <p className="text-xs">No messages yet. Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isLocal = msg.senderSocketId === localSocketId;
            const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div key={msg.id} className={`flex flex-col ${isLocal ? 'items-end' : 'items-start'}`}>
                {/* Username & Time */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-gray-400">
                  <span className={`font-semibold ${isLocal ? 'text-indigo-300' : 'text-purple-300'}`}>
                    {msg.username}
                  </span>
                  <span>•</span>
                  <span>{timeString}</span>
                </div>
                
                {/* Message Bubble */}
                <div className={`text-xs px-3.5 py-2 rounded-2xl max-w-[85%] break-words leading-relaxed border ${
                  isLocal 
                    ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none shadow-md shadow-indigo-600/10' 
                    : 'bg-slate-900/90 text-gray-200 border-white/5 rounded-tl-none shadow'
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 right-4 glass-premium p-3 rounded-xl border border-white/10 grid grid-cols-5 gap-2 shadow-2xl z-50 animate-in fade-in duration-100">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="text-lg hover:scale-125 transition-transform active:scale-95 p-1 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full text-xs bg-slate-950/80 border border-white/5 focus:border-indigo-500/50 rounded-xl py-2.5 pl-3 pr-10 outline-none text-white transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-400 active:scale-90 transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>
        
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
