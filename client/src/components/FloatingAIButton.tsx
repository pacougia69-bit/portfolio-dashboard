/**
 * Floating AI Chat Button
 * Quick access to AI assistant with template selection
 */

import { useState } from 'react';
import { Bot, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

export default function FloatingAIButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: templates = [], isLoading } = trpc.ai.listTemplates.useQuery();

  const handleTemplateClick = (template: any) => {
    // Navigate to AI assistant page with template prompt
    setLocation(`/ki-assistent?template=${template.id}&prompt=${encodeURIComponent(template.prompt)}`);
    setIsOpen(false);
    toast.success(`Vorlage "${template.title}" geladen`);
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
        onClick={() => setIsOpen(true)}
        aria-label="KI-Assistent öffnen"
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* Template Selection Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              KI-Assistent Vorlagen
            </DialogTitle>
            <DialogDescription>
              Wählen Sie eine Vorlage für schnellen Zugang zu häufigen Fragen
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[60vh] pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-secondary animate-pulse rounded-lg" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Keine Vorlagen verfügbar. Erstellen Sie Vorlagen in den Einstellungen.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleTemplateClick(template)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        {template.icon && <span>{template.icon}</span>}
                        {template.title}
                      </CardTitle>
                      {template.category && (
                        <CardDescription className="text-xs">
                          {template.category}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.prompt}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <Button variant="ghost" onClick={() => setLocation('/ki-assistent')}>
              Zum KI-Assistenten
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
