import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  HelpCircle, 
  Search, 
  LayoutDashboard, 
  Briefcase, 
  Eye, 
  Target, 
  PiggyBank,
  Sparkles,
  Settings,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Wrench
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // Schnellstart
  {
    category: "schnellstart",
    question: "Wie starte ich mit dem Portfolio Manager?",
    answer: "Nach dem Login sehen Sie das Dashboard mit einer Übersicht Ihres Portfolios. Beginnen Sie, indem Sie unter 'Portfolio' Ihre ersten Positionen hinzufügen. Geben Sie die WKN ein und die Daten werden automatisch abgerufen."
  },
  {
    category: "schnellstart",
    question: "Wie füge ich eine neue Position hinzu?",
    answer: "Gehen Sie zu 'Portfolio' und klicken Sie auf 'Position hinzufügen'. Geben Sie die WKN ein und klicken Sie auf die Lupe - Name, Ticker und aktueller Kurs werden automatisch geladen. Ergänzen Sie Stückzahl und Kaufpreis und speichern Sie."
  },
  {
    category: "schnellstart",
    question: "Wie aktualisiere ich die Kurse?",
    answer: "Klicken Sie auf 'Kurse aktualisieren' im Dashboard oder auf der Portfolio-Seite. Die Kurse werden über Yahoo Finance abgerufen und automatisch aktualisiert."
  },
  
  // Dashboard
  {
    category: "dashboard",
    question: "Was zeigt das Dashboard an?",
    answer: "Das Dashboard zeigt Ihr Gesamtvermögen, den Gewinn/Verlust, die Anzahl der Positionen und erwartete Dividenden. Außerdem sehen Sie die Allokation nach Typ (Aktien, ETFs, etc.) und die Top-Kategorien Ihres Portfolios."
  },
  {
    category: "dashboard",
    question: "Was bedeutet die Risiko-Warnung?",
    answer: "Die Risiko-Warnung erscheint, wenn Ihr Portfolio einen hohen Anteil risikoreicher Positionen enthält (z.B. Biotech, Krypto). Empfohlen sind maximal 30% für eine ausgewogene Diversifikation."
  },
  {
    category: "dashboard",
    question: "Wie starte ich eine KI-Analyse?",
    answer: "Klicken Sie auf 'KI-Analyse' im Dashboard. Die KI analysiert Ihr gesamtes Portfolio und gibt Ihnen Empfehlungen zu Diversifikation, Risiken und möglichen Handlungen."
  },
  
  // Portfolio
  {
    category: "portfolio",
    question: "Welche Wertpapiertypen werden unterstützt?",
    answer: "Der Portfolio Manager unterstützt Aktien, ETFs, Kryptowährungen, Anleihen und Fonds. Jeder Typ wird in der Allokation separat ausgewiesen."
  },
  {
    category: "portfolio",
    question: "Was bedeuten die Status-Empfehlungen (Kaufen/Halten/Verkaufen)?",
    answer: "Diese zeigen die aktuelle Einschätzung für jede Position. 'Kaufen' bedeutet Nachkaufpotenzial, 'Halten' empfiehlt Beibehaltung, 'Verkaufen' signalisiert möglichen Ausstieg. Sie können den Status manuell setzen oder die KI-Empfehlung nutzen."
  },
  {
    category: "portfolio",
    question: "Wie funktioniert die WKN-Suche?",
    answer: "Geben Sie die WKN (Wertpapierkennnummer) ein und klicken Sie auf die Lupe. Das System sucht in einer Datenbank mit über 50 bekannten WKNs und ruft dann den aktuellen Kurs ab. Falls die WKN nicht gefunden wird, können Sie die Daten manuell eingeben."
  },
  
  // Watchlist
  {
    category: "watchlist",
    question: "Wozu dient die Watchlist?",
    answer: "Die Watchlist ermöglicht es Ihnen, interessante Wertpapiere zu beobachten, bevor Sie sie kaufen. Sie können Zielpreise setzen und werden informiert, wenn der Kurs nahe am Ziel ist."
  },
  {
    category: "watchlist",
    question: "Wie übertrage ich eine Position von der Watchlist ins Portfolio?",
    answer: "Klicken Sie auf den 'Kaufen' Button bei der gewünschten Position. Es öffnet sich ein Dialog, in dem Sie Stückzahl und Kaufpreis eingeben können. Nach dem Speichern wird die Position ins Portfolio übertragen."
  },
  {
    category: "watchlist",
    question: "Wie aktualisiere ich die Kurse in der Watchlist?",
    answer: "Klicken Sie auf 'Kurse aktualisieren' oben auf der Watchlist-Seite. Alle Positionen mit bekannter WKN werden automatisch aktualisiert."
  },
  
  // Strategie
  {
    category: "strategie",
    question: "Was ist die Ziel-Allokation?",
    answer: "Die Ziel-Allokation definiert, wie Ihr ETF-Portfolio idealerweise aufgeteilt sein sollte (z.B. 50% Welt-ETF, 20% EM-ETF, etc.). Sie können diese Ziele anpassen und das Rebalancing zeigt, wie Sie Ihre aktuelle Verteilung anpassen sollten."
  },
  {
    category: "strategie",
    question: "Was zeigt der Rebalancing-Tab?",
    answer: "Der Rebalancing-Tab vergleicht Ihre aktuelle ETF-Allokation mit Ihrer Ziel-Allokation und zeigt, welche Kategorien über- oder untergewichtet sind. Sie erhalten konkrete Empfehlungen, wie viel Sie kaufen oder verkaufen sollten."
  },
  {
    category: "strategie",
    question: "Wie funktioniert die KI-Empfehlung für den Sparplan?",
    answer: "Die KI analysiert Ihr Portfolio UND Ihre Watchlist-ETFs. Sie bewertet jeden ETF (Risiko, Diversifikation, Passung zur Strategie) und schlägt eine optimale Verteilung Ihrer monatlichen Sparrate vor. ETFs können auch abgelehnt werden, wenn sie nicht zur Strategie passen."
  },
  
  // Dividenden
  {
    category: "dividenden",
    question: "Wie erfasse ich Dividenden?",
    answer: "Gehen Sie zu 'Dividenden' und klicken Sie auf 'Dividende hinzufügen'. Wählen Sie die Position, geben Sie Betrag und Datum ein. Die Dividende wird automatisch der Position zugeordnet."
  },
  {
    category: "dividenden",
    question: "Was zeigt die Dividenden-Übersicht?",
    answer: "Sie sehen die Gesamtdividenden des Jahres, eine monatliche Aufschlüsselung und die Dividenden pro Position. So behalten Sie den Überblick über Ihre passiven Einkünfte."
  },
  
  // KI-Assistent
  {
    category: "ki",
    question: "Was kann der KI-Assistent?",
    answer: "Der KI-Assistent analysiert Ihr Portfolio, beantwortet Fragen zu Ihren Investments und gibt personalisierte Empfehlungen. Er kennt Ihre Positionen, Watchlist und Strategie und kann fundierte Ratschläge geben."
  },
  {
    category: "ki",
    question: "Wie genau sind die KI-Empfehlungen?",
    answer: "Die KI basiert auf Ihren echten Portfolio-Daten und allgemeinem Finanzwissen. Sie ersetzt keine professionelle Anlageberatung, kann aber wertvolle Denkanstöße geben. Überprüfen Sie Empfehlungen immer kritisch."
  },
  {
    category: "ki",
    question: "Warum bezieht die KI meine Watchlist ein?",
    answer: "Die KI analysiert Watchlist-ETFs, um zu prüfen, ob sie zu Ihrer bestehenden Strategie passen. So erhalten Sie eine Empfehlung, ob Sie diese ETFs in Ihren Sparplan aufnehmen sollten - inklusive konkreter Beträge."
  },
  
  // Technisches
  {
    category: "technisch",
    question: "Woher kommen die Kursdaten?",
    answer: "Die Kursdaten werden über Yahoo Finance abgerufen. Dies ist kostenlos und deckt die meisten internationalen Wertpapiere ab. Bei einigen exotischen Titeln kann es zu Verzögerungen oder fehlenden Daten kommen."
  },
  {
    category: "technisch",
    question: "Warum werden manche Kurse nicht aktualisiert?",
    answer: "Einige Wertpapiere (besonders kleine deutsche Aktien oder exotische ETFs) sind bei Yahoo Finance nicht gelistet. In diesem Fall müssen Sie den Kurs manuell aktualisieren."
  },
  {
    category: "technisch",
    question: "Sind meine Daten sicher?",
    answer: "Ja, Ihre Daten werden verschlüsselt in einer PostgreSQL-Datenbank gespeichert. Der Zugriff erfolgt nur über Ihren persönlichen Login. Es werden keine Daten an Dritte weitergegeben."
  },
  
  // Tipps
  {
    category: "tipps",
    question: "Wie diversifiziere ich mein Portfolio richtig?",
    answer: "Eine gute Diversifikation umfasst verschiedene Anlageklassen (Aktien, ETFs, Anleihen), Regionen (Welt, EM, Europa) und Sektoren. Die Risiko-Warnung im Dashboard hilft Ihnen, Klumpenrisiken zu erkennen."
  },
  {
    category: "tipps",
    question: "Was ist Rebalancing und wann sollte ich es machen?",
    answer: "Rebalancing bedeutet, Ihre Portfolio-Gewichtung wieder auf die Ziel-Allokation zu bringen. Empfohlen wird dies 1-2x pro Jahr oder wenn eine Kategorie mehr als 5% von der Ziel-Allokation abweicht."
  },
  {
    category: "tipps",
    question: "Wie nutze ich den Sparplan optimal?",
    answer: "Verteilen Sie Ihre monatliche Sparrate auf verschiedene ETFs gemäß Ihrer Ziel-Allokation. Die KI-Empfehlung kann Ihnen helfen, die optimale Verteilung zu finden. Konzentrieren Sie sich auf untergewichtete Kategorien."
  },
];

const categories = [
  { id: "schnellstart", label: "Schnellstart", icon: Lightbulb },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "watchlist", label: "Watchlist", icon: Eye },
  { id: "strategie", label: "Strategie", icon: Target },
  { id: "dividenden", label: "Dividenden", icon: PiggyBank },
  { id: "ki", label: "KI-Assistent", icon: Sparkles },
  { id: "technisch", label: "Technisches", icon: Wrench },
  { id: "tipps", label: "Tipps & Tricks", icon: TrendingUp },
];

export default function HilfePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFAQ = faqData.filter(item => {
    const matchesSearch = searchQuery === "" || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === null || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedFAQ = categories.map(cat => ({
    ...cat,
    items: filteredFAQ.filter(item => item.category === cat.id)
  })).filter(cat => cat.items.length > 0);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 pt-12 sm:pt-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="w-5 h-5 sm:w-7 sm:h-7 text-cyan-500" />
              Hilfe & FAQ
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base mt-1">
              Anleitungen und FAQ
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                selectedCategory === null
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-accent/50 text-muted-foreground hover:bg-accent"
              }`}
            >
              Alle
            </button>
            {categories.map(cat => {
              const Icon = cat.icon;
              const count = faqData.filter(f => f.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                      : "bg-accent/50 text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                  <span className="text-xs opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FAQ Content */}
        {groupedFAQ.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Keine Ergebnisse für "{searchQuery}" gefunden.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Versuchen Sie einen anderen Suchbegriff oder wählen Sie eine Kategorie.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedFAQ.map(category => {
              const Icon = category.icon;
              return (
                <Card key={category.id} className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Icon className="w-5 h-5 text-cyan-500" />
                      {category.label}
                    </CardTitle>
                    <CardDescription>
                      {category.items.length} {category.items.length === 1 ? "Frage" : "Fragen"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.items.map((item, index) => (
                        <AccordionItem key={index} value={`${category.id}-${index}`}>
                          <AccordionTrigger className="text-left hover:text-cyan-400">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground leading-relaxed">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick Info */}
        <Card className="glass-card border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Tipp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Nutzen Sie den <strong className="text-foreground">KI-Assistenten</strong> für personalisierte Fragen zu Ihrem Portfolio. 
              Er kennt Ihre Positionen und kann individuelle Empfehlungen geben.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
