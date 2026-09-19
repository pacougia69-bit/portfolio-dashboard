/**
 * Formular im Fenster "Genauer ansehen": KI-Antwort einfügen, Beurteilungsblock wird erkannt,
 * Rafael bestätigt oder korrigiert die Felder und speichert. Keine KI in der App.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import {
  ANALYSE_RAW_MAX,
  DATENLAGEN,
  DATENLAGE_TEXT,
  GRUNDLAGEN,
  parseBeurteilung,
  type Datenlage,
  type Grundlage,
} from '@shared/waechter-auswertung';

const KI_NAMEN = ['Gemini', 'ChatGPT', 'Claude', 'andere'];

interface Props {
  positionId: number;
  duplicatePositionIds: number[]; // weitere Positionen mit gleichem Ticker
  onSaved: () => void;
}

export default function WaechterAnalyseForm({ positionId, duplicatePositionIds, onSaved }: Props) {
  const [rawText, setRawText] = useState('');
  const [grundlage, setGrundlage] = useState<Grundlage | ''>('');
  const [datenlage, setDatenlage] = useState<Datenlage | ''>('');
  const [begruendung, setBegruendung] = useState('');
  const [offen, setOffen] = useState('');
  const [kiName, setKiName] = useState('');
  const [alsoDuplicates, setAlsoDuplicates] = useState(true);

  const save = trpc.waechter.saveAnalyse.useMutation({
    onSuccess: () => {
      toast.success('Analyse gespeichert – sie steht jetzt in der Auswertung oben');
      setRawText('');
      setGrundlage('');
      setDatenlage('');
      setBegruendung('');
      setOffen('');
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const parsed = useMemo(() => parseBeurteilung(rawText), [rawText]);
  useEffect(() => {
    if (!rawText.trim()) return;
    setGrundlage(parsed.grundlage ?? '');
    setDatenlage(parsed.datenlage ?? '');
    setBegruendung(parsed.begruendung);
    setOffen(parsed.offen);
  }, [parsed, rawText]);

  const recognized = (parsed.grundlage ? 1 : 0) + (parsed.datenlage ? 1 : 0);
  const canSave = rawText.trim().length > 0 && grundlage !== '' && datenlage !== '' && !save.isPending;

  const handleSave = () => {
    const g = grundlage;
    const d = datenlage;
    if (!canSave || g === '' || d === '') return;
    save.mutate({
      positionIds: alsoDuplicates ? [positionId, ...duplicatePositionIds] : [positionId],
      rawText: rawText.trim(),
      grundlage: g,
      datenlage: d,
      begruendung,
      offen,
      kiName: kiName || undefined,
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="waechter-antwort" className="text-xs font-normal text-muted-foreground">
        Antwort der KI hier einfügen (ganzer Text). Der Beurteilungsblock am Ende wird erkannt.
      </Label>
      <Textarea
        id="waechter-antwort"
        value={rawText}
        onChange={(e) => setRawText(e.target.value.slice(0, ANALYSE_RAW_MAX))}
        rows={6}
        className="text-xs"
        placeholder="KI-Antwort einfügen …"
      />
      {rawText.trim() && (
        <p className={`text-xs ${recognized === 2 ? 'text-green-400' : 'text-amber-400'}`}>
          {recognized === 2
            ? 'Beurteilungsblock erkannt – bitte kurz prüfen.'
            : recognized === 1
              ? 'Nur teilweise erkannt – bitte das fehlende Feld unten wählen.'
              : 'Kein Beurteilungsblock erkannt – bitte die Felder unten von Hand wählen.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs font-normal text-muted-foreground">Grundlage</Label>
          <Select value={grundlage} onValueChange={(v) => setGrundlage(v as Grundlage)}>
            <SelectTrigger><SelectValue placeholder="wählen" /></SelectTrigger>
            <SelectContent>
              {GRUNDLAGEN.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-normal text-muted-foreground">Datenlage</Label>
          <Select value={datenlage} onValueChange={(v) => setDatenlage(v as Datenlage)}>
            <SelectTrigger><SelectValue placeholder="wählen" /></SelectTrigger>
            <SelectContent>
              {DATENLAGEN.map((d) => (<SelectItem key={d} value={d}>{DATENLAGE_TEXT[d]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-normal text-muted-foreground">Welche KI?</Label>
          <Select value={kiName} onValueChange={setKiName}>
            <SelectTrigger><SelectValue placeholder="optional" /></SelectTrigger>
            <SelectContent>
              {KI_NAMEN.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Textarea value={begruendung} onChange={(e) => setBegruendung(e.target.value)} rows={2} className="text-xs" placeholder="Begründung (kurz)" />
      <Textarea value={offen} onChange={(e) => setOffen(e.target.value)} rows={1} className="text-xs" placeholder="Offen / nicht geprüft" />

      {duplicatePositionIds.length > 0 && (
        <div className="flex items-start gap-2">
          <Checkbox id="waechter-dup" checked={alsoDuplicates} onCheckedChange={(v) => setAlsoDuplicates(v === true)} />
          <Label htmlFor="waechter-dup" className="text-xs font-normal leading-snug">
            Gilt auch für die andere Position mit demselben Ticker ({duplicatePositionIds.length} weitere).
          </Label>
        </div>
      )}

      <Button onClick={handleSave} disabled={!canSave} className="w-full">
        {save.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
        Analyse speichern
      </Button>
    </div>
  );
}
