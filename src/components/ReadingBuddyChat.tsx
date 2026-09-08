import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Sparkles,
  Volume2,
  Bot,
  User,
  Zap,
  Brain,
  MessageSquare,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { ChatMessage, BuddyRole, Book, BookPage, ReaderSettings } from "../types";
import { playBrowserSpeech } from "../utils/audioPlayer";

interface ReadingBuddyChatProps {
  isOpen: boolean;
  onClose: () => void;
  buddyRole: BuddyRole;
  setBuddyRole: (role: BuddyRole) => void;
  currentBook?: Book;
  currentPage?: BookPage;
  settings: ReaderSettings;
  pendingPrompt?: { text: string; taskType: "general" | "complex" | "fast" } | null;
  clearPendingPrompt?: () => void;
  onBuddyChatCompleted?: () => void;
}

export const ReadingBuddyChat: React.FC<ReadingBuddyChatProps> = ({
  isOpen,
  onClose,
  buddyRole,
  setBuddyRole,
  currentBook,
  currentPage,
  settings,
  pendingPrompt,
  clearPendingPrompt,
  onBuddyChatCompleted,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "model",
      content:
        buddyRole === "owl"
          ? "Hoot-hoot! 🦉 I'm Barnaby, your reading tutor! I'm here to help you explore tricky words, answer questions, or quiz you on this story! What would you like to explore?"
          : "Roar-bubble! 🐲 I'm Pip the baby dragon! I love reading and hearing about magical stories! Tap any question or tell me what you think of this page!",
      timestamp: Date.now(),
      modelUsed: "gemini-3.5-flash",
      taskType: "general",
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [taskType, setTaskType] = useState<"general" | "complex" | "fast">("general");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle incoming quick prompts from story page
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.text) {
      handleSendMessage(pendingPrompt.text, pendingPrompt.taskType);
      clearPendingPrompt?.();
    }
  }, [pendingPrompt]);

  const handleSendMessage = async (
    textToSend?: string,
    overrideTaskType?: "general" | "complex" | "fast"
  ) => {
    const text = textToSend || inputMessage.trim();
    if (!text || isLoading) return;

    const chosenTaskType = overrideTaskType || taskType;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
      taskType: chosenTaskType,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          taskType: chosenTaskType,
          buddyRole,
          currentBook: currentBook
            ? { title: currentBook.title, level: currentBook.level }
            : undefined,
          currentPage: currentPage
            ? { pageNumber: currentPage.pageNumber, text: currentPage.text }
            : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.reply) {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "model",
          content: data.reply,
          timestamp: Date.now(),
          modelUsed: data.modelUsed,
          taskType: chosenTaskType,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onBuddyChatCompleted?.();
      } else {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "model",
          content:
            "Hoot! My owl feathers got a little ruffled. Let's try asking that again in a moment!",
          timestamp: Date.now(),
          modelUsed: "gemini-3.5-flash",
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err) {
      console.error("Chat request failed:", err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "model",
        content:
          "Hoot! I'm having trouble connecting to the story cloud. Let's try again in just a second!",
        timestamp: Date.now(),
        modelUsed: "gemini-3.5-flash",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeakMessage = (text: string) => {
    playBrowserSpeech(text, settings.voice);
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome-msg",
        role: "model",
        content:
          buddyRole === "owl"
            ? "Hoot-hoot! 🦉 I'm Barnaby! What new questions do you have about our story today?"
            : "Roar-bubble! 🐲 I'm Pip! Let's talk about the adventure!",
        timestamp: Date.now(),
        modelUsed: "gemini-3.5-flash",
        taskType: "general",
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div
      id="reading-buddy-chat-panel"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl border-l border-amber-200 flex flex-col animate-in slide-in-from-right duration-300"
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
            {buddyRole === "owl" ? "🦉" : "🐲"}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-display font-bold text-base">
              <span>{buddyRole === "owl" ? "Barnaby the Book Owl" : "Pip the Reading Dragon"}</span>
            </div>
            <p className="text-[11px] text-indigo-100 font-medium">
              {buddyRole === "owl" ? "Wise Phonics & Story Tutor" : "Playful Story Companion"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="reset-chat-btn"
            onClick={resetChat}
            className="p-2 rounded-xl text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
            title="Start new conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            id="close-chat-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-indigo-100 hover:text-white hover:bg-white/10 transition-colors"
            title="Close reading buddy"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Role & Model Mode Selector */}
      <div className="p-3 bg-indigo-50 border-b border-indigo-100 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-indigo-950">Switch Buddy:</span>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-indigo-200">
            <button
              onClick={() => setBuddyRole("owl")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                buddyRole === "owl"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-indigo-900 hover:bg-indigo-50"
              }`}
            >
              🦉 Barnaby
            </button>
            <button
              onClick={() => setBuddyRole("dragon")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                buddyRole === "dragon"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-indigo-900 hover:bg-indigo-50"
              }`}
            >
              🐲 Pip
            </button>
          </div>
        </div>

        {/* Task Complexity / Model Routing Affordance */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-200/50">
          <span className="text-[11px] font-bold text-indigo-900">Task Mode:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTaskType("fast")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                taskType === "fast"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-stone-600 border border-stone-200"
              }`}
              title="Fast Phonics & Word Meaning"
            >
              <Zap className="w-3 h-3" />
              <span>Fast Phonics</span>
            </button>
            <button
              onClick={() => setTaskType("general")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                taskType === "general"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-stone-600 border border-stone-200"
              }`}
              title="Friendly Conversation & Story Chat"
            >
              <MessageSquare className="w-3 h-3" />
              <span>General</span>
            </button>
            <button
              onClick={() => setTaskType("complex")}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
                taskType === "complex"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-stone-600 border border-stone-200"
              }`}
              title="Deep Reading Quiz & Creative Thinking"
            >
              <Brain className="w-3 h-3" />
              <span>Deep Quiz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${
                msg.role === "user"
                  ? "bg-amber-500 text-white"
                  : "bg-indigo-100 text-indigo-700 border border-indigo-200"
              }`}
            >
              {msg.role === "user" ? <User className="w-4 h-4" /> : buddyRole === "owl" ? "🦉" : "🐲"}
            </div>

            {/* Bubble */}
            <div className="max-w-[80%] space-y-1">
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "bg-amber-500 text-white rounded-tr-xs"
                    : "bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs"
                }`}
              >
                {msg.content}
              </div>

              {/* Footer info & audio speech button for assistant replies */}
              {msg.role === "model" && (
                <div className="flex items-center justify-between px-1 text-[10px] text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[10px] border border-indigo-100">
                      {msg.taskType === "fast"
                        ? "⚡ Quick Phonics"
                        : msg.taskType === "complex"
                        ? "🧠 Story Quiz"
                        : "💬 Reading Buddy"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSpeakMessage(msg.content)}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold p-1 rounded hover:bg-indigo-50 transition-colors"
                    title="Read buddy response aloud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm shrink-0">
              {buddyRole === "owl" ? "🦉" : "🐲"}
            </div>
            <div className="p-3 rounded-2xl bg-white border border-stone-200 text-xs text-stone-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Finding the best answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Pills */}
      <div className="p-2.5 bg-white border-t border-stone-100 flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() =>
            handleSendMessage(
              "Can you give me a fun reading quiz about this page?",
              "complex"
            )
          }
          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200 whitespace-nowrap transition-colors"
        >
          ❓ Story Quiz
        </button>
        <button
          onClick={() =>
            handleSendMessage(
              "How do I sound out tricky words phonetically?",
              "fast"
            )
          }
          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 whitespace-nowrap transition-colors"
        >
          ⚡ Phonics Help
        </button>
        <button
          onClick={() =>
            handleSendMessage(
              "What do you imagine could happen next in this story?",
              "complex"
            )
          }
          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200 whitespace-nowrap transition-colors"
        >
          🌟 What happens next?
        </button>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-amber-200 flex items-center gap-2"
      >
        <input
          type="text"
          id="buddy-chat-input"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={`Ask ${buddyRole === "owl" ? "Barnaby" : "Pip"} anything...`}
          className="flex-1 text-xs sm:text-sm py-2.5 px-3.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="submit"
          id="send-chat-btn"
          disabled={!inputMessage.trim() || isLoading}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
