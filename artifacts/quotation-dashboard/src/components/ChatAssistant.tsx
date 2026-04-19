import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, User, ChevronDown, Minimize2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "wouter";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your AI Assistant. You can ask me to search for quotations, read details by supplier name, or read items in a quotation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    
    // Optimistic UI
    const updatedMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      const data = await response.json();
      
      if (data.message && data.message.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message.content }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "I'm sorry, I couldn't formulate a response." }]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "assistant", content: "*An error occurred while connecting to the AI.*" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="icon"
              className="w-14 h-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-105 active:scale-95"
              onClick={() => setIsOpen(true)}
            >
              <Bot className="w-7 h-7" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[85vh] flex flex-col bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-black/5"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-3 text-primary">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">QuoteXtract Assistant</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Online
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full hover:bg-muted/50"
                onClick={() => setIsOpen(false)}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex max-w-[85%] text-sm",
                    msg.role === "user" ? "justify-end ml-auto" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm shadow-md"
                        : "bg-muted text-foreground border border-border/50 rounded-tl-sm shadow-sm"
                    )}
                  >
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children }) => {
                              const isExternal = href?.startsWith("http");
                              const content = (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors border border-primary/20 my-1 cursor-pointer">
                                  {children}
                                  {isExternal ? <ExternalLink className="w-3 h-3" /> : null}
                                </span>
                              );

                              if (isExternal) {
                                return (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
                                    {content}
                                  </a>
                                );
                              }

                              return (
                                <Link href={href || "#"} className="no-underline">
                                  {content}
                                </Link>
                              );
                            },
                            p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="m-0 mb-2 pl-4 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="m-0 mb-2 pl-4 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                            code: ({ children }) => (
                              <code className="px-1.5 py-0.5 rounded bg-muted-foreground/10 font-mono text-[0.85em]">
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex max-w-[85%] justify-start">
                  <div className="px-4 py-2.5 bg-muted text-foreground border border-border/50 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-primary/50 block rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-primary/50 block rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-primary/50 block rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-card border-t border-border/50">
              <form
                onSubmit={handleSubmit}
                className="relative flex items-center overflow-hidden rounded-xl border border-border/50 bg-muted/30 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about a quotation..."
                  className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="mr-1 w-8 h-8 rounded-lg shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:bg-muted-foreground transition-all"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
