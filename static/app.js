function normalizeUrl(url) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

const COLORS = [
  "#e57373", "#64b5f6", "#81c784", "#ffd54f",
  "#ba68c8", "#4db6ac", "#f06292", "#a1887f",
  "#90a4ae", "#ff8a65", "#9575cd", "#aed581",
];

// ── DOM refs ──────────────────────────────────────────────────────────────────

const canvas            = document.getElementById("wheel");
const ctx               = canvas.getContext("2d");
const spinBtn           = document.getElementById("spin-btn");
const resultText        = document.getElementById("result-text");
const markEatenBtn      = document.getElementById("mark-eaten-btn");
const foodNameInput     = document.getElementById("food-name-input");
const foodCatInput      = document.getElementById("food-cat-input");
const foodUrlInput      = document.getElementById("food-url-input");
const foodDtInput       = document.getElementById("food-dt-input");
const foodOoInput       = document.getElementById("food-oo-input");
const foodDiInput       = document.getElementById("food-di-input");
const foodWeightInput   = document.getElementById("food-weight-input");
const helpToggle        = document.getElementById("help-toggle");
const helpModal         = document.getElementById("help-modal");
const helpCloseBtn      = document.getElementById("help-close-btn");
const notesModal        = document.getElementById("notes-modal");
const notesModalTitle   = document.getElementById("notes-modal-title");
const notesTextarea     = document.getElementById("notes-textarea");
const notesSaveBtn      = document.getElementById("notes-save-btn");
const notesCancelBtn    = document.getElementById("notes-cancel-btn");
const notesCloseBtn     = document.getElementById("notes-close-btn");
const addToggleBtn      = document.getElementById("add-toggle-btn");
const addFoodPanel      = document.getElementById("add-food-panel");
const addBtn            = document.getElementById("add-btn");
const addCancelBtn      = document.getElementById("add-cancel-btn");
const foodListEl        = document.getElementById("food-list");
const historyListEl     = document.getElementById("history-list");
const categoryFiltersEl = document.getElementById("category-filters");
const settingsToggle    = document.getElementById("settings-toggle");
const settingsPanel     = document.getElementById("settings-panel");
const weightingEnabledEl   = document.getElementById("weighting-enabled");
const reductionPercentEl   = document.getElementById("reduction-percent");
const withinDaysEl         = document.getElementById("within-days");
const weightingOptionsEl   = document.getElementById("weighting-options");
const saveSettingsBtn      = document.getElementById("save-settings-btn");
const pageTitle            = document.getElementById("page-title");
const foodSectionTitle     = document.getElementById("food-section-title");
const modeEatoutBtn        = document.getElementById("mode-eatout-btn");
const modeCookAtHomeBtn    = document.getElementById("mode-cookathome-btn");
const addEatoutFields      = document.getElementById("add-eatout-fields");
const addCookAtHomeFields  = document.getElementById("add-cookathome-fields");
const notesEatoutSection   = document.getElementById("notes-eatout-section");
const notesCahSection      = document.getElementById("notes-cookathome-section");
const notesPrintBtn        = document.getElementById("notes-print-btn");
const notesShoppingBtn     = document.getElementById("notes-shopping-btn");

// ── State ─────────────────────────────────────────────────────────────────────

let foods            = [];
let history          = [];
let settings         = { weightingEnabled: false, reductionPercent: 50, withinDays: 7 };
let currentMode      = "eatOut";   // "eatOut" | "cookAtHome"
let activeCategories = new Set();

// Eat out filters
let filterDriveThru   = false;
let filterOnlineOrder = false;
let filterDineIn      = false;

// Cook at home filters
let filterQuick    = false;
let filterSlowCook = false;
let filterOvenBake = false;
let filterGrill    = false;
let filterOnePot   = false;
let filterNoCook   = false;
let filterCookTime = null;   // null | "short" | "medium" | "long"

let currentRotation = 0;
let spinning        = false;
let lastPickEntry   = null;

// ── API helper ────────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const { body, ...rest } = opts;
  const res = await fetch(path, {
    ...rest,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  [foods, history, settings] = await Promise.all([
    api("/api/foods"),
    api("/api/history"),
    api("/api/settings"),
  ]);
  applySettingsToPanel();
  render();
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function switchMode(mode) {
  currentMode = mode;

  modeEatoutBtn.classList.toggle("mode-btn-active", mode === "eatOut");
  modeCookAtHomeBtn.classList.toggle("mode-btn-active", mode === "cookAtHome");

  pageTitle.textContent       = mode === "eatOut" ? "What's for Dinner?" : "What Should I Cook?";
  foodSectionTitle.textContent = mode === "eatOut" ? "Food Options" : "Recipes";
  addToggleBtn.textContent     = mode === "eatOut" ? "+ Add Location" : "+ Add Recipe";

  // Reset all filters
  activeCategories.clear();
  filterDriveThru = filterOnlineOrder = filterDineIn = false;
  filterQuick = filterSlowCook = filterOvenBake = filterGrill = filterOnePot = filterNoCook = false;
  filterCookTime = null;

  // Clear result
  resultText.textContent = "";
  markEatenBtn.classList.add("hidden");
  lastPickEntry = null;

  closeAddPanel();
  render();
}

modeEatoutBtn.addEventListener("click",     () => switchMode("eatOut"));
modeCookAtHomeBtn.addEventListener("click", () => switchMode("cookAtHome"));

// ── Settings ──────────────────────────────────────────────────────────────────

function applySettingsToPanel() {
  weightingEnabledEl.checked = settings.weightingEnabled;
  reductionPercentEl.value   = settings.reductionPercent;
  withinDaysEl.value         = settings.withinDays;
  weightingOptionsEl.classList.toggle("hidden", !settings.weightingEnabled);
}

settingsToggle.addEventListener("click", () => settingsPanel.classList.toggle("hidden"));

weightingEnabledEl.addEventListener("change", () => {
  weightingOptionsEl.classList.toggle("hidden", !weightingEnabledEl.checked);
});

saveSettingsBtn.addEventListener("click", async () => {
  try {
    settings = await api("/api/settings", {
      method: "PUT",
      body: {
        weightingEnabled: weightingEnabledEl.checked,
        reductionPercent: parseInt(reductionPercentEl.value, 10),
        withinDays:       parseInt(withinDaysEl.value, 10),
      },
    });
    settingsPanel.classList.add("hidden");
    drawWheel();
  } catch (e) { alert(e.message); }
});

// ── Help modal ────────────────────────────────────────────────────────────────

helpToggle.addEventListener("click", () => helpModal.classList.toggle("hidden"));
helpCloseBtn.addEventListener("click", () => helpModal.classList.add("hidden"));
helpModal.addEventListener("click", e => { if (e.target === helpModal) helpModal.classList.add("hidden"); });

// ── Notes modal ──────────────────────────────────────────────────────────────

let currentNotesFood = null;

function openNotesModal(food) {
  currentNotesFood = food;
  notesModalTitle.textContent = food.name;

  const isCah = food.mode === "cookAtHome";
  notesEatoutSection.classList.toggle("hidden", isCah);
  notesCahSection.classList.toggle("hidden", !isCah);

  if (isCah) {
    document.getElementById("notes-ingredients").value  = food.ingredients  || "";
    document.getElementById("notes-instructions").value = food.instructions || "";
    document.getElementById("notes-general").value      = food.notes        || "";
  } else {
    notesTextarea.value = food.notes || "";
  }

  notesPrintBtn.classList.toggle("hidden", !isCah);
  notesShoppingBtn.classList.toggle("hidden", !isCah);

  notesModal.classList.remove("hidden");
  if (isCah) document.getElementById("notes-ingredients").focus();
  else notesTextarea.focus();
}

function closeNotesModal() {
  notesModal.classList.add("hidden");
  currentNotesFood = null;
}

notesSaveBtn.addEventListener("click", async () => {
  if (!currentNotesFood) return;
  const isCah = currentNotesFood.mode === "cookAtHome";

  const body = isCah ? {
    ingredients:  document.getElementById("notes-ingredients").value,
    instructions: document.getElementById("notes-instructions").value,
    notes:        document.getElementById("notes-general").value,
  } : {
    notes: notesTextarea.value,
  };

  try {
    const updated = await api(`/api/foods/${currentNotesFood.id}`, { method: "PUT", body });
    const idx = foods.findIndex(f => f.id === updated.id);
    if (idx !== -1) foods[idx] = updated;
    closeNotesModal();
    renderFoodList();
  } catch (e) { alert(e.message); }
});

notesCancelBtn.addEventListener("click", closeNotesModal);
notesCloseBtn.addEventListener("click", closeNotesModal);

notesPrintBtn.addEventListener("click", () => {
  if (!currentNotesFood) return;
  printRecipe(currentNotesFood);
});

notesShoppingBtn.addEventListener("click", () => {
  if (!currentNotesFood) return;
  printShoppingList(currentNotesFood);
});

function printShoppingList(food) {
  const ingredients = document.getElementById("notes-ingredients").value.trim();
  if (!ingredients) { alert("No ingredients saved for this recipe yet."); return; }

  const items = ingredients.split("\n")
    .map(l => l.trim()).filter(Boolean)
    .map(l => `<li>${l}</li>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shopping List — ${food.name}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 520px; margin: 2rem auto; padding: 0 1rem; color: #111; line-height: 1.7; }
    h1 { font-size: 1.5rem; margin: 0 0 0.2rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.2rem; border-bottom: 2px solid #333; padding-bottom: 0.6rem; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { font-size: 1rem; padding: 0.25rem 0; }
    li::before { content: "\\2610"; margin-right: 0.7em; font-size: 1.1rem; }
    @media print { body { margin: 0.5in; } }
  </style>
</head>
<body>
  <h1>Shopping List</h1>
  <p class="meta">${food.name}</p>
  <ul>${items}</ul>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

function printRecipe(food) {
  const ingredients  = document.getElementById("notes-ingredients").value  || "";
  const instructions = document.getElementById("notes-instructions").value || "";
  const notes        = document.getElementById("notes-general").value      || "";

  const sec = (title, body) => body.trim()
    ? `<h2>${title}</h2><div class="block">${body.trim().replace(/\n/g, "<br>")}</div>`
    : "";

  const meta = [
    food.category ? `Category: ${food.category}` : "",
    food.cookTime ? `Cook time: ${food.cookTime} min` : "",
  ].filter(Boolean).join("&nbsp;&nbsp;·&nbsp;&nbsp;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${food.name}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 680px; margin: 2rem auto; padding: 0 1rem; color: #111; line-height: 1.6; }
    h1 { font-size: 1.8rem; margin: 0 0 0.3rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.2rem; border-bottom: 2px solid #333; padding-bottom: 0.6rem; }
    h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.06em; margin: 1.4rem 0 0.4rem; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem; }
    .block { font-size: 0.95rem; white-space: pre-wrap; margin: 0; }
    @media print { body { margin: 0.5in; } }
  </style>
</head>
<body>
  <h1>${food.name}</h1>
  ${meta ? `<p class="meta">${meta}</p>` : ""}
  ${sec("Ingredients", ingredients)}
  ${sec("Instructions", instructions)}
  ${sec("Notes", notes)}
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}
notesModal.addEventListener("click", e => { if (e.target === notesModal) closeNotesModal(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeNotesModal();
    helpModal.classList.add("hidden");
    document.getElementById("plan-modal").classList.add("hidden");
  }
});

// ── Render orchestration ──────────────────────────────────────────────────────

function render() {
  renderCategories();
  renderFoodList();
  renderHistory();
  drawWheel();
  updateSpinBtn();
}

function getFilteredFoods() {
  let result = foods.filter(f => (f.mode || "eatOut") === currentMode && !f.disabled);

  if (activeCategories.size > 0)
    result = result.filter(f => f.category && activeCategories.has(f.category));

  if (currentMode === "eatOut") {
    if (filterDriveThru)   result = result.filter(f => f.driveThru);
    if (filterOnlineOrder) result = result.filter(f => f.onlineOrder);
    if (filterDineIn)      result = result.filter(f => f.dineIn);
  } else {
    if (filterQuick)    result = result.filter(f => f.quick);
    if (filterSlowCook) result = result.filter(f => f.slowCook);
    if (filterOvenBake) result = result.filter(f => f.ovenBake);
    if (filterGrill)    result = result.filter(f => f.grill);
    if (filterOnePot)   result = result.filter(f => f.onePot);
    if (filterNoCook)   result = result.filter(f => f.noCook);
    if (filterCookTime === "short")  result = result.filter(f => (f.cookTime || 0) > 0 && (f.cookTime || 0) <= 30);
    if (filterCookTime === "medium") result = result.filter(f => (f.cookTime || 0) > 30 && (f.cookTime || 0) <= 60);
    if (filterCookTime === "long")   result = result.filter(f => (f.cookTime || 0) > 60);
  }

  return result;
}

// ── Category & feature filter chips ──────────────────────────────────────────

function renderCategories() {
  const modeFoods = foods.filter(f => (f.mode || "eatOut") === currentMode);
  const cats = [...new Set(modeFoods.map(f => f.category).filter(Boolean))].sort();
  categoryFiltersEl.innerHTML = "";

  // Row 1: category chips
  if (cats.length > 0) {
    const row = document.createElement("div");
    row.className = "filter-row";
    row.appendChild(makeChip("All", activeCategories.size === 0, () => {
      activeCategories.clear(); renderCategories(); drawWheel(); updateSpinBtn();
    }));
    for (const cat of cats) {
      row.appendChild(makeChip(cat, activeCategories.has(cat), () => {
        if (activeCategories.has(cat)) activeCategories.delete(cat);
        else activeCategories.add(cat);
        renderCategories(); drawWheel(); updateSpinBtn();
      }));
    }
    categoryFiltersEl.appendChild(row);
  }

  if (currentMode === "eatOut") {
    const hasDt = modeFoods.some(f => f.driveThru);
    const hasOo = modeFoods.some(f => f.onlineOrder);
    const hasDi = modeFoods.some(f => f.dineIn);
    if (hasDt || hasOo || hasDi) {
      const row = document.createElement("div");
      row.className = "filter-row";
      if (hasDt) row.appendChild(makeChip("🚗 Drive-thru", filterDriveThru, () => {
        filterDriveThru = !filterDriveThru; renderCategories(); drawWheel(); updateSpinBtn();
      }));
      if (hasOo) row.appendChild(makeChip("📱 Online ordering", filterOnlineOrder, () => {
        filterOnlineOrder = !filterOnlineOrder; renderCategories(); drawWheel(); updateSpinBtn();
      }));
      if (hasDi) row.appendChild(makeChip("🍽️ Dine-in only", filterDineIn, () => {
        filterDineIn = !filterDineIn; renderCategories(); drawWheel(); updateSpinBtn();
      }));
      categoryFiltersEl.appendChild(row);
    }
  } else {
    // Cook at home feature chips
    const cahFeatures = [
      { key: "quick",    label: "⚡ Quick",     get: () => filterQuick,    set: () => { filterQuick    = !filterQuick; } },
      { key: "slowCook", label: "🕐 Slow Cook", get: () => filterSlowCook, set: () => { filterSlowCook = !filterSlowCook; } },
      { key: "ovenBake", label: "🔆 Oven/Bake", get: () => filterOvenBake, set: () => { filterOvenBake = !filterOvenBake; } },
      { key: "grill",    label: "🔥 Grill",     get: () => filterGrill,    set: () => { filterGrill    = !filterGrill; } },
      { key: "onePot",   label: "🍲 One Pot",   get: () => filterOnePot,   set: () => { filterOnePot   = !filterOnePot; } },
      { key: "noCook",   label: "🥗 No Cook",   get: () => filterNoCook,   set: () => { filterNoCook   = !filterNoCook; } },
    ].filter(({ key }) => modeFoods.some(f => f[key]));

    if (cahFeatures.length > 0) {
      const row = document.createElement("div");
      row.className = "filter-row";
      for (const { label, get, set } of cahFeatures) {
        row.appendChild(makeChip(label, get(), () => { set(); renderCategories(); drawWheel(); updateSpinBtn(); }));
      }
      categoryFiltersEl.appendChild(row);
    }

    // Cook time range chips — only if any entry has a cookTime set
    if (modeFoods.some(f => f.cookTime)) {
      const row = document.createElement("div");
      row.className = "filter-row";
      const ranges = [
        { label: "≤ 30 min", value: "short" },
        { label: "31–60 min", value: "medium" },
        { label: "60+ min",  value: "long" },
      ];
      for (const { label, value } of ranges) {
        row.appendChild(makeChip(label, filterCookTime === value, () => {
          filterCookTime = filterCookTime === value ? null : value;
          renderCategories(); drawWheel(); updateSpinBtn();
        }));
      }
      categoryFiltersEl.appendChild(row);
    }
  }
}

function makeChip(label, active, onClick) {
  const btn = document.createElement("button");
  btn.className   = "chip" + (active ? " chip-active" : "");
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

// ── Food list ─────────────────────────────────────────────────────────────────

function renderFoodList() {
  foodListEl.innerHTML = "";
  const modeFoods = foods.filter(f => (f.mode || "eatOut") === currentMode);
  if (modeFoods.length === 0) {
    const msg = currentMode === "eatOut"
      ? "No food options yet. Add some above!"
      : "No recipes yet. Add some above!";
    foodListEl.innerHTML = `<li class="empty-msg">${msg}</li>`;
    return;
  }
  for (const food of modeFoods) foodListEl.appendChild(makeFoodItem(food));
}

function makeFoodItem(food) {
  const li    = document.createElement("li");
  const isCah = food.mode === "cookAtHome";
  li.classList.toggle("food-disabled", !!food.disabled);

  const nameSpan = (!isCah && food.website)
    ? Object.assign(document.createElement("a"), {
        href: normalizeUrl(food.website), target: "_blank", rel: "noopener noreferrer",
      })
    : document.createElement("span");
  nameSpan.className   = "food-name";
  nameSpan.textContent = food.name;

  const catBadge = document.createElement("span");
  catBadge.className   = "cat-badge";
  catBadge.textContent = food.category || "";
  catBadge.hidden      = !food.category;

  const hasNotes = isCah
    ? (food.ingredients || food.instructions || food.notes)
    : food.notes;

  const pauseBtn = document.createElement("button");
  pauseBtn.className   = "icon-btn pause-btn";
  pauseBtn.title       = food.disabled ? "Return to wheel" : "Remove from wheel";
  pauseBtn.textContent = food.disabled ? "▶" : "⏸";
  pauseBtn.addEventListener("click", async () => {
    try {
      const updated = await api(`/api/foods/${food.id}`, {
        method: "PUT",
        body: { disabled: !food.disabled },
      });
      const idx = foods.findIndex(f => f.id === updated.id);
      if (idx !== -1) foods[idx] = updated;
      render();
    } catch (e) { alert(e.message); }
  });

  const notesBtn = document.createElement("button");
  notesBtn.className   = "icon-btn notes-btn" + (hasNotes ? " has-notes" : "");
  notesBtn.title       = hasNotes ? "View/edit notes" : "Add notes";
  notesBtn.textContent = "📝";
  notesBtn.addEventListener("click", () => openNotesModal(food));

  const editBtn = document.createElement("button");
  editBtn.className   = "icon-btn";
  editBtn.title       = "Edit";
  editBtn.textContent = "✏️";
  editBtn.addEventListener("click", () => enterEditMode(li, food));

  const delBtn = document.createElement("button");
  delBtn.className   = "icon-btn del";
  delBtn.title       = "Delete";
  delBtn.textContent = "✕";
  delBtn.addEventListener("click", () => removeFood(food.id));

  li.append(nameSpan, catBadge);

  const entryWeight = food.weight ?? 100;
  if (entryWeight !== 100) {
    const wb = document.createElement("span");
    wb.className   = "weight-badge";
    wb.title       = "Spin weight";
    wb.textContent = `${entryWeight}%`;
    li.appendChild(wb);
  }

  if (isCah) {
    if (food.cookTime) {
      const ctb = document.createElement("span");
      ctb.className   = "cook-time-badge";
      ctb.title       = "Cook time";
      ctb.textContent = `${food.cookTime} min`;
      li.appendChild(ctb);
    }
    for (const [key, emoji, title] of [
      ["quick",    "⚡", "Quick"],
      ["slowCook", "🕐", "Slow Cook"],
      ["ovenBake", "🔆", "Oven/Bake"],
      ["grill",    "🔥", "Grill"],
      ["onePot",   "🍲", "One Pot"],
      ["noCook",   "🥗", "No Cook"],
    ]) {
      if (food[key]) {
        const b = document.createElement("span");
        b.className = "feat-badge"; b.title = title; b.textContent = emoji;
        li.appendChild(b);
      }
    }
  } else {
    for (const [key, emoji, title] of [
      ["driveThru",   "🚗", "Drive-thru available"],
      ["onlineOrder", "📱", "Online ordering available"],
      ["dineIn",      "🍽️", "Dine-in only"],
    ]) {
      if (food[key]) {
        const b = document.createElement("span");
        b.className = "feat-badge"; b.title = title; b.textContent = emoji;
        li.appendChild(b);
      }
    }
  }

  li.append(pauseBtn, notesBtn, editBtn, delBtn);
  return li;
}

function enterEditMode(li, food) {
  const isCah = food.mode === "cookAtHome";

  const nameInput = document.createElement("input");
  nameInput.value = food.name; nameInput.maxLength = 40; nameInput.className = "edit-input";

  const catInput = document.createElement("input");
  catInput.value = food.category || ""; catInput.maxLength = 30;
  catInput.placeholder = "Category"; catInput.className = "edit-input edit-cat";

  const saveBtn = document.createElement("button");
  saveBtn.className = "icon-btn"; saveBtn.title = "Save"; saveBtn.textContent = "💾";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "icon-btn del"; cancelBtn.title = "Cancel"; cancelBtn.textContent = "✕";

  const checksDiv = document.createElement("div");
  checksDiv.className = "edit-checks";

  let getBody;

  if (!isCah) {
    const urlInput = document.createElement("input");
    urlInput.type = "url"; urlInput.value = food.website || "";
    urlInput.placeholder = "Website URL (optional)"; urlInput.className = "edit-input edit-url";

    const makeCb = (checked, label) => {
      const lbl = document.createElement("label");
      const cb  = document.createElement("input");
      cb.type = "checkbox"; cb.checked = checked;
      lbl.append(cb, " " + label);
      return { lbl, cb };
    };
    const { lbl: dtL, cb: dtCb } = makeCb(!!food.driveThru,   "Drive-thru");
    const { lbl: ooL, cb: ooCb } = makeCb(!!food.onlineOrder, "Online ordering");
    const { lbl: diL, cb: diCb } = makeCb(!!food.dineIn,      "Dine-in only");

    const wLabel = document.createElement("label"); wLabel.className = "weight-label";
    const wInput = document.createElement("input");
    wInput.type = "number"; wInput.min = "1"; wInput.max = "999";
    wInput.value = food.weight ?? 100; wInput.className = "edit-input edit-weight-input";
    wLabel.append("Weight: ", wInput, "%");

    checksDiv.append(dtL, ooL, diL, wLabel);

    getBody = () => ({
      name: nameInput.value.trim(), category: catInput.value.trim(),
      website: urlInput.value.trim(),
      driveThru: dtCb.checked, onlineOrder: ooCb.checked, dineIn: diCb.checked,
      weight: Math.max(1, Math.min(999, parseInt(wInput.value) || 100)),
    });

    li.innerHTML = ""; li.style.flexWrap = "wrap";
    li.append(nameInput, catInput, saveBtn, cancelBtn, urlInput, checksDiv);

  } else {
    const ctInput = document.createElement("input");
    ctInput.type = "number"; ctInput.min = "0"; ctInput.max = "999";
    ctInput.value = food.cookTime || ""; ctInput.placeholder = "0";
    ctInput.className = "edit-cooktime";
    const ctWrapper = document.createElement("div");
    ctWrapper.className = "cook-time-input-label";
    ctWrapper.append("Cook time: ", ctInput, " min");

    const flags = [
      ["quick", "⚡ Quick"], ["slowCook", "🕐 Slow Cook"], ["ovenBake", "🔆 Oven/Bake"],
      ["grill", "🔥 Grill"], ["onePot",  "🍲 One Pot"],   ["noCook",   "🥗 No Cook"],
    ];
    const cbs = {};
    for (const [key, label] of flags) {
      const lbl = document.createElement("label");
      const cb  = document.createElement("input");
      cb.type = "checkbox"; cb.checked = !!food[key];
      lbl.append(cb, " " + label);
      checksDiv.appendChild(lbl);
      cbs[key] = cb;
    }

    const wLabel = document.createElement("label"); wLabel.className = "weight-label";
    const wInput = document.createElement("input");
    wInput.type = "number"; wInput.min = "1"; wInput.max = "999";
    wInput.value = food.weight ?? 100; wInput.className = "edit-input edit-weight-input";
    wLabel.append("Weight: ", wInput, "%");
    checksDiv.appendChild(wLabel);

    getBody = () => ({
      name: nameInput.value.trim(), category: catInput.value.trim(),
      cookTime: parseInt(ctInput.value) || 0,
      quick: cbs.quick.checked, slowCook: cbs.slowCook.checked,
      ovenBake: cbs.ovenBake.checked, grill: cbs.grill.checked,
      onePot: cbs.onePot.checked, noCook: cbs.noCook.checked,
      weight: Math.max(1, Math.min(999, parseInt(wInput.value) || 100)),
    });

    li.innerHTML = ""; li.style.flexWrap = "wrap";
    li.append(nameInput, catInput, saveBtn, cancelBtn, ctWrapper, checksDiv);
  }

  async function doSave() {
    const body = getBody();
    if (!body.name) { alert("Name cannot be empty"); return; }
    try {
      const updated = await api(`/api/foods/${food.id}`, { method: "PUT", body });
      const idx = foods.findIndex(f => f.id === updated.id);
      if (idx !== -1) foods[idx] = updated;
      render();
    } catch (e) { alert(e.message); }
  }

  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter")  doSave();
    if (e.key === "Escape") renderFoodList();
  });
  saveBtn.addEventListener("click", doSave);
  cancelBtn.addEventListener("click", () => renderFoodList());
  nameInput.focus();
}

async function removeFood(id) {
  try {
    foods = await api(`/api/foods/${id}`, { method: "DELETE" });
    render();
  } catch (e) { alert(e.message); }
}

// ── Add food / recipe ─────────────────────────────────────────────────────────

function openAddPanel() {
  addFoodPanel.classList.remove("hidden");
  addToggleBtn.classList.add("hidden");
  addEatoutFields.classList.toggle("hidden",     currentMode !== "eatOut");
  addCookAtHomeFields.classList.toggle("hidden", currentMode !== "cookAtHome");
  addBtn.textContent = currentMode === "eatOut" ? "Add Location" : "Add Recipe";
  foodNameInput.focus();
}

function closeAddPanel() {
  addFoodPanel.classList.add("hidden");
  addToggleBtn.classList.remove("hidden");
  foodNameInput.value  = "";
  foodCatInput.value   = "";
  foodUrlInput.value   = "";
  foodDtInput.checked  = false;
  foodOoInput.checked  = false;
  foodDiInput.checked  = false;
  foodWeightInput.value = "100";
  document.getElementById("food-cooktime-input").value      = "";
  document.getElementById("food-quick-input").checked       = false;
  document.getElementById("food-slowcook-input").checked    = false;
  document.getElementById("food-ovenbake-input").checked    = false;
  document.getElementById("food-grill-input").checked       = false;
  document.getElementById("food-onepot-input").checked      = false;
  document.getElementById("food-nocook-input").checked      = false;
}

addToggleBtn.addEventListener("click", openAddPanel);
addCancelBtn.addEventListener("click", closeAddPanel);
addBtn.addEventListener("click", addFood);
foodNameInput.addEventListener("keydown", e => { if (e.key === "Enter") addFood(); });

async function addFood() {
  const name = foodNameInput.value.trim();
  if (!name) return;
  addBtn.disabled = true;
  try {
    const body = {
      name,
      mode:     currentMode,
      category: foodCatInput.value.trim(),
      weight:   Math.max(1, Math.min(999, parseInt(foodWeightInput.value) || 100)),
    };

    if (currentMode === "eatOut") {
      body.website     = foodUrlInput.value.trim();
      body.driveThru   = foodDtInput.checked;
      body.onlineOrder = foodOoInput.checked;
      body.dineIn      = foodDiInput.checked;
    } else {
      body.cookTime  = parseInt(document.getElementById("food-cooktime-input").value) || 0;
      body.quick     = document.getElementById("food-quick-input").checked;
      body.slowCook  = document.getElementById("food-slowcook-input").checked;
      body.ovenBake  = document.getElementById("food-ovenbake-input").checked;
      body.grill     = document.getElementById("food-grill-input").checked;
      body.onePot    = document.getElementById("food-onepot-input").checked;
      body.noCook    = document.getElementById("food-nocook-input").checked;
    }

    foods = await api("/api/foods", { method: "POST", body });
    closeAddPanel();
    render();
  } catch (e) {
    alert(e.message);
  } finally {
    addBtn.disabled = false;
  }
}

// ── History ───────────────────────────────────────────────────────────────────

function renderHistory() {
  historyListEl.innerHTML = "";
  const modeHistory = history.filter(e => (e.mode || "eatOut") === currentMode);
  if (modeHistory.length === 0) {
    historyListEl.innerHTML = '<li class="empty-msg">No picks yet — spin the wheel!</li>';
    return;
  }
  for (const entry of modeHistory) historyListEl.appendChild(makeHistoryItem(entry));
}

function makeHistoryItem(entry) {
  const li = document.createElement("li");
  li.classList.toggle("confirmed", entry.confirmed);

  const checkbox   = document.createElement("input");
  checkbox.type    = "checkbox";
  checkbox.checked = entry.confirmed;
  checkbox.title   = "Mark as eaten";
  checkbox.addEventListener("change", async () => {
    try {
      const updated = await api(`/api/history/${entry.id}`, {
        method: "PATCH",
        body: { confirmed: checkbox.checked },
      });
      entry.confirmed = updated.confirmed;
      li.classList.toggle("confirmed", entry.confirmed);
      if (lastPickEntry && lastPickEntry.id === entry.id) {
        lastPickEntry.confirmed = entry.confirmed;
        syncMarkEatenBtn();
      }
    } catch (e) { checkbox.checked = !checkbox.checked; }
  });

  const label      = document.createElement("span");
  label.className  = "history-label";
  label.textContent = entry.foodName;

  const dateSpan     = document.createElement("span");
  dateSpan.className = "history-date";
  dateSpan.textContent = formatDate(entry.pickedAt);

  const delBtn     = document.createElement("button");
  delBtn.className = "icon-btn del";
  delBtn.title     = "Remove entry";
  delBtn.textContent = "✕";
  delBtn.addEventListener("click", async () => {
    try {
      history = await api(`/api/history/${entry.id}`, { method: "DELETE" });
      renderHistory();
    } catch (e) { alert(e.message); }
  });

  li.append(checkbox, label, dateSpan, delBtn);
  return li;
}

function formatDate(iso) {
  const d        = new Date(iso);
  const diffDays = Math.floor((Date.now() - d) / 86400000);
  const time     = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` ${time}`;
}

// ── Mark as eaten (result shortcut) ──────────────────────────────────────────

markEatenBtn.addEventListener("click", async () => {
  if (!lastPickEntry || lastPickEntry.confirmed) return;
  try {
    const updated = await api(`/api/history/${lastPickEntry.id}`, {
      method: "PATCH",
      body: { confirmed: true },
    });
    lastPickEntry.confirmed = updated.confirmed;
    history = history.map(e => e.id === updated.id ? updated : e);
    renderHistory();
    syncMarkEatenBtn();
  } catch (e) { alert(e.message); }
});

function syncMarkEatenBtn() {
  if (!lastPickEntry) return;
  if (lastPickEntry.confirmed) {
    markEatenBtn.textContent = "✓ Eaten";
    markEatenBtn.disabled    = true;
  } else {
    markEatenBtn.textContent = "Mark as Eaten";
    markEatenBtn.disabled    = false;
  }
}

// ── Wheel drawing ─────────────────────────────────────────────────────────────

function computeWeights(wheelFoods) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.withinDays);
  return wheelFoods.map(food => {
    const base = (food.weight ?? 100) / 100;
    if (!settings.weightingEnabled) return base;
    const recentlyEaten = history.some(
      h => h.foodId === food.id && h.confirmed && new Date(h.pickedAt) > cutoff
    );
    return recentlyEaten ? Math.max(0.01, base * (1 - settings.reductionPercent / 100)) : base;
  });
}

function drawWheel() {
  if (spinning) return;
  const size   = canvas.width;
  const center = size / 2;
  const radius = center - 4;
  ctx.clearRect(0, 0, size, size);

  const wheelFoods = getFilteredFoods();

  if (wheelFoods.length === 0) {
    ctx.fillStyle = "#2a2a3d";
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle    = "#666";
    ctx.font         = "15px sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      currentMode === "eatOut" ? "Add food options below" : "Add recipes below",
      center, center
    );
    return;
  }

  const weights     = computeWeights(wheelFoods);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let startAngle    = -Math.PI / 2;

  wheelFoods.forEach((food, i) => {
    const sliceAngle = (weights[i] / totalWeight) * Math.PI * 2;
    const endAngle   = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#1e1e2e";
    ctx.lineWidth   = 2;
    ctx.stroke();

    if (sliceAngle > 0.15) {
      const maxChars = sliceAngle > 1 ? 18 : 10;
      const label    = food.name.length > maxChars
        ? food.name.slice(0, maxChars - 1) + "…"
        : food.name;
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = "#1e1e2e";
      ctx.font         = "bold 15px sans-serif";
      ctx.fillText(label, radius - 12, 0);
      ctx.restore();
    }

    startAngle = endAngle;
  });

  // Center hub — covers the point where all slices meet for a cleaner look
  ctx.beginPath();
  ctx.arc(center, center, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#2a2a3d";
  ctx.fill();
  ctx.strokeStyle = "#1e1e2e";
  ctx.lineWidth   = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(center, center, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#f5c518";
  ctx.fill();
}

// ── Spin ──────────────────────────────────────────────────────────────────────

function updateSpinBtn() {
  spinBtn.disabled = getFilteredFoods().length < 2 || spinning;
}

function weightedRandom(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

spinBtn.addEventListener("click", async () => {
  if (spinning) return;
  const wheelFoods = getFilteredFoods();
  if (wheelFoods.length < 2) return;

  spinning = true;
  updateSpinBtn();

  resultText.textContent   = "";
  markEatenBtn.textContent = "Mark as Eaten";
  markEatenBtn.disabled    = false;
  markEatenBtn.classList.add("hidden");
  lastPickEntry = null;

  const weights     = computeWeights(wheelFoods);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const winnerIndex = weightedRandom(weights);

  let cumDeg = 0;
  for (let i = 0; i < winnerIndex; i++) cumDeg += (weights[i] / totalWeight) * 360;
  const sliceDeg     = (weights[winnerIndex] / totalWeight) * 360;
  const targetCenter = cumDeg + sliceDeg / 2;

  const desiredMod = (360 - targetCenter) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let delta = desiredMod - currentMod;
  if (delta < 0) delta += 360;

  currentRotation += 5 * 360 + delta;
  canvas.style.transform = `rotate(${currentRotation}deg)`;

  canvas.addEventListener("transitionend", async function onEnd() {
    canvas.removeEventListener("transitionend", onEnd);
    spinning = false;
    updateSpinBtn();

    const finalMod   = ((currentRotation % 360) + 360) % 360;
    const pointerPos = (360 - finalMod + 360) % 360;
    let cumAngle = 0;
    let actualIdx = wheelFoods.length - 1;
    for (let i = 0; i < wheelFoods.length; i++) {
      cumAngle += (weights[i] / totalWeight) * 360;
      if (pointerPos < cumAngle) { actualIdx = i; break; }
    }
    const winner = wheelFoods[actualIdx];

    resultText.textContent = currentMode === "eatOut"
      ? `🍽️ ${winner.name}`
      : `🍳 ${winner.name}`;

    try {
      const entry = await api("/api/history", {
        method: "POST",
        body: { foodId: winner.id, foodName: winner.name, mode: currentMode },
      });
      history.unshift(entry);
      lastPickEntry = entry;
      renderHistory();
      markEatenBtn.classList.remove("hidden");
    } catch (_) { /* non-fatal */ }
  });
});

// ── Weekly planner ────────────────────────────────────────────────────────────

const planWeekBtn    = document.getElementById("plan-week-btn");
const planModal      = document.getElementById("plan-modal");
const planModalTitle = document.getElementById("plan-modal-title");
const planListEl     = document.getElementById("plan-list");
const planCloseBtn   = document.getElementById("plan-close-btn");
const planCancelBtn  = document.getElementById("plan-cancel-btn");
const planSaveBtn    = document.getElementById("plan-save-btn");
const planRegenBtn   = document.getElementById("plan-regen-btn");
const planPrintBtn   = document.getElementById("plan-print-btn");

const PLAN_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
let currentPlan = [];

function generatePlan() {
  const pool = getFilteredFoods();
  const used = new Set();
  currentPlan = PLAN_DAYS.map(day => {
    let candidates = pool.filter(f => !used.has(f.id));
    if (candidates.length === 0) { used.clear(); candidates = pool; }
    const f = candidates[weightedRandom(computeWeights(candidates))];
    used.add(f.id);
    return { day, foodId: f.id, foodName: f.name };
  });
}

function rerollDay(i) {
  const pool = getFilteredFoods();
  if (pool.length === 0) return;
  const usedIds = new Set(currentPlan.filter((_, j) => j !== i).map(p => p.foodId));
  let candidates = pool.filter(f => !usedIds.has(f.id) && f.id !== currentPlan[i].foodId);
  if (candidates.length === 0) candidates = pool.filter(f => f.id !== currentPlan[i].foodId);
  if (candidates.length === 0) candidates = pool;
  const f = candidates[weightedRandom(computeWeights(candidates))];
  currentPlan[i] = { day: currentPlan[i].day, foodId: f.id, foodName: f.name };
  renderPlanList();
}

function renderPlanList() {
  planListEl.innerHTML = "";
  currentPlan.forEach((p, i) => {
    const li = document.createElement("li");

    const day = document.createElement("span");
    day.className   = "plan-day";
    day.textContent = p.day;

    const food = document.createElement("span");
    food.className   = "plan-food";
    food.textContent = p.foodName;

    const reroll = document.createElement("button");
    reroll.className   = "icon-btn";
    reroll.title       = "Re-roll this day";
    reroll.textContent = "🎲";
    reroll.addEventListener("click", () => rerollDay(i));

    li.append(day, food, reroll);
    planListEl.appendChild(li);
  });
}

planWeekBtn.addEventListener("click", async () => {
  if (getFilteredFoods().length < 2) {
    alert("Add at least two entries (matching the current filters) to plan a week.");
    return;
  }
  planModalTitle.textContent = currentMode === "eatOut"
    ? "Weekly Plan — Eat Out"
    : "Weekly Plan — Cook at Home";
  try { currentPlan = await api(`/api/plan/${currentMode}`); } catch (_) { currentPlan = []; }
  if (!Array.isArray(currentPlan) || currentPlan.length === 0) generatePlan();
  renderPlanList();
  planModal.classList.remove("hidden");
});

function closePlanModal() { planModal.classList.add("hidden"); }
planCloseBtn.addEventListener("click", closePlanModal);
planCancelBtn.addEventListener("click", closePlanModal);
planModal.addEventListener("click", e => { if (e.target === planModal) closePlanModal(); });

planRegenBtn.addEventListener("click", () => { generatePlan(); renderPlanList(); });

planSaveBtn.addEventListener("click", async () => {
  try {
    await api(`/api/plan/${currentMode}`, { method: "PUT", body: currentPlan });
    closePlanModal();
  } catch (e) { alert(e.message); }
});

planPrintBtn.addEventListener("click", () => {
  const rows = currentPlan
    .map(p => `<li><span class="day">${p.day}</span>${p.foodName}</li>`).join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${planModalTitle.textContent}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 520px; margin: 2rem auto; padding: 0 1rem; color: #111; line-height: 1.8; }
    h1 { font-size: 1.5rem; margin: 0 0 1rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { font-size: 1rem; padding: 0.3rem 0; border-bottom: 1px solid #ddd; }
    .day { display: inline-block; width: 110px; font-weight: bold; }
    @media print { body { margin: 0.5in; } }
  </style>
</head>
<body>
  <h1>${planModalTitle.textContent}</h1>
  <ul>${rows}</ul>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
});

// ── Backup & Restore ─────────────────────────────────────────────────────────

const importBtn       = document.getElementById("import-btn");
const importFile      = document.getElementById("import-file");
const clearBtn        = document.getElementById("clear-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const loadDefaultsBtn = document.getElementById("load-defaults-btn");
const exportBtn       = document.getElementById("export-btn");

importBtn.addEventListener("click", () => importFile.click());

loadDefaultsBtn.addEventListener("click", async () => {
  if (!confirm("Load the default list?\n\nThis will replace your current Eat Out and Cook at Home lists and settings.")) return;

  if (confirm("Would you like to export a backup of your current config first?")) {
    exportBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  try {
    const config = await api("/api/config/default");
    const result = await api("/api/config/import", { method: "POST", body: config });
    foods    = result.foods;
    settings = result.settings;
    applySettingsToPanel();
    settingsPanel.classList.add("hidden");
    render();
  } catch (e) {
    alert(`Failed to load defaults: ${e.message}`);
  }
});

clearHistoryBtn.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to clear all pick history?\n\nThis cannot be undone.")) return;
  try {
    history = await api("/api/history/clear", { method: "POST" });
    renderHistory();
    settingsPanel.classList.add("hidden");
  } catch (e) {
    alert(`Clear failed: ${e.message}`);
  }
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to clear all food options and settings?\n\nThis cannot be undone.")) return;

  if (confirm("Would you like to export a backup before clearing?")) {
    exportBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  try {
    const result = await api("/api/config/clear", { method: "POST" });
    foods    = result.foods;
    settings = result.settings;
    applySettingsToPanel();
    settingsPanel.classList.add("hidden");
    render();
  } catch (e) {
    alert(`Clear failed: ${e.message}`);
  }
});

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;

  const confirmed = confirm(
    `Import "${file.name}"?\n\nThis will replace your current food list and settings. Pick history will not be affected.`
  );
  if (!confirmed) { importFile.value = ""; return; }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const result = await fetch("/api/config/import", { method: "POST", body: formData });
    const data   = await result.json();
    if (!result.ok) throw new Error(data.error || "Import failed");
    foods    = data.foods;
    settings = data.settings;
    applySettingsToPanel();
    render();
  } catch (e) {
    alert(`Import failed: ${e.message}`);
  } finally {
    importFile.value = "";
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

init();
