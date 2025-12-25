import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Bot, Send, Loader2, TrendingUp, PieChart, AlertTriangle, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  
  const analyzePortfolio = trpc.ai.analyzePortfolio.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.analysis,
        timestamp: new Date(),
      }]);
    },
    onError: (error) => {
      toast.error("Fehler bei der Analyse: " + error.message);
    },
  });
  
  const chat = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.analysis,
        timestamp: new Date(),
      }]);
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });
  
  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, {
      role: "user",
      content: input,
      timestamp: new Date(),
    }]);
    
    chat.mutate({ message: input });
    setInput("");
  };
  
  const handleQuickAction = (action: string) => {
    let message = "";
    switch (action) {
      case "analyze":
        setMessages(prev => [...prev, {
          role: "user",
          content: "Analysiere mein Portfolio",
          timestamp: new Date(),
        }]);
        analyzePortfolio.mutate();
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
    
    chat.mutate({ message });
  };
  
  const isLoading = analyzePortfolio.isPending || chat.isPending;
  
  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="pt-12 sm:pt-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
            <Bot className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
            KI-Assistent
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base mt-1">
            Portfolio-Berater mit KI
          </p>
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
                        className={`max-w-[80%] rounded-lg p-4 ${
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
    </Layout>
  );
}
