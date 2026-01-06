#!/bin/bash

# Test-Script für OPENAI_API_KEY
# Führe dieses Script aus, um zu prüfen, ob dein Key geladen wird

echo "=== OpenAI API Key Test ==="
echo ""

# Lade .env Datei
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
  echo "✓ .env Datei gefunden und geladen"
else
  echo "✗ .env Datei NICHT gefunden!"
fi

echo ""

# Prüfe, ob OPENAI_API_KEY gesetzt ist
if [ -z "$OPENAI_API_KEY" ]; then
  echo "✗ OPENAI_API_KEY ist NICHT gesetzt!"
  echo ""
  echo "Lösung:"
  echo "1. Öffne die .env Datei"
  echo "2. Füge hinzu: OPENAI_API_KEY=sk-proj-[DEIN_KEY]"
  echo "3. Speichern und dieses Script erneut ausführen"
else
  echo "✓ OPENAI_API_KEY ist gesetzt!"
  echo ""
  echo "Key-Vorschau: ${OPENAI_API_KEY:0:10}••••••••"
  echo "Key-Länge: ${#OPENAI_API_KEY} Zeichen"
  echo ""

  # Validierung
  if [[ $OPENAI_API_KEY == sk-* ]]; then
    echo "✓ Key-Format sieht korrekt aus (beginnt mit 'sk-')"
  else
    echo "⚠ WARNUNG: Key beginnt nicht mit 'sk-' - möglicherweise falsch!"
  fi
fi

echo ""
echo "=== Test beendet ==="
