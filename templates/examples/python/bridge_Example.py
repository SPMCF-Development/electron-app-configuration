"""
Bridge between the Electron app and the simulation code.

Electron writes ONE JSON object to this script's stdin and expects ONE JSON object back on stdout:
    {"ok": true, "result": ...}   or   {"ok": false, "error": "..."}

While the code runs, stdout is redirected to stderr, so any print() calls in the script
show up in the app's "Python output" panel instead of corrupting the JSON reply.
"""

import contextlib
import json
import math
import sys
import traceback
from datetime import date
from pathlib import Path

from monte_carlo import run_simulation

def to_jsonable(obj):
    """Convert common scientific-Python results into plain JSON-safe values."""
    try:
        import pandas as pd

        if isinstance(obj, pd.DataFrame):
            return to_jsonable(obj.to_dict(orient="records"))
        if isinstance(obj, pd.Series):
            return to_jsonable(obj.to_dict())
    except ImportError:
        pass
    try:
        import numpy as np

        if isinstance(obj, np.ndarray):
            return to_jsonable(obj.tolist())
        if isinstance(obj, np.generic):
            return to_jsonable(obj.item())
    except ImportError:
        pass

    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_jsonable(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None  # JavaScript's JSON.parse rejects NaN/Infinity
    return obj

def configure_streams() -> None:
    """Force UTF-8 and prompt log output.
 
    PyInstaller-built engines don't reliably honor PYTHONIOENCODING / PYTHONUNBUFFERED,
    and Windows otherwise defaults pipes to a legacy encoding that garbles non-ASCII
    file paths (for example, a user folder named José). Setting it here works the same
    in development and when packaged.
    """
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(line_buffering=True)

def main() -> int:
    configure_streams()
    real_stdout = sys.stdout

    def reply(message: dict) -> None:
        real_stdout.write(json.dumps(message, default=str))
        real_stdout.flush()

    try:
        payload = json.load(sys.stdin)
        params = payload["params"] # what the user entered in the form
        context = payload["context"] # where the app wants things put
        output_dir = Path(context["outputDir"]) # writable; save user-facing files here
        

        # Dates arrive as "YYYY-MM-DD" strings; convert them to datetime.date.
        spending_policy = [
            [date.fromisoformat(d), float(a), float(b), float(c), bool(flag)]
            for d, a, b, c, flag in params["spendingPolicy"]
        ]
        additional_policy = [
            [date.fromisoformat(d), float(amount)] for d, amount in params["additionalPolicy"]
        ]
        inflation_scenarios = [
            float(scen[0]) for scen in params["inflationScenarios"]
        ]

        with contextlib.redirect_stdout(sys.stderr):
            # -----------------------------------------------------------------
            # Adjust this call to match the function's real signature.
            # -----------------------------------------------------------------
            result = run_simulation(
                timeframe=params["timeframe"],  # "monthly" | "daily" | "annual"
                timesteps=int(params["timesteps"]),
                rolling_quarters=int(params["rollingQuarters"]),
                num_simulations=int(params["numSimulations"]),
                market_value_path=params["marketValueFile"],  # absolute path to .xlsx/.csv
                cma_path=params["cmaFile"],  # absolute path to .xlsx/.csv
                spending_policy=spending_policy,
                additional_policy=additional_policy,
                inflation_scenarios=inflation_scenarios,
                # Remove this line if your function doesn't save files. If it does, save into
                # this folder rather than using relative paths (not the current working directory).
                output_dir=output_dir,
            )

        reply({"ok": True, "result": to_jsonable(result)})
        return 0

    except Exception as exc:  # noqa: BLE001 - report every failure back to the UI
        traceback.print_exc(file=sys.stderr)
        reply({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())