"""
Scheduler Handlers

All custom handlers for the Scheduler application.
Each handler should implement a `run(payload)` method.

Note: Handlers are imported lazily to avoid import errors when
optional dependencies are not installed.
"""

# Add your handler exports here
__all__ = [
    "CheckWeather",
]

def __getattr__(name):
    """Lazy import handlers when accessed."""
    if name == "CheckWeather":
        from schd.handlers.check_weather import CheckWeather

        return CheckWeather
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

