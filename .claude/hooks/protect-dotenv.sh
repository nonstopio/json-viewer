#!/bin/bash
# PreToolUse — guidance Claude can't skip. Blocks any Read/Edit/Write whose
# target file is a dotenv file, so secrets never enter context. Exit 2 = deny;
# the stderr message goes back to Claude. Checks the file's basename only (not
# content), so documenting dotenv usage in a README is never falsely blocked.
python3 -c '
import json, re, sys, os
data = json.load(sys.stdin)
base = os.path.basename(data.get("tool_input", {}).get("file_path", ""))
if re.match(r"\.env(\.\w+)?$", base):
    sys.stderr.write("Blocked by hook: dotenv files are off-limits - secrets never enter context.\n")
    sys.exit(2)
'
