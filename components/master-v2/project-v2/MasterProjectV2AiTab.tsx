"use client";

import { useState } from "react";
import {
  ForteV2Panel,
  ForteV2PrimaryButton,
  ForteV2SearchInput,
  ForteV2TabShell,
  MasterProjectV2Toolbar,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function MasterProjectV2AiTab() {
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "שלום. זהו ממשק AI Assistant של Project V2. בשלב זה זו תצוגה בלבד — אין חיבור למודל AI.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const filteredMessages = messages.filter((message) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return message.content.toLowerCase().includes(q);
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const userMessage: AiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const assistantMessage: AiMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "תשובת AI תופיע כאן בשלב הבא. כרגע זה placeholder בלבד.",
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
  }

  return (
    <ForteV2TabShell
      workspace="project-v2-ai"
      title="AI Assistant"
      description="ממשק עוזר חכם לפרויקט — placeholder בשלב זה"
    >
      <MasterProjectV2Toolbar
        inner
        search={
          <ForteV2SearchInput
            value={search}
            onChange={setSearch}
            placeholder="חיפוש בהיסטוריה..."
          />
        }
        actions={<span className="text-xs text-forte-text-secondary font-medium">Preview</span>}
      />

      <ForteV2Panel className="flex-1 min-h-[24rem] flex flex-col p-0 overflow-hidden">
        <div className="fv2-chat-area space-y-3">
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user" ? "fv2-chat-bubble-user" : "fv2-chat-bubble-assistant"
              }
            >
              <p>{message.content}</p>
              <p className="text-[10px] opacity-70 mt-1.5">
                {new Date(message.createdAt).toLocaleString("he-IL")}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="fv2-chat-compose">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="כתוב הודעה..."
            className="fv2-input flex-1 min-w-[200px]"
          />
          <ForteV2PrimaryButton type="submit" size="sm">
            שלח
          </ForteV2PrimaryButton>
        </form>
      </ForteV2Panel>
    </ForteV2TabShell>
  );
}
