import { AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";

export type Signal = "gruen" | "gelb" | "rot";

// Farb-/Styling-Helfer pro Signal — ausgelagert aus TechFruehwarnsystemPage.tsx,
// da MorningNotePage.tsx (Marktumfeld-Karte) dieselbe Darstellung braucht.
export function getSignalStyles(signal: Signal) {
  switch (signal) {
    case "gruen":
      return {
        bg: "bg-green-500/10",
        border: "border-green-500/40",
        text: "text-green-600 dark:text-green-400",
        ring: "ring-green-500/30",
        Icon: CheckCircle2,
        label: "GRÜN",
      };
    case "gelb":
      return {
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/40",
        text: "text-yellow-600 dark:text-yellow-400",
        ring: "ring-yellow-500/30",
        Icon: AlertTriangle,
        label: "GELB",
      };
    case "rot":
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/40",
        text: "text-red-600 dark:text-red-400",
        ring: "ring-red-500/30",
        Icon: AlertOctagon,
        label: "ROT",
      };
  }
}
