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

// ── State ─────────────────────────────────────────────────────────────────────

let foods            = [];
let history          = [];
let settings         = { weightingEnabled: false, reductionPercent: 50, withinDays: 7 };
let activeCategories  = new Set(); // empty = "All"
let filterDriveThru   = false;
let filterOnlineOrder = false;
let filterDineIn      = false;
let currentRotation   = 0;
let spinning         = false;
let lastPickEntry    = null;

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
  currentNotesFood  = food;
  notesModalTitle.textContent = food.name;
  notesTextarea.value         = food.notes || "";
  notesModal.classList.remove("hidden");
  notesTextarea.focus();
}

function closeNotesModal() {
  notesModal.classList.add("hidden");
  currentNotesFood = null;
}

notesSaveBtn.addEventListener("click", async () => {
  if (!currentNotesFood) return;
  try {
    const updated = await api(`/api/foods/${currentNotesFood.id}`, {
      method: "PUT",
      body: { notes: notesTextarea.value },
    });
    const idx = foods.findIndex(f => f.id === updated.id);
    if (idx !== -1) foods[idx] = { ...foods[idx], notes: updated.notes };
    closeNotesModal();
    renderFoodList();
  } catch (e) { alert(e.message); }
});

notesCancelBtn.addEventListener("click", closeNotesModal);
notesCloseBtn.addEventListener("click", closeNotesModal);
notesModal.addEventListener("click", e => { if (e.target === notesModal) closeNotesModal(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeNotesModal();
    helpModal.classList.add("hidden");
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
  let result = foods;
  if (activeCategories.size > 0)
    result = result.filter(f => f.category && activeCategories.has(f.category));
  if (filterDriveThru)   result = result.filter(f => f.driveThru);
  if (filterOnlineOrder) result = result.filter(f => f.onlineOrder);
  if (filterDineIn)      result = result.filter(f => f.dineIn);
  return result;
}

// ── Category multi-select chips ───────────────────────────────────────────────

function renderCategories() {
  const cats  = [...new Set(foods.map(f => f.category).filter(Boolean))].sort();
  const hasDt = foods.some(f => f.driveThru);
  const hasOo = foods.some(f => f.onlineOrder);
  const hasDi = foods.some(f => f.dineIn);
  categoryFiltersEl.innerHTML = "";
  if (cats.length === 0 && !hasDt && !hasOo && !hasDi) return;

  // Row 1: All + category chips
  if (cats.length > 0) {
    const row = document.createElement("div");
    row.className = "filter-row";

    row.appendChild(makeChip("All", activeCategories.size === 0, () => {
      activeCategories.clear();
      renderCategories(); drawWheel(); updateSpinBtn();
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

  // Row 2: feature filter chips (only if any food has that feature)
  if (hasDt || hasOo || hasDi) {
    const row = document.createElement("div");
    row.className = "filter-row";

    if (hasDt) {
      row.appendChild(makeChip("🚗 Drive-thru", filterDriveThru, () => {
        filterDriveThru = !filterDriveThru;
        renderCategories(); drawWheel(); updateSpinBtn();
      }));
    }
    if (hasOo) {
      row.appendChild(makeChip("📱 Online ordering", filterOnlineOrder, () => {
        filterOnlineOrder = !filterOnlineOrder;
        renderCategories(); drawWheel(); updateSpinBtn();
      }));
    }
    if (hasDi) {
      row.appendChild(makeChip("🍽️ Dine-in only", filterDineIn, () => {
        filterDineIn = !filterDineIn;
        renderCategories(); drawWheel(); updateSpinBtn();
      }));
    }
    categoryFiltersEl.appendChild(row);
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
  if (foods.length === 0) {
    foodListEl.innerHTML = '<li class="empty-msg">No food options yet. Add some above!</li>';
    return;
  }
  for (const food of foods) foodListEl.appendChild(makeFoodItem(food));
}

function makeFoodItem(food) {
  const li = document.createElement("li");

  const nameSpan = food.website
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

  const notesBtn = document.createElement("button");
  notesBtn.className   = "icon-btn notes-btn" + (food.notes ? " has-notes" : "");
  notesBtn.title       = food.notes ? "View/edit notes" : "Add notes";
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

  if (food.driveThru) {
    const b = document.createElement("span");
    b.className   = "feat-badge";
    b.title       = "Drive-thru available";
    b.textContent = "🚗";
    li.appendChild(b);
  }
  if (food.onlineOrder) {
    const b = document.createElement("span");
    b.className   = "feat-badge";
    b.title       = "Online ordering available";
    b.textContent = "📱";
    li.appendChild(b);
  }
  if (food.dineIn) {
    const b = document.createElement("span");
    b.className   = "feat-badge";
    b.title       = "Dine-in only";
    b.textContent = "🍽️";
    li.appendChild(b);
  }

  li.append(notesBtn, editBtn, delBtn);
  return li;
}

function enterEditMode(li, food) {
  const nameInput = document.createElement("input");
  nameInput.value     = food.name;
  nameInput.maxLength = 40;
  nameInput.className = "edit-input";

  const catInput = document.createElement("input");
  catInput.value       = food.category || "";
  catInput.maxLength   = 30;
  catInput.placeholder = "Category";
  catInput.className   = "edit-input edit-cat";

  const saveBtn = document.createElement("button");
  saveBtn.className   = "icon-btn";
  saveBtn.title       = "Save";
  saveBtn.textContent = "💾";

  const cancelBtn = document.createElement("button");
  cancelBtn.className   = "icon-btn del";
  cancelBtn.title       = "Cancel";
  cancelBtn.textContent = "✕";

  const urlInput = document.createElement("input");
  urlInput.type        = "url";
  urlInput.value       = food.website || "";
  urlInput.placeholder = "Website URL (optional)";
  urlInput.className   = "edit-input edit-url";

  // Feature checkboxes
  const checksDiv = document.createElement("div");
  checksDiv.className = "edit-checks";

  const dtLabel = document.createElement("label");
  const dtCb    = document.createElement("input");
  dtCb.type    = "checkbox";
  dtCb.checked = !!food.driveThru;
  dtLabel.append(dtCb, " Drive-thru");

  const ooLabel = document.createElement("label");
  const ooCb    = document.createElement("input");
  ooCb.type    = "checkbox";
  ooCb.checked = !!food.onlineOrder;
  ooLabel.append(ooCb, " Online ordering");

  const diLabel = document.createElement("label");
  const diCb    = document.createElement("input");
  diCb.type    = "checkbox";
  diCb.checked = !!food.dineIn;
  diLabel.append(diCb, " Dine-in only");

  checksDiv.append(dtLabel, ooLabel, diLabel);

  async function doSave() {
    const name = nameInput.value.trim();
    if (!name) { alert("Name cannot be empty"); return; }
    try {
      await api(`/api/foods/${food.id}`, {
        method: "PUT",
        body: {
          name,
          category:    catInput.value.trim(),
          website:     urlInput.value.trim(),
          driveThru:   dtCb.checked,
          onlineOrder: ooCb.checked,
          dineIn:      diCb.checked,
        },
      });
      foods = await api("/api/foods");
      render();
    } catch (e) { alert(e.message); }
  }

  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter")  doSave();
    if (e.key === "Escape") renderFoodList();
  });

  li.innerHTML = "";
  li.style.flexWrap = "wrap";
  li.append(nameInput, catInput, saveBtn, cancelBtn, urlInput, checksDiv);
  nameInput.focus();

  saveBtn.addEventListener("click", doSave);
  cancelBtn.addEventListener("click", () => renderFoodList());
}

async function removeFood(id) {
  try {
    foods = await api(`/api/foods/${id}`, { method: "DELETE" });
    render();
  } catch (e) { alert(e.message); }
}

// ── Add food ──────────────────────────────────────────────────────────────────

function openAddPanel() {
  addFoodPanel.classList.remove("hidden");
  addToggleBtn.classList.add("hidden");
  foodNameInput.focus();
}

function closeAddPanel() {
  addFoodPanel.classList.add("hidden");
  addToggleBtn.classList.remove("hidden");
  foodNameInput.value = "";
  foodCatInput.value  = "";
  foodUrlInput.value  = "";
  foodDtInput.checked = false;
  foodOoInput.checked = false;
  foodDiInput.checked = false;
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
    await api("/api/foods", {
      method: "POST",
      body: {
        name,
        category:    foodCatInput.value.trim(),
        website:     foodUrlInput.value.trim(),
        driveThru:   foodDtInput.checked,
        onlineOrder: foodOoInput.checked,
        dineIn:      foodDiInput.checked,
      },
    });
    foods = await api("/api/foods");
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
  if (history.length === 0) {
    historyListEl.innerHTML = '<li class="empty-msg">No picks yet — spin the wheel!</li>';
    return;
  }
  for (const entry of history) historyListEl.appendChild(makeHistoryItem(entry));
}

function makeHistoryItem(entry) {
  const li = document.createElement("li");
  li.classList.toggle("confirmed", entry.confirmed);

  const checkbox     = document.createElement("input");
  checkbox.type      = "checkbox";
  checkbox.checked   = entry.confirmed;
  checkbox.title     = "Mark as eaten";
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

  const label        = document.createElement("span");
  label.className    = "history-label";
  label.textContent  = entry.foodName;

  const dateSpan     = document.createElement("span");
  dateSpan.className   = "history-date";
  dateSpan.textContent = formatDate(entry.pickedAt);

  const delBtn       = document.createElement("button");
  delBtn.className   = "icon-btn del";
  delBtn.title       = "Remove entry";
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
  if (!settings.weightingEnabled) return wheelFoods.map(() => 1);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.withinDays);
  return wheelFoods.map(food => {
    const recentlyEaten = history.some(
      h => h.foodId === food.id && h.confirmed && new Date(h.pickedAt) > cutoff
    );
    return recentlyEaten ? Math.max(0.05, 1 - settings.reductionPercent / 100) : 1;
  });
}

function drawWheel() {
  if (spinning) return; // don't redraw mid-spin — canvas slices must stay fixed while CSS rotates
  const size    = canvas.width;
  const center  = size / 2;
  const radius  = center - 4;
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
    ctx.fillText("Add food options below", center, center);
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

    // Derive winner from where the wheel actually stopped rather than the pre-spin
    // calculation — this guarantees the result always matches what the pointer shows.
    const finalMod   = ((currentRotation % 360) + 360) % 360;
    const pointerPos = (360 - finalMod + 360) % 360;
    let cumAngle = 0;
    let actualIdx = wheelFoods.length - 1;
    for (let i = 0; i < wheelFoods.length; i++) {
      cumAngle += (weights[i] / totalWeight) * 360;
      if (pointerPos < cumAngle) { actualIdx = i; break; }
    }
    const winner = wheelFoods[actualIdx];

    resultText.textContent = `🍽️ ${winner.name}`;

    try {
      const entry = await api("/api/history", {
        method: "POST",
        body: { foodId: winner.id, foodName: winner.name },
      });
      history.unshift(entry);
      lastPickEntry = entry;
      renderHistory();
      markEatenBtn.classList.remove("hidden");
    } catch (_) { /* non-fatal */ }
  });
});

// ── Backup & Restore ─────────────────────────────────────────────────────────

const importBtn  = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const clearBtn        = document.getElementById("clear-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const loadDefaultsBtn = document.getElementById("load-defaults-btn");
const exportBtn       = document.getElementById("export-btn");

importBtn.addEventListener("click", () => importFile.click());

loadDefaultsBtn.addEventListener("click", async () => {
  if (!confirm("Load the default restaurant list?\n\nThis will replace your current food list and settings.")) return;

  if (confirm("Would you like to export a backup of your current config first?")) {
    exportBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  try {
    const config = await api("/api/config/default");
    const result = await api("/api/config/import", {
      method: "POST",
      body: config,
    });
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
    const data = await result.json();
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
