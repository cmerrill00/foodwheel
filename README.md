# Food Wheel

A self-hosted web app that helps you decide what to eat. Add your favorite restaurants and meals, spin the wheel, and let chance make the call. Built with Flask and deployable via Docker.

---

## Features

- **Spinning wheel** — weighted random selection with proportional slice sizes
- **Category & feature filters** — narrow the wheel to specific food types or locations with drive-thru, online ordering, or dine-in options
- **Pick history** — every spin is logged with date and time; mark entries as eaten
- **Recency weighting** — reduce the odds of recently eaten locations appearing on the wheel
- **Per-entry notes** — record favorite dishes, experiences, or anything worth remembering
- **Website links** — add a URL to any entry and the name becomes a clickable link
- **Backup & restore** — export and import your full configuration as a JSON file
- **Built-in defaults** — load a pre-configured set of 34 common US restaurant chains
- **Dark theme UI** with a settings panel, help modal, and inline editing

---

## Getting Started

### Docker (recommended)

```bash
git clone https://github.com/cmerrill00/foodwheel.git
cd foodwheel
docker compose up -d
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

Data is persisted in a named Docker volume (`food-wheel-data`) and survives container restarts and rebuilds.

To rebuild after pulling updates:

```bash
docker compose up -d --build
```

### Local Development

**Requirements:** Python 3.12+

```bash
git clone https://github.com/cmerrill00/foodwheel.git
cd foodwheel
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser. Data files are stored in a `data/` directory created automatically on first run.

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Directory where JSON data files are stored |
| `PORT` | `5000` | Port the app listens on |

To change the host port when using Docker, edit the `ports` mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:5000"   # serve on port 8080
```

---

## Usage

### The Wheel

Click **Spin the Wheel** to randomly select from your food list. The yellow triangle at the top is the pointer — whatever it lands on is the result. The button is disabled until you have at least two entries. If a filter is active, only the filtered options appear on the wheel.

### Adding Locations

Click **+ Add Location** in the Food Options header to open the entry form:

- **Name** — the restaurant or meal name (required)
- **Category** — optional label for grouping, e.g. "Fast Food" or "Italian"
- **Website URL** — if provided, the name becomes a clickable link; `https://` is added automatically if omitted
- **Drive-thru** — check if the location has a drive-thru
- **Online ordering** — check if online ordering is available
- **Dine-in only** — check if dine-in is the only option

### Managing Your List

Each entry shows three icons on the right:

- **📝** — Opens the notes panel for that location. The icon turns gold when notes have been saved.
- **✏️** — Opens an inline editor for the name, category, URL, and all feature flags.
- **✕** — Permanently removes the entry.

### Filtering the Wheel

Two rows of filter chips appear above the wheel once you have categories or features set:

- **Row 1 — Categories:** Select one or more category chips to limit the wheel to those groups. Multiple categories use OR logic — results from any selected category are included. Tap **All** to clear.
- **Row 2 — Features:** Tap 🚗 Drive-thru, 📱 Online ordering, or 🍽️ Dine-in only to filter by those attributes. Feature filters use AND logic — a location must match all active feature filters to appear. These chips only appear when at least one entry has that feature enabled.

Category and feature filters combine — for example, selecting "Fast Food" and 🚗 Drive-thru shows only Fast Food locations that also have drive-thru.

### Pick History

Every spin is automatically logged with date and time. From the history list you can:

- Check the **checkbox** next to an entry to mark it as eaten. Confirmed entries are struck through and are the only ones counted by the weighting system.
- Use the **Mark as Eaten** button that appears below the spin result to confirm quickly without scrolling.
- Click **✕** on any history entry to remove it individually.
- Use **Clear History** in the ⚙ settings panel to wipe all entries at once.

### Reducing Recent Repeats (Weighting)

Open the **⚙** panel and enable *Reduce chance of recently eaten foods*. Two values control the behavior:

- **Reduce by X%** — how much to lower the probability for a recently confirmed location. 50% means it is half as likely to be picked.
- **Within the last X days** — how far back to look. Only confirmed (checked) entries within this window are counted.

When weighting is active, slice sizes on the wheel visually reflect the adjusted probabilities. Click **Save** to apply changes.

### Backup & Restore

All backup and restore options live in the **⚙** settings panel:

| Option | Description |
|---|---|
| **Export Config** | Downloads `food-wheel-config.json` with your food list and settings. History is not included. |
| **Import Config** | Loads a previously exported config file, replacing your current list and settings. |
| **Load Defaults** | Replaces your list with 34 pre-configured US restaurant chains including categories, websites, and feature flags. |
| **Clear Config** | Wipes your food list and resets settings. Offers a backup download before clearing. |
| **Clear History** | Removes all pick history entries. Food options and settings are not affected. |

---

## Data Storage

All data is stored as plain JSON files:

| File | Contents |
|---|---|
| `data/foods.json` | Your food/restaurant list |
| `data/history.json` | Pick history log |
| `data/settings.json` | Weighting preferences |

When running via Docker, these files live inside the `food-wheel-data` named volume. To back up your data independently of the app's export feature, you can copy files directly out of the volume.

---

## License

MIT — see [LICENSE](LICENSE).
