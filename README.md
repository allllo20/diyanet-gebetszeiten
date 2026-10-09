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

Die App nutzt `https://ezanvakti.imsakiyem.com/api`. Der dort zurückgegebene Datensatz nennt die Diyanet İşleri Başkanlığı als Quelle. Die API ist ein unabhängiger Dienst und nicht die offizielle Diyanet-API.

Die offizielle Diyanet-API verlangt eine Registrierung und kurzlebige Zugangstoken. Solche Zugangsdaten dürfen nicht in einer öffentlichen GitHub-Pages-App hinterlegt werden. Für eine produktive Anwendung mit der offiziellen API wird daher ein geschütztes Backend oder eine Serverless Function benötigt.

## GitHub Pages

Das Repository enthält einen Actions-Workflow. Unter **Settings → Pages** als Quelle **GitHub Actions** auswählen. Danach veröffentlicht jeder Push auf `main` die Seite automatisch.

## Lokal testen

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen.
