# GST Records

Local browser app for maintaining GST billing records for DV and SG.

## How to use

Open `index.html` in a browser, log in with `DV` or `SG`, paste a billing or bank message, and click `Add Record`.

Use:

- `bill` or `billing` for normal calculation from billing amount.
- `bank` for reverse calculation from bank amount received.

## Data saving

Records are saved in the browser on every add, edit, delete, and status change.

The app writes data to:

- `gst-records-master-v1`
- profile storage such as `gst-records-v2-DV`
- backup storage such as `gst-records-backup-DV`
- recent history snapshots

The toolbar shows `Saved HH:MM:SS` after each verified save.

Use `Backup` regularly to download a JSON copy of records. Use `Restore` to import that JSON file if browser storage is cleared or if you move to another computer/browser.

## GitHub Pages note

GitHub can host this app, but GitHub Pages does not store records in the repository automatically. Records are still stored in the browser used to open the app. Keep JSON backups for safety.
