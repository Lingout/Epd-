# EPD Heft

Persönliches Browser-Heft zur Vorbereitung auf die EPD (VWU): Schreiben, Lesen, Hören und Fehlerjournal.

## Funktionen

- liniertes digitales Heft
- Schreiben mit Wort- und Zeichenzähler
- Lesen/Hören mit nummerierten Antwortfeldern
- Prüfungstimer und Zeit-Presets
- automatisches Speichern im Browser (`localStorage`)
- Verlauf pro Bereich
- Fehlerjournal mit Korrektur, Regel und neuem Beispiel
- JSON-Export/Import für Backups
- responsive Darstellung für Desktop und Smartphone

## Datenschutz

Es gibt keinen Server und keine Datenbank. Alle Inhalte bleiben ausschließlich im `localStorage` des Browsers, in dem sie geschrieben wurden. Der Export ist deshalb als Backup wichtig.

## Lokal öffnen

`index.html` kann direkt geöffnet werden. Alternativ einen einfachen lokalen HTTP-Server starten, z. B.:

```bash
python -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Vercel

Das Projekt ist statisch und kann ohne Build-Schritt auf Vercel veröffentlicht werden.
