# Food Wheel

A self-hosted web app that helps you decide what to eat. Add restaurants and home recipes, spin the wheel, and let chance make the call. Built with Flask and deployable via Docker.

---

## Features

### Both Modes
- **Spinning wheel** — weighted random selection with proportional slice sizes
- **Category filters** — group entries by label and filter the wheel by one or more categories
- **Pick history** — every spin is logged with date and time; mark entries as eaten or cooked
- **Recency weighting** — reduce the odds of recently picked entries appearing on the wheel
- **Per-entry spin weight** — assign a custom weight percentage (1–999%) to make any entry more or less likely
- **Per-entry notes** — store freeform notes on any entry; icon turns gold when notes are saved
- **Inline editing** — edit any field directly in the food list without a separate screen
- **Backup & restore** — export and import your full configuration as a single JSON file
- **Built-in defaults** — load a pre-configured set of 34 US restaurant chains and 25 home recipes
- **Dark theme UI** — settings panel, help modal, and filter chips

### Eat Out
- Website URL per entry — name becomes a clickable link
- Feature flags: Drive-thru, Online ordering, Dine-in only
- Feature filter chips above the wheel

### Cook at Home
- Cook time field (in minutes) with filterable range chips (≤ 30 min / 31–60 min / 60+ min)
- Feature flags: ⚡ Quick, 🕐 Slow Cook, 🔆 Oven/Bake, 🔥 Grill, 🍲 One Pot, 🥗 No Cook
- Structured notes with separate **Ingredients**, **Instructions**, and **Notes** sections
- **Print Recipe** button — opens a clean formatted recipe page and triggers the browser print dialog

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

### Switching Modes

Use the **Eat Out | Cook at Home** toggle below the header to switch between two independent wheels. Each mode has its own food list, history, and filter chips. The settings panel and spin weighting apply to both modes.

### The Wheel

Click **Spin the Wheel** to randomly select from your list. The yellow triangle at the top is the pointer. The button is disabled until you have at least two entries. Active filters limit which entries appear on the wheel.

### Adding Entries

**Eat Out** — click **+ Add Location**:

| Field | Description |
|---|---|
| Name | Restaurant name (required) |
| Category | Optional grouping label, e.g. "Fast Food" or "Italian" |
| Website URL | Name becomes a clickable link; `https://` is added automatically if omitted |
| Drive-thru / Online ordering / Dine-in only | Feature flags used for filter chips |
| Weight % | Relative spin probability (default 100) |

**Cook at Home** — click **+ Add Recipe**:

| Field | Description |
|---|---|
| Name | Recipe or meal name (required) |
| Category | Optional grouping label, e.g. "Pasta" or "Soup" |
| Cook time | Estimated minutes; used for time-range filter chips above the wheel |
| ⚡ Quick / 🕐 Slow Cook / 🔆 Oven/Bake / 🔥 Grill / 🍲 One Pot / 🥗 No Cook | Feature flags for filtering |
| Weight % | Relative spin probability (default 100) |

### Managing Your List

Each entry shows three icons on the right:

- **📝** — Opens the notes panel. Icon turns gold when notes have been saved.
- **✏️** — Opens an inline editor for all fields.
- **✕** — Permanently removes the entry.

### Notes

Click the 📝 icon on any entry to open its notes panel.

- **Eat Out** — a single freeform text area for anything worth remembering: favorite dishes, past experiences, recommendations.
- **Cook at Home** — three labeled sections: **Ingredients**, **Instructions**, and **Notes**. A **Print Recipe** button in the footer opens a clean formatted recipe page in a new tab and triggers the browser print dialog, useful for taking a recipe to the kitchen.

### Filtering the Wheel

Filter chips appear above the wheel once you have categories or features set:

- **Row 1 — Categories:** select one or more to limit the wheel to those groups (OR logic). Tap **All** to clear.
- **Row 2 — Features:** all selected feature chips must match (AND logic). Chips only appear when at least one entry has that feature.
- **Row 3 — Cook time (Cook at Home only):** ≤ 30 min, 31–60 min, or 60+ min. Tap the active chip again to clear. Only one range active at a time.

Category and feature filters combine — for example, selecting "Asian" and ⚡ Quick shows only Asian recipes that are also marked Quick.

### Pick History

Every spin is logged with date and time. Each mode shows its own history. From the list you can:

- Check the **checkbox** to mark an entry as eaten or cooked. Confirmed entries are struck through and count toward the weighting system.
- Use **Mark as Eaten** below the spin result to confirm without scrolling.
- Click **✕** on any entry to remove it individually.
- Use **Clear History** in the ⚙ settings panel to wipe all history for both modes.

### Per-Entry Spin Weight

Every entry has a **Weight %** field (1–999, default 100) that scales its slice on the wheel proportionally. A 200% entry gets twice the slice of a 100% entry; a 50% entry gets half. Entries with a non-default weight show a small badge in the food list.

When the recency reduction setting is also active, the penalty is applied multiplicatively on top of the per-entry weight. A 500% entry reduced by 50% lands at 250% — it remains more likely than a default entry, just less so than before it was recently picked.

### Reducing Recent Repeats (Weighting)

Open the **⚙** panel and enable *Reduce chance of recently eaten foods*:

- **Reduce by X%** — how much to lower the probability for a recently confirmed entry. 50% means it is half as likely to be picked.
- **Within the last X days** — how far back to look. Only confirmed (checked) entries within this window are counted.

Slice sizes on the wheel update visually to reflect the adjusted probabilities. Click **Save** to apply.

### Backup & Restore

All options are in the **⚙** settings panel under *Backup & Restore*:

| Option | Description |
|---|---|
| **Export Config** | Downloads `food-wheel-config.json` with both your Eat Out and Cook at Home lists plus settings. History is not included. |
| **Import Config** | Loads a previously exported config file, replacing your current lists and settings. |
| **Load Defaults** | Replaces both lists with built-in defaults: 34 US restaurant chains (Eat Out) and 25 home recipes with full ingredients and instructions (Cook at Home). |
| **Clear Config** | Wipes all food entries and resets settings. Offers a backup download before clearing. |
| **Clear History** | Removes all pick history for both modes. Food options and settings are not affected. |

---

## Data Storage

All data is stored as plain JSON files:

| File | Contents |
|---|---|
| `data/foods.json` | All food entries for both modes (each entry has a `mode` field) |
| `data/history.json` | Pick history log for both modes |
| `data/settings.json` | Weighting preferences |

When running via Docker, these files live inside the `food-wheel-data` named volume.

---

## Default Content

**Eat Out (34 entries)** — US national chains across Fast Food, Burgers, Sandwiches, Mexican, Pizza, Asian, Casual Dining, Steakhouse, Seafood, and Breakfast categories.

**Cook at Home (25 recipes)** — A variety of home-cooked meals across Pasta, Chicken, Mexican, Asian, Comfort Food, Italian, Soup, Seafood, Breakfast, Salad, Sandwiches, BBQ, and Burgers categories. Each recipe includes a full ingredient list, step-by-step instructions, and cooking notes.

---

## License

MIT — see [LICENSE](LICENSE).
