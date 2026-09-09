import json
import uuid
from pathlib import Path
from datetime import datetime


DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class StorageService:
    def __init__(self):
        DATA_DIR.mkdir(exist_ok=True)
        self._ensure_files()

    def _ensure_files(self):
        for name in ["areas.json", "alerts.json", "history.json"]:
            path = DATA_DIR / name
            if not path.exists():
                path.write_text("[]")

    def _read(self, name: str) -> list:
        path = DATA_DIR / name
        if path.exists():
            return json.loads(path.read_text())
        return []

    def _write(self, name: str, data):
        (DATA_DIR / name).write_text(json.dumps(data, indent=2, ensure_ascii=False))

    # ── AREAS ──

    def get_areas(self) -> list:
        return self._read("areas.json")

    def get_area(self, area_id: str) -> dict | None:
        for a in self.get_areas():
            if a.get("id") == area_id:
                return a
        return None

    def save_area(self, area: dict) -> dict:
        areas = self.get_areas()
        if not area.get("id"):
            area["id"] = f"AREA_{uuid.uuid4().hex[:8].upper()}"
            area["createdAt"] = datetime.now().isoformat()
            areas.append(area)
        else:
            for i, a in enumerate(areas):
                if a.get("id") == area["id"]:
                    area["updatedAt"] = datetime.now().isoformat()
                    areas[i] = {**a, **area}
                    break
            else:
                areas.append(area)
        self._write("areas.json", areas)
        return area

    def update_area(self, area_id: str, updates: dict) -> dict | None:
        areas = self.get_areas()
        for i, a in enumerate(areas):
            if a.get("id") == area_id:
                areas[i] = {**a, **updates, "updatedAt": datetime.now().isoformat()}
                self._write("areas.json", areas)
                return areas[i]
        return None

    def delete_area(self, area_id: str) -> bool:
        areas = self.get_areas()
        new_areas = [a for a in areas if a.get("id") != area_id]
        if len(new_areas) == len(areas):
            return False
        self._write("areas.json", new_areas)
        return True

    # ── ALERTS ──

    def get_alerts(self) -> list:
        return self._read("alerts.json")

    def save_alert(self, alert: dict) -> dict:
        alerts = self.get_alerts()
        if not alert.get("id"):
            alert["id"] = f"ALT_{uuid.uuid4().hex[:8].upper()}"
            alert["createdAt"] = datetime.now().isoformat()
            alerts.insert(0, alert)
        else:
            for i, a in enumerate(alerts):
                if a.get("id") == alert["id"]:
                    alerts[i] = {**a, **alert}
                    break
        self._write("alerts.json", alerts)
        return alert

    def update_alert(self, alert_id: str, updates: dict) -> dict | None:
        alerts = self.get_alerts()
        for i, a in enumerate(alerts):
            if a.get("id") == alert_id:
                alerts[i] = {**a, **updates, "updatedAt": datetime.now().isoformat()}
                self._write("alerts.json", alerts)
                return alerts[i]
        return None

    # ── HISTORY ──

    def get_history(self, area_id: str = None) -> list:
        history = self._read("history.json")
        if area_id:
            history = [h for h in history if h.get("areaId") == area_id]
        return history

    def add_history(self, entry: dict) -> dict:
        history = self._read("history.json")
        entry["id"] = f"HIST_{uuid.uuid4().hex[:8].upper()}"
        entry["timestamp"] = datetime.now().isoformat()
        history.insert(0, entry)
        self._write("history.json", history)
        return entry
