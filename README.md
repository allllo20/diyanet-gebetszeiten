# Diyanet-Gebetszeiten für GitHub Pages

Eine statische, responsive Web-App, die Gebetszeiten nach Ort und Datum anzeigt. Sie läuft ohne Build-Schritt direkt auf GitHub Pages.

## Funktionen

- Ortssuche mit mehreren Treffern
- Optionaler Zugriff auf den aktuellen Browser-Standort
- Freie Datumsauswahl innerhalb des verfügbaren Datenbestands
- Markierung des nächsten Gebets am aktuellen Tag
- Heller und dunkler Darstellungsmodus
- Mobile-optimiert und tastaturbedienbar

## Datenquelle

Die App verwendet ausschließlich Inhalte von `namazvakitleri.diyanet.gov.tr`: Die Ortskennungen stammen aus offiziellen Diyanet-JSON-Listen, die Zeiten werden aus der offiziellen Diyanet-Ortsseite geparst, und „Original öffnen“ verlinkt die ausgewertete Seite.

Da Diyanet keine CORS-Freigabe für Browserabrufe sendet, wird `r.jina.ai` als reiner Lesetransport eingesetzt. Es wird keine Gebetszeiten-API eines Drittanbieters mehr verwendet. Die Datumsauswahl funktioniert für Zeiträume, die Diyanet auf der jeweiligen Ortsseite veröffentlicht.

## GitHub Pages

Das Repository enthält einen Actions-Workflow. Unter **Settings → Pages** als Quelle **GitHub Actions** auswählen. Danach veröffentlicht jeder Push auf `main` die Seite automatisch.

## Lokal testen

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen.
