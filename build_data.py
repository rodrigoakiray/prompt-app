#!/usr/bin/env python3
"""Build public/prompts.json for the Prompt Library PWA.

Parses the 18 NN_*.md files in ../02_output/library with a *fence-aware*
line state machine, so that the literal `#`/`##`/`###` lines that appear
INSIDE long prompt bodies (wrapped in ```text fences) are never mistaken
for category / subcategory / prompt headings.

Run:  python build_data.py
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
LIBRARY_DIR = HERE.parent / "02_output" / "library"
OUT_PATH = HERE / "public" / "prompts.json"

# One editorial accent per category (1-based order -> hex). Rich but legible
# under white text; drives the color-blocked collection tiles.
ACCENTS = {
    1:  "#E14328",  # Marketing & Sales        — vermilion
    2:  "#2457C5",  # Business Strategy        — cobalt
    3:  "#C81E5B",  # Critical Thinking        — raspberry
    4:  "#6D28D9",  # Mental Models            — violet
    5:  "#0E8A8A",  # Productivity & Workflow  — teal
    6:  "#D9730D",  # Learning & Skills        — orange
    7:  "#3A4DB5",  # Writing & Communication  — indigo
    8:  "#B58A00",  # Presentations/NotebookLM — gold
    9:  "#1E8E4E",  # Coding & Development      — green
    10: "#A01A58",  # Career & Leadership      — magenta
    11: "#117C6F",  # Prompt Engineering       — deep teal
    12: "#7E3FF2",  # Personas & Role-Play     — purple
    13: "#D11D4A",  # Creative Writing         — rose
    14: "#1769D6",  # Language & Translation   — royal blue
    15: "#5A6472",  # Professional Advisors    — slate
    16: "#2E9E5B",  # Lifestyle & Wellness     — emerald
    17: "#B41CC0",  # Visual & Image Gen       — fuchsia
}

# ---------------------------------------------------------------------------
# Regexes
# ---------------------------------------------------------------------------
FENCE_RE = re.compile(r"^(`{3,})(.*)$")
HASH_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
TAGS_RE = re.compile(r"^\*Tags:\s*(?P<tags>.*?)(?:\s*·\s*Source:\s*(?P<source>.*?))?\*\s*$")
SUBCOUNT_RE = re.compile(r"^(?P<name>.*?)\s*\((?P<count>\d+)\)\s*$")
PLACEHOLDER_RE = re.compile(r"\[[^\]\n]{1,80}\]|\$\{[^}\n]{1,80}\}")
TAG_TOKEN_RE = re.compile(r"#([^\s#]+)")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-")


def length_bucket(words: int) -> str:
    if words < 60:
        return "short"
    if words < 300:
        return "medium"
    return "long"


def parse_file(path: Path):
    """Return (category_name, [prompt dicts]) for one markdown file."""
    lines = path.read_text(encoding="utf-8").splitlines()

    category_name = None
    subcategory = None
    in_fence = False
    fence_len = 0
    prompts = []
    cur = None          # current prompt being assembled
    body_lines = None   # collected body lines while inside the prompt's fence

    for line in lines:
        fence = FENCE_RE.match(line)

        if in_fence:
            # Inside a code fence: only a same-or-longer run of backticks with
            # nothing after it closes the block. Everything else is body text.
            if fence and len(fence.group(1)) >= fence_len and fence.group(2).strip() == "":
                in_fence = False
                if cur is not None and body_lines is not None:
                    cur["body"] = "\n".join(body_lines).strip("\n")
                    body_lines = None
            elif body_lines is not None:
                body_lines.append(line)
            continue

        if fence:
            # Opening fence -> start collecting this prompt's body.
            in_fence = True
            fence_len = len(fence.group(1))
            if cur is not None:
                body_lines = []
            continue

        heading = HASH_RE.match(line)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2).strip()
            if level == 1:
                category_name = text
            elif level == 2:
                m = SUBCOUNT_RE.match(text)
                subcategory = m.group("name").strip() if m else text
            elif level == 3:
                cur = {
                    "title": text.strip().strip('"').strip("'").strip(),
                    "tags": [],
                    "source": "",
                    "body": "",
                    "subcategory": subcategory,
                }
                prompts.append(cur)
            continue

        meta = TAGS_RE.match(line)
        if meta and cur is not None and not cur["tags"] and not cur["body"]:
            cur["tags"] = TAG_TOKEN_RE.findall(meta.group("tags") or "")
            cur["source"] = (meta.group("source") or "").strip()
            continue
        # Anything else (blank lines, the "*N prompts*" header) is ignored.

    return category_name, prompts


def build():
    files = sorted(p for p in LIBRARY_DIR.glob("[0-9][0-9]_*.md"))
    if not files:
        raise SystemExit(f"No NN_*.md files found in {LIBRARY_DIR}")

    categories = []
    all_prompts = []

    for path in files:
        order = int(path.name[:2])
        category_name, prompts = parse_file(path)
        category_id = slugify(category_name)
        accent = ACCENTS.get(order, "#5A6472")

        # Ordered subcategories with counts (first-appearance order).
        sub_order = []
        sub_counts = {}
        seen_ids = {}
        for p in prompts:
            sub = p["subcategory"] or "Other"
            if sub not in sub_counts:
                sub_counts[sub] = 0
                sub_order.append(sub)
            sub_counts[sub] += 1

            # Unique, stable id within the category.
            base = f"{category_id}__{slugify(p['title']) or 'prompt'}"
            n = seen_ids.get(base, 0) + 1
            seen_ids[base] = n
            pid = base if n == 1 else f"{base}-{n}"

            words = len(p["body"].split())
            placeholders = []
            for ph in PLACEHOLDER_RE.findall(p["body"]):
                if ph not in placeholders:
                    placeholders.append(ph)

            all_prompts.append({
                "id": pid,
                "title": p["title"],
                "tags": p["tags"],
                "source": p["source"],
                "body": p["body"],
                "categoryId": category_id,
                "categoryName": category_name,
                "categoryOrder": order,
                "subcategory": sub,
                "placeholders": placeholders,
                "words": words,
                "length": length_bucket(words),
            })

        categories.append({
            "id": category_id,
            "name": category_name,
            "order": order,
            "accent": accent,
            "count": len(prompts),
            "subcategories": [{"name": s, "count": sub_counts[s]} for s in sub_order],
        })

    data = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totalPrompts": len(all_prompts),
        "categories": categories,
        "prompts": all_prompts,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- Report + self-checks -------------------------------------------
    size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
    print(f"Wrote {OUT_PATH}")
    print(f"  categories : {len(categories)}")
    print(f"  prompts    : {len(all_prompts)}")
    print(f"  size       : {size_mb:.2f} MB")
    for c in categories:
        print(f"   {c['order']:>2}. {c['name']:<34} {c['count']:>4}  ({len(c['subcategories'])} sub)")

    # Spot-check the long prompt keeps its internal headings.
    acc = next((p for p in all_prompts if p["title"] == "Accessibility Auditor Agent Role"), None)
    if acc:
        ok = "### 1. Initial Assessment" in acc["body"]
        print(f"  long-prompt body intact: {ok} ({acc['words']} words, {acc['length']})")

    return len(all_prompts), len(categories)


if __name__ == "__main__":
    build()
