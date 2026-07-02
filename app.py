import io
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, render_template, request, send_file

app = Flask(__name__)

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
_lock = Lock()

DEFAULT_SETTINGS = {
    "weightingEnabled": False,
    "reductionPercent": 50,
    "withinDays": 7,
}


def _read(filename, default):
    path = DATA_DIR / filename
    if not path.exists():
        return default
    with path.open() as f:
        return json.load(f)


def _write(filename, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with (DATA_DIR / filename).open("w") as f:
        json.dump(data, f, indent=2)


def load_foods():     return _read("foods.json", [])
def save_foods(d):    _write("foods.json", d)
def load_history():   return _read("history.json", [])
def save_history(d):  _write("history.json", d)
def load_settings():  return {**DEFAULT_SETTINGS, **_read("settings.json", {})}
def save_settings(d): _write("settings.json", d)


@app.route("/")
def index():
    return render_template("index.html")


# ── Foods ────────────────────────────────────────────────────────────────────

@app.route("/api/foods", methods=["GET"])
def get_foods():
    return jsonify(load_foods())


@app.route("/api/foods", methods=["POST"])
def add_food():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Food name is required"}), 400

    mode = body.get("mode", "eatOut")
    if mode not in ("eatOut", "cookAtHome"):
        mode = "eatOut"

    category = (body.get("category") or "").strip()
    weight   = max(1, min(999, int(body.get("weight", 100))))

    food = {
        "id":       uuid.uuid4().hex,
        "mode":     mode,
        "name":     name,
        "category": category,
        "weight":   weight,
        "notes":    body.get("notes", ""),
    }

    if mode == "eatOut":
        food.update({
            "website":     (body.get("website") or "").strip(),
            "driveThru":   bool(body.get("driveThru", False)),
            "onlineOrder": bool(body.get("onlineOrder", False)),
            "dineIn":      bool(body.get("dineIn", False)),
        })
    else:
        food.update({
            "cookTime":     max(0, int(body.get("cookTime", 0))),
            "quick":        bool(body.get("quick", False)),
            "slowCook":     bool(body.get("slowCook", False)),
            "ovenBake":     bool(body.get("ovenBake", False)),
            "grill":        bool(body.get("grill", False)),
            "onePot":       bool(body.get("onePot", False)),
            "noCook":       bool(body.get("noCook", False)),
            "ingredients":  body.get("ingredients", ""),
            "instructions": body.get("instructions", ""),
        })

    with _lock:
        foods = load_foods()
        foods.append(food)
        save_foods(foods)
    return jsonify(load_foods()), 201


@app.route("/api/foods/<food_id>", methods=["PUT"])
def edit_food(food_id):
    body = request.get_json(silent=True) or {}
    with _lock:
        foods = load_foods()
        for food in foods:
            if food["id"] == food_id:
                if "name" in body:
                    name = body["name"].strip()
                    if not name:
                        return jsonify({"error": "Name cannot be empty"}), 400
                    food["name"] = name
                if "category" in body:
                    food["category"] = body["category"].strip()
                if "weight" in body:
                    food["weight"] = max(1, min(999, int(body["weight"])))
                if "notes" in body:
                    food["notes"] = body["notes"]

                mode = food.get("mode", "eatOut")
                if mode == "eatOut":
                    if "website"     in body: food["website"]     = body["website"].strip()
                    if "driveThru"   in body: food["driveThru"]   = bool(body["driveThru"])
                    if "onlineOrder" in body: food["onlineOrder"] = bool(body["onlineOrder"])
                    if "dineIn"      in body: food["dineIn"]      = bool(body["dineIn"])
                else:
                    if "cookTime"     in body: food["cookTime"]     = max(0, int(body["cookTime"]))
                    if "quick"        in body: food["quick"]        = bool(body["quick"])
                    if "slowCook"     in body: food["slowCook"]     = bool(body["slowCook"])
                    if "ovenBake"     in body: food["ovenBake"]     = bool(body["ovenBake"])
                    if "grill"        in body: food["grill"]        = bool(body["grill"])
                    if "onePot"       in body: food["onePot"]       = bool(body["onePot"])
                    if "noCook"       in body: food["noCook"]       = bool(body["noCook"])
                    if "ingredients"  in body: food["ingredients"]  = body["ingredients"]
                    if "instructions" in body: food["instructions"] = body["instructions"]

                save_foods(foods)
                return jsonify(food)
    return jsonify({"error": "Food not found"}), 404


@app.route("/api/foods/<food_id>", methods=["DELETE"])
def delete_food(food_id):
    with _lock:
        foods = load_foods()
        remaining = [f for f in foods if f["id"] != food_id]
        if len(remaining) == len(foods):
            return jsonify({"error": "Food not found"}), 404
        save_foods(remaining)
    return jsonify(remaining)


# ── History ───────────────────────────────────────────────────────────────────

@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify(load_history())


@app.route("/api/history", methods=["POST"])
def add_history():
    body = request.get_json(silent=True) or {}
    food_name = (body.get("foodName") or "").strip()
    if not food_name:
        return jsonify({"error": "foodName is required"}), 400
    mode = body.get("mode", "eatOut")
    if mode not in ("eatOut", "cookAtHome"):
        mode = "eatOut"
    entry = {
        "id":        uuid.uuid4().hex,
        "mode":      mode,
        "foodId":    body.get("foodId", ""),
        "foodName":  food_name,
        "pickedAt":  datetime.now(timezone.utc).isoformat(),
        "confirmed": False,
    }
    with _lock:
        history = load_history()
        history.insert(0, entry)
        save_history(history)
    return jsonify(entry), 201


@app.route("/api/history/<entry_id>", methods=["PATCH"])
def patch_history(entry_id):
    body = request.get_json(silent=True) or {}
    with _lock:
        history = load_history()
        for entry in history:
            if entry["id"] == entry_id:
                if "confirmed" in body:
                    entry["confirmed"] = bool(body["confirmed"])
                save_history(history)
                return jsonify(entry)
    return jsonify({"error": "Entry not found"}), 404


@app.route("/api/history/<entry_id>", methods=["DELETE"])
def delete_history_entry(entry_id):
    with _lock:
        history = load_history()
        remaining = [e for e in history if e["id"] != entry_id]
        if len(remaining) == len(history):
            return jsonify({"error": "Not found"}), 404
        save_history(remaining)
    return jsonify(remaining)


# ── Settings ──────────────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(load_settings())


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    body = request.get_json(silent=True) or {}
    with _lock:
        s = load_settings()
        if "weightingEnabled" in body:
            s["weightingEnabled"] = bool(body["weightingEnabled"])
        if "reductionPercent" in body:
            s["reductionPercent"] = max(1, min(99, int(body["reductionPercent"])))
        if "withinDays" in body:
            s["withinDays"] = max(1, min(365, int(body["withinDays"])))
        save_settings(s)
    return jsonify(s)


# ── Config export / import ────────────────────────────────────────────────────

@app.route("/api/config/default")
def get_default_config():
    path = Path(__file__).parent / "default_config.json"
    with path.open() as f:
        return jsonify(json.load(f))


@app.route("/api/config/export")
def export_config():
    config = {
        "version": 1,
        "foods": load_foods(),
        "settings": load_settings(),
    }
    data = json.dumps(config, indent=2).encode()
    return send_file(
        io.BytesIO(data),
        mimetype="application/json",
        as_attachment=True,
        download_name="food-wheel-config.json",
    )


@app.route("/api/history/clear", methods=["POST"])
def clear_history():
    with _lock:
        save_history([])
    return jsonify([])


@app.route("/api/config/clear", methods=["POST"])
def clear_config():
    with _lock:
        save_foods([])
        save_settings(DEFAULT_SETTINGS.copy())
    return jsonify({"foods": [], "settings": load_settings()})


@app.route("/api/config/import", methods=["POST"])
def import_config():
    try:
        if "file" in request.files:
            config = json.load(request.files["file"])
        else:
            config = request.get_json(silent=True) or {}

        if "foods" not in config:
            return jsonify({"error": "Invalid config: missing 'foods' key"}), 400

        with _lock:
            save_foods(config["foods"])
            if "settings" in config:
                save_settings({**DEFAULT_SETTINGS, **config["settings"]})

        return jsonify({"foods": load_foods(), "settings": load_settings()})
    except (json.JSONDecodeError, ValueError) as e:
        return jsonify({"error": f"Could not parse file: {e}"}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
