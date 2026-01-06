import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  Bot, Send, Loader2, TrendingUp, PieChart, AlertTriangle,
  Sparkles, Copy, Check, History, MessageSquare, Calendar
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  templateId?: number;
}

interface ChatSession {
  sessionId: string;
  firstMessage: string;
  lastMessage: Date;
  messageCount: number;
}

export default function AIAssistantPage() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize session ID
  useEffect(() => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
  }, []);

  // Parse URL parameters for template
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templatePrompt = params.get('prompt');

    if (templatePrompt) {
      setInput(decodeURIComponent(templatePrompt));
      // Clear URL parameters after loading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load chat history for current session
  const { data: chatHistory = [] } = trpc.ai.getChatHistory.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  // Load recent sessions (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: allHistory = [] } = trpc.ai.getChatHistory.useQuery({});

  // Group history into sessions
  const recentSessions = allHistory.reduce((acc: ChatSession[], msg: any) => {
    const msgDate = new Date(msg.createdAt);
    if (msgDate < sevenDaysAgo) return acc;

    const existing = acc.find(s => s.sessionId === msg.sessionId);
    if (existing) {
      existing.messageCount++;
      if (msgDate > existing.lastMessage) {
        existing.lastMessage = msgDate;
      }
    } else if (msg.role === 'user') {
      acc.push({
        sessionId: msg.sessionId,
        firstMessage: msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : ''),
        lastMessage: msgDate,
        messageCount: 1,
      });
    }
    return acc;
  }, []).sort((a, b) => b.lastMessage.getTime() - a.lastMessage.getTime());

  // Mutations
  const saveChatMessage = trpc.ai.saveChatMessage.useMutation();

  const analyzePortfolio = trpc.ai.analyzePortfolio.useMutation({
    onSuccess: (data) => {
      const assistantMsg: Message = {
        role: "assistant",
        content: data.analysis,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save to database
      saveChatMessage.mutate({
        role: "assistant",
        content: data.analysis,
        sessionId,
      });

      scrollToBottom();
    },
    onError: (error) => {
      toast.error("Fehler bei der Analyse: " + error.message);
    },
  });

  const chat = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: Message = {
        role: "assistant",
        content: data.analysis,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save to database
      saveChatMessage.mutate({
        role: "assistant",
        content: data.analysis,
        sessionId,
      });

      scrollToBottom();
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = () => {
    if (!input.trim() || !sessionId) return;

    const userMsg: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);

    // Save to database
    saveChatMessage.mutate({
      role: "user",
      content: input,
      sessionId,
    });

    chat.mutate({ message: input });
    setInput("");
    scrollToBottom();
  };

  const handleQuickAction = (action: string) => {
    if (!sessionId) return;

    let message = "";
    switch (action) {
      case "analyze":
        message = "Analysiere mein Portfolio";
        setMessages(prev => [...prev, {
          role: "user",
          content: message,
          timestamp: new Date(),
        }]);

        saveChatMessage.mutate({
          role: "user",
          content: message,
          sessionId,
        });

        analyzePortfolio.mutate();
        scrollToBottom();
        return;
      case "risk":
        message = "Welche Risiken siehst du in meinem Portfolio?";
        break;
      case "diversification":
        message = "Wie gut ist mein Portfolio diversifiziert?";
        break;
      case "recommendations":
        message = "Welche Aktien würdest du mir zum Kauf empfehlen?";
        break;
    }

    setMessages(prev => [...prev, {
      role: "user",
      content: message,
      timestamp: new Date(),
    }]);

    saveChatMessage.mutate({
      role: "user",
      content: message,
      sessionId,
    });

    chat.mutate({ message });
    scrollToBottom();
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const loadSession = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    setShowHistory(false);

    // Load messages for this session
    const sessionMessages = allHistory
      .filter((msg: any) => msg.sessionId === selectedSessionId)
      .map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        templateId: msg.templateId,
      }));

    setMessages(sessionMessages);
    toast.success("Chat-Verlauf geladen");
  };

  const startNewChat = () => {
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setMessages([]);
    setShowHistory(false);
    toast.success("Neuer Chat gestartet");
  };

  const isLoading = analyzePortfolio.isPending || chat.isPending;

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* History Sidebar */}
        <div className={`lg:col-span-1 ${showHistory ? 'block' : 'hidden lg:block'}`}>
          <Card className="sticky top-4">
            <CardHeader className="p-3 sm:p-4 pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Verlauf (7 Tage)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-3"
                onClick={startNewChat}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Neuer Chat
              </Button>

              <ScrollArea className="h-[400px]">
                {recentSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Keine Chats</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentSessions.map((session) => (
                      <button
                        key={session.sessionId}
                        onClick={() => loadSession(session.sessionId)}
                        className={`w-full text-left p-2 rounded-lg hover:bg-accent transition-colors ${
                          session.sessionId === sessionId ? 'bg-accent' : ''
                        }`}
                      >
                        <p className="text-xs font-medium truncate">
                          {session.firstMessage}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {session.messageCount} Nachrichten
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(session.lastMessage).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          <div className="pt-12 sm:pt-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
                  <Bot className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
                  KI-Assistent
                </h1>
                <p className="text-muted-foreground text-xs sm:text-base mt-1">
                  Portfolio-Berater mit KI
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4 mr-2" />
                Verlauf
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            <Button
              variant="outline"
              className="h-auto py-2 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 touch-target"
              onClick={() => handleQuickAction("analyze")}
              disabled={isLoading}
            >
              <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <span className="text-xs sm:text-sm">Analysieren</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-2 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 touch-target"
              onClick={() => handleQuickAction("risk")}
              disabled={isLoading}
            >
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
              <span className="text-xs sm:text-sm">Risiken</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-2 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 touch-target"
              onClick={() => handleQuickAction("diversification")}
              disabled={isLoading}
            >
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              <span className="text-xs sm:text-sm">Diversifikation</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-2 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 touch-target"
              onClick={() => handleQuickAction("recommendations")}
              disabled={isLoading}
            >
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
              <span className="text-xs sm:text-sm">Empfehlungen</span>
            </Button>
          </div>

          {/* Chat Area */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="p-3 sm:p-6 pb-2">
              <CardTitle className="text-sm sm:text-lg">Chat</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Fragen zu deinem Portfolio
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
              <ScrollArea className="h-[250px] sm:h-[400px] pr-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Bot className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Willkommen beim KI-Assistenten!</p>
                    <p className="text-sm mt-2">
                      Nutze die Schnellaktionen oben oder stelle mir eine Frage zu deinem Portfolio.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 relative group ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : (
                            <p>{message.content}</p>
                          )}

                          {/* Copy Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                              message.role === "user"
                                ? "hover:bg-primary-foreground/20"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => handleCopyMessage(message.content, index)}
                          >
                            {copiedIndex === index ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>

                          <p className="text-xs opacity-70 mt-2">
                            {message.timestamp.toLocaleTimeString("de-DE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg p-4">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-2">
                <Textarea
                  placeholder="Stelle eine Frage zu deinem Portfolio..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[60px] resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="px-4"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Über den KI-Assistenten</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Der KI-Assistent analysiert dein Portfolio und gibt dir fundierte Empfehlungen.
                    Er berücksichtigt Diversifikation, Risiko und langfristige Anlagestrategien.
                    Die Empfehlungen sind keine Finanzberatung - bitte konsultiere einen Experten
                    für wichtige Anlageentscheidungen.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
