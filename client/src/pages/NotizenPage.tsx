/**
 * Notizen Page - Finanzplaner
 * Notizen und Recherche-Dokumentation
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  FileText, Plus, Pencil, Trash2, Search, Tag, Save, X
} from 'lucide-react';

const CATEGORIES = [
  { value: 'research', label: 'Recherche', color: 'bg-blue-500' },
  { value: 'strategy', label: 'Strategie', color: 'bg-purple-500' },
  { value: 'analysis', label: 'Analyse', color: 'bg-green-500' },
  { value: 'idea', label: 'Idee', color: 'bg-amber-500' },
  { value: 'general', label: 'Allgemein', color: 'bg-gray-500' },
];

export default function NotizenPage() {
  // State für neue Notiz (inline, kein Dialog)
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  
  // State für Bearbeiten (Dialog)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // tRPC queries and mutations
  const { data: notes = [], isLoading, refetch } = trpc.notes.list.useQuery();
  
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Notiz erstellt');
      setIsCreating(false);
      setNewTitle('');
      setNewContent('');
      setNewCategory('general');
    },
    onError: (error: any) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Notiz aktualisiert');
      setIsEditDialogOpen(false);
      setEditingNote(null);
    },
    onError: (error: any) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Notiz gelöscht');
    },
    onError: (error: any) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Focus auf Titel wenn neue Notiz gestartet wird
  useEffect(() => {
    if (isCreating && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isCreating]);

  // Filter and search notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = searchQuery === '' || 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || note.category === filterCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes, searchQuery, filterCategory]);

  const handleCreateNote = () => {
    if (!newTitle.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      titleInputRef.current?.focus();
      return;
    }
    if (!newContent.trim()) {
      toast.error('Bitte geben Sie einen Inhalt ein');
      contentTextareaRef.current?.focus();
      return;
    }
    
    createNote.mutate({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory,
    });
  };

  const handleUpdateNote = () => {
    if (!editingNote) return;
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error('Titel und Inhalt sind erforderlich');
      return;
    }
    
    updateNote.mutate({
      id: editingNote.id,
      title: editTitle.trim(),
      content: editContent.trim(),
      category: editCategory,
    });
  };

  const handleEdit = (note: any) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setEditCategory(note.category || 'general');
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Notiz wirklich löschen?')) {
      deleteNote.mutate({ id });
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('general');
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[4];
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-12 sm:pt-0">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Notizen
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              Recherche und Dokumentation
            </p>
          </div>
          
          {!isCreating && (
            <Button 
              size="sm" 
              className="touch-target text-xs sm:text-sm"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Neue </span>Notiz
            </Button>
          )}
        </div>

        {/* Neue Notiz Formular (inline, kein Dialog) */}
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="glass-card border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Neue Notiz
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-title">Titel</Label>
                    <Input
                      id="new-title"
                      ref={titleInputRef}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="z.B. ETF-Recherche MSCI World"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kategorie</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-content">Inhalt</Label>
                  <Textarea
                    id="new-content"
                    ref={contentTextareaRef}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Schreiben Sie hier Ihre Notizen..."
                    rows={8}
                    className="font-mono text-sm resize-y"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCancelCreate}>
                    <X className="w-4 h-4 mr-2" />
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleCreateNote}
                    disabled={createNote.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[160px] text-xs sm:text-sm">
                  <Tag className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notes Grid */}
        {filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredNotes.map((note, index) => {
              const categoryInfo = getCategoryInfo(note.category || 'general');
              return (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass-card h-full hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{note.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              <div className={`w-2 h-2 rounded-full ${categoryInfo.color} mr-1`} />
                              {categoryInfo.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(note)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(note.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                        <span>Aktualisiert:</span>
                        {new Date(note.updatedAt).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || filterCategory !== 'all' 
                  ? 'Keine Notizen gefunden' 
                  : 'Noch keine Notizen vorhanden'}
              </p>
              {!isCreating && !searchQuery && filterCategory === 'all' && (
                <Button 
                  className="mt-4" 
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Erste Notiz erstellen
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Notiz bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie Ihre Notiz.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="z.B. ETF-Recherche MSCI World"
                />
              </div>

              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inhalt</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Ihre Notizen..."
                  rows={10}
                  className="font-mono text-sm resize-y"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleUpdateNote} 
                  disabled={!editTitle.trim() || !editContent.trim() || updateNote.isPending}
                >
                  Speichern
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
