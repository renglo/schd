"""Demo scheduled handler: fetch current weather from Open-Meteo (no API key).

Schedule as schd/check_weather on a heartbeat (e.g. every_5_minutes).
Optional handler payload: {"city": "Boston"} or {"latitude": 42.36, "longitude": -71.06}.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_CITY = "New York"
TIMEOUT_SECONDS = 10

WMO_TEXT = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "rime fog",
    51: "light drizzle",
    53: "drizzle",
    55: "dense drizzle",
    61: "slight rain",
    63: "rain",
    65: "heavy rain",
    71: "slight snow",
    73: "snow",
    75: "heavy snow",
    80: "rain showers",
    81: "rain showers",
    82: "violent rain showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "thunderstorm with hail",
}


def _get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    request = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": "renglo-schd-check-weather/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        body = response.read().decode("utf-8")
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("Unexpected weather API response")
    return data


class CheckWeather:
    def run(self, payload):
        payload = payload or {}
        extra = payload.get("handler_payload")
        if isinstance(extra, dict):
            payload = {**payload, **extra}

        try:
            location = self._resolve_location(payload)
            forecast = _get_json(
                FORECAST_URL,
                {
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "current": "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
                    "timezone": "auto",
                },
            )
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, KeyError) as exc:
            return {
                "success": False,
                "action": "check_weather",
                "message": f"Weather lookup failed: {exc}",
                "input": {"city": payload.get("city") or DEFAULT_CITY},
            }

        current = forecast.get("current") or {}
        code = current.get("weather_code")
        try:
            code_n = int(code)
        except (TypeError, ValueError):
            code_n = None
        condition = WMO_TEXT.get(code_n, f"weather code {code}")
        temp = current.get("temperature_2m")
        wind = current.get("wind_speed_10m")
        humidity = current.get("relative_humidity_2m")
        observed = current.get("time") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
        place = location["name"]
        if location.get("country"):
            place = f"{place}, {location['country']}"
        summary = f"{place}: {temp}°C, {condition}, wind {wind} km/h ({observed})"
        print(f"[schd/check_weather] {summary}")

        return {
            "success": True,
            "action": "check_weather",
            "summary": summary,
            "location": location,
            "current": {
                "time": observed,
                "temperature_c": temp,
                "condition": condition,
                "weather_code": code,
                "wind_kmh": wind,
                "humidity_percent": humidity,
            },
            "source": "open-meteo",
        }

    def _resolve_location(self, payload: dict[str, Any]) -> dict[str, Any]:
        lat = payload.get("latitude")
        lon = payload.get("longitude")
        if lat not in (None, "") and lon not in (None, ""):
            return {
                "name": str(payload.get("city") or "custom"),
                "country": str(payload.get("country") or ""),
                "latitude": float(lat),
                "longitude": float(lon),
            }
        city = str(payload.get("city") or DEFAULT_CITY).strip() or DEFAULT_CITY
        geo = _get_json(GEOCODE_URL, {"name": city, "count": 1, "language": "en", "format": "json"})
        results = geo.get("results") or []
        if not results:
            raise ValueError(f"Unknown city: {city}")
        hit = results[0]
        return {
            "name": hit.get("name") or city,
            "country": hit.get("country") or "",
            "latitude": hit["latitude"],
            "longitude": hit["longitude"],
        }
