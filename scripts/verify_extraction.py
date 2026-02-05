#!/usr/bin/env python3
"""
Verify extracted program JSON files for completeness and correctness.

Usage:
    python3 scripts/verify_extraction.py
"""

import json
import sys
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / "functions" / "program-data"

REQUIRED_FIELDS = [
    "name", "degree", "totalHours", "descriptions",
    "requirements", "careerOptions", "contacts",
]


def verify():
    json_files = sorted(OUTPUT_DIR.glob("*.json"))

    if not json_files:
        print("ERROR: No JSON files found in functions/program-data/")
        sys.exit(1)

    print(f"Verifying {len(json_files)} program files...\n")

    issues = []
    total_chars = 0

    for jf in json_files:
        with open(jf) as f:
            data = json.load(f)

        file_size = len(json.dumps(data))
        total_chars += file_size
        file_issues = []

        # Check required fields
        for field in REQUIRED_FIELDS:
            if field not in data:
                file_issues.append(f"Missing: {field}")
            elif not data[field]:
                file_issues.append(f"Empty: {field}")

        # Specific checks
        if data.get("totalHours", 0) == 0:
            file_issues.append("totalHours is 0")

        if not data.get("url"):
            file_issues.append("No URL (check programs.csv match)")

        if not data.get("abbreviation"):
            file_issues.append("No abbreviation")

        req = data.get("requirements", {})
        if not req.get("requiredCourses", {}).get("courses"):
            file_issues.append("No required courses extracted")

        if not data.get("careerOptions"):
            file_issues.append("No career options")

        if not data.get("contacts"):
            file_issues.append("No contacts")

        status = "OK" if not file_issues else "!!"
        print(f"  [{status}] {jf.name}: {data.get('name', '???')} ({data.get('degree', '?')})")

        if file_issues:
            for issue in file_issues:
                print(f"        - {issue}")
            issues.append((jf.name, file_issues))

    print(f"\n{'='*50}")
    print(f"VERIFICATION SUMMARY")
    print(f"{'='*50}")
    print(f"Files checked:      {len(json_files)}")
    print(f"Files with issues:  {len(issues)}")
    print(f"Total data size:    {total_chars:,} chars (~{total_chars // 4:,} tokens)")

    est_formatted = len(json_files) * 600
    print(f"Est. prompt context: ~{est_formatted:,} chars (~{est_formatted // 4:,} tokens)")

    if issues:
        print(f"\nFiles needing review:")
        for fname, file_issues in issues:
            print(f"  {fname}: {len(file_issues)} issue(s)")
        return 1
    else:
        print("\nAll files passed verification!")
        return 0


if __name__ == "__main__":
    sys.exit(verify())
