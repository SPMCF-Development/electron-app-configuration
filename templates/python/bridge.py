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

from python_script import python_script_main_function

# Takes Python results and processes them as plain JSON-safe values to enable rendering
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

# Configure streams to use proper log handling
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

# The main bridge function
def main() -> int:
    configure_streams()
    real_stdout = sys.stdout

    def reply(message: dict) -> None:
        real_stdout.write(json.dumps(message, default=str))
        real_stdout.flush()

    try:
        payload = json.load(sys.stdin)
        params = payload["params"] # what the user entered in the app
        context = payload["context"] # where the app wants things put
        output_dir = Path(context["outputDir"]) # writable; save user-facing files here
        

        # Dates arrive as "YYYY-MM-DD" strings; convert them to datetime.date.
        table1 = [
            [date.fromisoformat(d), float(a), float(b), bool(flag)]
            for d, a, b, flag in params["table1"]
        ]
        table2 = [
            float(val[0]) for val in params["table2"]
        ]

        with contextlib.redirect_stdout(sys.stderr):
            # -----------------------------------------------------------------
            # Adjust this call to match the function's real signature.
            # -----------------------------------------------------------------
            result = python_script_main_function(
                var1=params["var1"],
                num1=int(params["num1_val"]),
                num2=int(params["num2_val"]),
                file1_path=params["file1_path"],  # absolute path
                file2_path=params["file2_path"],  # absolute path
                list_of_lists_table1=table1,
                list_of_values_table2=table2,
                output_dir=output_dir
            )

        reply({"ok": True, "result": to_jsonable(result)})
        return 0

    except Exception as exc:  # noqa: BLE001 - report every failure back to the UI
        traceback.print_exc(file=sys.stderr)
        reply({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())