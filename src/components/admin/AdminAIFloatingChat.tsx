import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageSquare,
  X,
  Send,
  RotateCcw,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { askAdminAIAssistant } from "@/lib/api/ai.functions";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  timestamp?: string;
}

const QUICK_PROMPTS = [
  "Bagaimana ringkasan omset dan laba toko saat ini?",
  "Jersey mana saja yang stoknya menipis (3 pcs atau kurang)?",
  "Berapa pesanan yang perlu segera diproses dan dikemas?",
  "Apa saja produk terlaris di katalog AA Jersey?",
];

// Helper perender Markdown sederhana, aman, dan rapi untuk chat bubble
function RenderChatMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const renderInline = (str: string) => {
    // Jika ada tanda ** ganjil (tidak tertutup), tutup otomatis di akhir string
    let normalized = str;
    const asteriskMatches = normalized.match(/\*\*/g);
    if (asteriskMatches && asteriskMatches.length % 2 !== 0) {
      normalized += "**";
    }

    // Parsing **bold**
    const parts = normalized.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-bold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key} className="space-y-1.5 my-2 pl-1">
          {currentList.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs sm:text-[13px] leading-relaxed">
              <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1">{renderInline(item)}</div>
            </li>
          ))}
        </ul>,
      );
      currentList = [];
    }
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(`list-before-empty-${lineIndex}`);
      return;
    }

    // Heading level 2/3 (### or ##)
    if (trimmed.startsWith("### ")) {
      flushList(`list-before-h3-${lineIndex}`);
      elements.push(
        <h4
          key={`h3-${lineIndex}`}
          className="font-bold text-xs sm:text-[13px] text-foreground mt-3 mb-1 uppercase tracking-wider"
        >
          {trimmed.replace(/^###\s+/, "")}
        </h4>,
      );
    } else if (trimmed.startsWith("## ")) {
      flushList(`list-before-h2-${lineIndex}`);
      elements.push(
        <h3
          key={`h2-${lineIndex}`}
          className="font-extrabold text-sm text-foreground mt-3 mb-1 tracking-tight"
        >
          {trimmed.replace(/^##\s+/, "")}
        </h3>,
      );
    } else if (
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      /^\d+\.\s/.test(trimmed)
    ) {
      // List item
      const itemText = trimmed.replace(/^([-*]|\d+\.)\s+/, "");
      currentList.push(itemText);
    } else {
      flushList(`list-before-p-${lineIndex}`);
      elements.push(
        <p
          key={`p-${lineIndex}`}
          className="text-xs sm:text-[13px] leading-relaxed text-foreground/90 my-1"
        >
          {renderInline(trimmed)}
        </p>,
      );
    }
  });

  flushList("list-end");

  return <div className="space-y-0.5">{elements}</div>;
}

const STORAGE_KEY = "aa_jersey_admin_ai_chat_history";
const MODEL_KEY = "aa_jersey_admin_ai_model";
const IS_OPEN_KEY = "aa_jersey_admin_ai_chat_open";

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Halo Admin! Saya asisten toko AA Jersey. Ada yang ingin Anda tanyakan atau analisis seputar data produk, stok, laporan keuangan, atau pesanan toko hari ini?",
  modelUsed: "EdgeOne AI",
  timestamp: new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }),
};

export function AdminAIFloatingChat() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(IS_OPEN_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [input, setInput] = useState("");

  const [activeModel, setActiveModel] = useState<string>(() => {
    if (typeof window === "undefined") return "EdgeOne AI";
    try {
      return localStorage.getItem(MODEL_KEY) || "EdgeOne AI";
    } catch {
      return "EdgeOne AI";
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [DEFAULT_WELCOME_MESSAGE];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error("Gagal membaca chat history dari localStorage", err);
    }
    return [DEFAULT_WELCOME_MESSAGE];
  });

  // Simpan riwayat pesan setiap kali ada update pesan
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error("Gagal menyimpan chat history ke localStorage", err);
    }
  }, [messages]);

  // Simpan model aktif yang sedang digunakan
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(MODEL_KEY, activeModel);
    } catch {}
  }, [activeModel]);

  // Simpan status open/close saat navigasi antar menu admin
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(IS_OPEN_KEY, String(isOpen));
    } catch {}
  }, [isOpen]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const chatMutation = useMutation({
    mutationFn: async (userText: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userText,
        timestamp: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setInput("");

      // Kirim history ke server function
      const res = await askAdminAIAssistant({
        data: {
          messages: updatedHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      return res;
    },
    onSuccess: (data) => {
      if (data?.modelUsed) {
        // Bersihkan nama model untuk tampilan badge
        const cleanName = data.modelUsed.replace("@makers/", "");
        setActiveModel(cleanName);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          modelUsed: data.modelUsed ? data.modelUsed.replace("@makers/", "") : "EdgeOne AI",
          timestamp: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    },
    onError: (err: any) => {
      console.error("[AdminAIFloatingChat] Error sending message:", err);
      toast.error(err.message || "Gagal menghubungi layanan asisten");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "Maaf, terjadi kendala saat menghubungkan ke server asisten. Silakan periksa koneksi internet atau coba beberapa saat lagi.",
          timestamp: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    },
  });

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || chatMutation.isPending) return;
    chatMutation.mutate(query);
  };

  const handleResetChat = () => {
    const initialResetMsg: ChatMessage = {
      id: `welcome-reset-${Date.now()}`,
      role: "assistant",
      content:
        "Percakapan telah di-reset. Apa yang ingin Anda tanyakan atau analisis seputar toko AA Jersey hari ini?",
      modelUsed: activeModel || "EdgeOne AI",
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([initialResetMsg]);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([initialResetMsg]));
      } catch (err) {
        console.error("Gagal mereset localStorage", err);
      }
    }
    toast.success("Riwayat percakapan berhasil di-reset");
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom Right) */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-3 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Buka Asisten Toko AA Jersey"
            className="group relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-neutral-900/95 dark:bg-neutral-800/95 backdrop-blur-md text-white rounded-full shadow-lg hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/15 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
          >
            {/* Status Pulse Indicator */}
            <span className="relative flex size-2 sm:size-2.5">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 sm:size-2.5 bg-emerald-500" />
            </span>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <MessageSquare className="size-3.5 sm:size-4 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-[11px] sm:text-xs font-semibold sm:font-bold tracking-tight">
                Tanya Asisten
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Jendela Asisten Toko AA Jersey"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-3 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[420px] h-[520px] max-h-[calc(100vh-6rem)] bg-card text-card-foreground border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-muted/60 border-b border-border flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <MessageSquare className="size-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-tight truncate">
                    Asisten Toko AA Jersey
                  </h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  Model: {activeModel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reset Percakapan"
                aria-label="Reset Percakapan"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup (Esc)"
                aria-label="Tutup Jendela Asisten"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm scroll-smooth"
          >
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    isUser ? "ml-auto items-end" : "mr-auto items-start",
                  )}
                >
                  <div
                    className={cn(
                      "p-3 rounded-2xl shadow-xs transition-all",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-xs font-medium"
                        : "bg-muted/70 text-foreground border border-border/80 rounded-bl-xs",
                    )}
                  >
                    {isUser ? (
                      <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      <RenderChatMessage text={msg.content} />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-muted-foreground">
                    {msg.timestamp && <span>{msg.timestamp}</span>}
                    {!isUser && msg.modelUsed && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[9px]">{msg.modelUsed}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing / Loading Indicator */}
            {chatMutation.isPending && (
              <div className="mr-auto max-w-[85%] flex items-start gap-2">
                <div className="p-3 bg-muted/70 text-foreground border border-border/80 rounded-2xl rounded-bl-xs flex items-center gap-2">
                  <Loader2 className="size-3.5 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground animate-pulse">
                    Menganalisis data AA Jersey...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && !chatMutation.isPending && (
            <div className="px-3 py-2.5 bg-muted/30 border-t border-border/60 shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Pertanyaan Cepat:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="text-[11px] text-left px-2.5 py-1.5 rounded-lg bg-background hover:bg-muted border border-border/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer truncate max-w-full"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-card border-t border-border shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Tanyakan stok, pesanan, omset, atau laporan toko..."
                rows={1}
                disabled={chatMutation.isPending}
                className="flex-1 min-h-[38px] max-h-24 p-2 text-xs sm:text-[13px] bg-muted/40 rounded-xl border border-input focus:border-primary focus:ring-1 focus:ring-primary resize-none outline-none transition-all placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatMutation.isPending}
                aria-label="Kirim Pesan"
                className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 shadow-xs"
              >
                <Send className="size-4" />
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3 text-primary" />
                Data terhubung langsung dengan database AA Jersey
              </span>
              <span>Tekan Enter untuk kirim</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
