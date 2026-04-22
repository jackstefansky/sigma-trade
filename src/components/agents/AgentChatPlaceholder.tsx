'use client';

export default function AgentChatPlaceholder() {
  return (
    <div className="flex flex-col h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center">
          <span className="text-gray-700 text-lg">✦</span>
        </div>
        <p className="font-mono text-sm text-gray-500 text-center">
          Select an agent to start chatting
        </p>
        <p className="font-mono text-xs text-gray-700 text-center">
          News Agent available · 4 agents coming in Phase 2
        </p>
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          <input
            type="text"
            disabled
            placeholder="Message agent..."
            className="flex-1 bg-bg-panel border border-border-subtle rounded px-3 py-2 font-mono text-sm text-gray-600 placeholder-gray-700 cursor-not-allowed outline-none"
          />
          <button
            disabled
            className="px-3 py-2 bg-border-subtle text-gray-700 rounded font-mono text-xs cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
