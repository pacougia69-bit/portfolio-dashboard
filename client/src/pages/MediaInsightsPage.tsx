import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Upload, FileImage, FilePlus, Trash2, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MediaInsightsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<any | null>(null);

  const { data: insights = [], refetch } = trpc.media.list.useQuery();
  const uploadMutation = trpc.media.upload.useMutation({
    onSuccess: () => {
      toast.success("Media erfolgreich hochgeladen!");
      setUploadOpen(false);
      setTitle("");
      setSource("");
      setSelectedFile(null);
      setFilePreview(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Upload fehlgeschlagen: ${error.message}`);
    },
  });

  const deleteMutation = trpc.media.delete.useMutation({
    onSuccess: () => {
      toast.success("Media gelöscht!");
      refetch();
    },
  });

  const analyzeMutation = trpc.media.analyzeDocument.useMutation({
    onSuccess: (data) => {
      toast.success("Analyse abgeschlossen!");
      setSelectedInsight({
        ...selectedInsight,
        summary: data.analysis?.substring(0, 500),
        analysisData: data.analysisData,
      });
      refetch();
    },
    onError: (error) => {
      toast.error(`Analyse fehlgeschlagen: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error("Nur Bilder (PNG, JPG) und PDFs werden unterstützt");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !title) {
      toast.error("Bitte Titel und Datei auswählen");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      uploadMutation.mutate({
        title,
        source,
        fileData: reader.result as string,
        fileType: selectedFile.type as any,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleAnalyze = (mediaId: number) => {
    analyzeMutation.mutate({ mediaId });
  };

  const handleDelete = (id: number) => {
    if (confirm("Media wirklich löschen?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mediathek</h1>
          <p className="text-muted-foreground">
            Lade Screenshots von Börsenzeitschriften hoch und analysiere sie mit KI
          </p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Hochladen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Media hochladen</DialogTitle>
              <DialogDescription>
                Lade einen Screenshot oder PDF einer Börsenzeitung hoch
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  placeholder="z.B. Der Aktionär - Apple Analyse"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Quelle (optional)</Label>
                <Input
                  id="source"
                  placeholder="z.B. Der Aktionär, Börse Online"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Datei *</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                />
              </div>

              {filePreview && selectedFile?.type.startsWith('image/') && (
                <div className="rounded-md border p-2">
                  <img src={filePreview} alt="Vorschau" className="w-full h-auto max-h-64 object-contain" />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? "Lädt hoch..." : "Hochladen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileImage className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Noch keine Medien hochgeladen</p>
            <p className="text-sm">Klicke auf "Hochladen" um zu starten</p>
          </CardContent>
        </Card>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {insights.map((insight: any) => (
            <Card
              key={insight.id}
              className="group hover:shadow-lg transition-shadow"
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: '320px',
                maxWidth: '100%'
              }}
            >
              <CardHeader style={{ paddingBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CardTitle
                      className="text-base line-clamp-2"
                      style={{ marginBottom: '6px', fontSize: '16px' }}
                    >
                      {insight.title}
                    </CardTitle>
                    {insight.source && (
                      <CardDescription style={{ fontSize: '12px' }}>
                        {insight.source}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      flexShrink: 0,
                      width: '32px',
                      height: '32px',
                      marginTop: '-4px',
                      marginRight: '-4px'
                    }}
                    onClick={() => handleDelete(insight.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Image Preview */}
                {insight.imageUrl && (
                  <div
                    className="rounded-md border bg-muted overflow-hidden cursor-pointer"
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      position: 'relative'
                    }}
                    onClick={() => setSelectedInsight(insight)}
                  >
                    <img
                      src={insight.imageUrl}
                      alt={insight.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )}

                {/* Summary */}
                {insight.summary && (
                  <p
                    className="text-sm text-muted-foreground line-clamp-3"
                    style={{ flex: 1, fontSize: '14px' }}
                  >
                    {insight.summary}
                  </p>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      size="sm"
                      variant="outline"
                      style={{ flex: 1 }}
                      onClick={() => setSelectedInsight(insight)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Ansehen
                    </Button>
                    <Button
                      size="sm"
                      style={{ flex: 1 }}
                      onClick={() => handleAnalyze(insight.id)}
                      disabled={analyzeMutation.isPending}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Analysieren
                    </Button>
                  </div>

                  {/* Date */}
                  <p
                    className="text-xs text-muted-foreground"
                    style={{ textAlign: 'center', fontSize: '12px' }}
                  >
                    {new Date(insight.createdAt).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      {selectedInsight && (
        <Dialog open={!!selectedInsight} onOpenChange={() => setSelectedInsight(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{selectedInsight.title}</DialogTitle>
              {selectedInsight.source && (
                <DialogDescription>{selectedInsight.source}</DialogDescription>
              )}
            </DialogHeader>

            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                {selectedInsight.imageUrl && (
                  <img
                    src={selectedInsight.imageUrl}
                    alt={selectedInsight.title}
                    className="w-full h-auto rounded-md border"
                  />
                )}

                {selectedInsight.analysisData?.rawAnalysis && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">KI-Analyse:</h3>
                    <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md">
                      {selectedInsight.analysisData.rawAnalysis}
                    </div>
                  </div>
                )}

                {!selectedInsight.analysisData && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>Noch keine Analyse vorhanden</p>
                    <Button
                      className="mt-3"
                      onClick={() => handleAnalyze(selectedInsight.id)}
                      disabled={analyzeMutation.isPending}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Jetzt analysieren
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
