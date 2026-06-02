# Pay Watcher

Pay Watcher is a dependency-free PWA for logging Apple Pay or family-card transactions into a private table.

## Run locally

```powershell
node server.js
```

Open `http://localhost:4173`.

## iPhone use

Host the folder with any static host, open the site in Safari, then use Share -> Add to Home Screen. A paid Apple Developer account is not needed.

## Backup

Use `CSV` for spreadsheet exports and `JSON` for app backups. `Import` merges JSON backups by transaction id.

## Shortcut URL

When hosted, a Shortcut can open a URL like this to add a transaction:

```text
https://your-site.example/?merchant=Metro&amount=8.50&card=Mom%20Visa&category=Transit
```

The app stores data in the iPhone browser profile, so keep JSON backups before clearing Safari data or moving phones.
