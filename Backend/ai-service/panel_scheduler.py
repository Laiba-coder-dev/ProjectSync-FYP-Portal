"""
Panel Scheduler Service
=======================
Standalone module encapsulating the full FYP panel scheduling algorithm.

Entry point
-----------
generate_panel_schedule(
    timetable_file, expertise_file, projects_file,
    num_panels, teachers_per_panel, duration,
    raw_days, start_time_str, end_time_str
) -> list[dict]

All file arguments accept in-memory objects (io.BytesIO or
werkzeug/fastapi UploadFile that has already been .read() into BytesIO).
No temporary files are written to disk.

Helper functions (preserved exactly as in the original CLI script)
------------------------------------------------------------------
  convert_time_format   – 12h/24h → "HH:MM"
  is_time_overlap       – interval collision check
  clean_name            – strip titles, normalise whitespace/case
  names_match           – flexible single-token & fuzzy match
  canonicalize_names    – deduplicate variant spellings into canonical forms
  match_to_roster       – map a raw name to the closest roster entry
  convert_weekly_schedule – parse multi-sheet timetable workbook
  generate_slots        – produce sequential HH:MM-HH:MM slot list
  domain_match          – word-level intersection check between domains
"""

import io
import re
from collections import defaultdict
from datetime import datetime, timedelta
from difflib import get_close_matches

import pandas as pd

# ---------------------------------------------------------------------------
# Compiled regex constants
# ---------------------------------------------------------------------------
TITLE_RE = re.compile(r'^(dr|prof|mr|mrs|ms|engr)\.?\s*', re.IGNORECASE)
TIME_PAIR_RE = re.compile(r'(\d{1,2}\s*:\s*\d{2}\s*[apAP][mM])')


# ---------------------------------------------------------------------------
# Helper: time utilities
# ---------------------------------------------------------------------------

def convert_time_format(time_str: str) -> str:
    """Convert any 12h/24h time string to normalised 24-hour 'HH:MM' format."""
    time_str = str(time_str).strip().lower().replace(" ", "")
    try:
        return datetime.strptime(time_str, "%I:%M%p").strftime("%H:%M")
    except ValueError:
        return datetime.strptime(time_str, "%H:%M").strftime("%H:%M")


def is_time_overlap(s1: str, s2: str) -> bool:
    """Return True when two 'HH:MM-HH:MM' intervals overlap."""
    a, b = s1.split("-")
    c, d = s2.split("-")
    a = datetime.strptime(a, "%H:%M")
    b = datetime.strptime(b, "%H:%M")
    c = datetime.strptime(c, "%H:%M")
    d = datetime.strptime(d, "%H:%M")
    return max(a, c) < min(b, d)


# ---------------------------------------------------------------------------
# Helper: name canonicalisation
# ---------------------------------------------------------------------------

def clean_name(raw) -> str:
    """Strip academic titles, collapse whitespace, lowercase."""
    if raw is None or pd.isna(raw):
        return ""
    name = str(raw).strip()
    name = re.split(r'\s-\s', name)[0]
    name = TITLE_RE.sub('', name.strip())
    name = re.sub(r'\s+', ' ', name.strip().lower())
    return name


def names_match(a: str, b: str) -> bool:
    """Flexible matching: exact, single-token prefix/suffix, or fuzzy ≥ 0.84."""
    if not a or not b:
        return False
    if a == b:
        return True
    aw, bw = a.split(), b.split()
    if len(aw) == 1 and (aw[0] == bw[0] or aw[0] == bw[-1]):
        return True
    if len(bw) == 1 and (bw[0] == aw[0] or bw[0] == aw[-1]):
        return True
    if get_close_matches(a, [b], n=1, cutoff=0.84):
        return True
    return False


def canonicalize_names(raw_names) -> dict:
    """
    Given an iterable of cleaned name strings, return a mapping
    {raw_name: canonical_name} that collapses spelling variants.
    Longer / multi-token names are preferred as the canonical form.
    """
    uniq = sorted(
        {n for n in raw_names if n},
        key=lambda s: (-len(s.split()), -len(s))
    )
    canon_list: list[str] = []
    mapping: dict[str, str] = {}
    for name in uniq:
        match_idx = None
        for i, canon in enumerate(canon_list):
            if names_match(name, canon):
                match_idx = i
                break
        if match_idx is None:
            canon_list.append(name)
            mapping[name] = name
        else:
            mapping[name] = canon_list[match_idx]
    return mapping


def match_to_roster(raw_name: str, roster_names) -> str | None:
    """Find the roster entry that best matches *raw_name*, or None."""
    if raw_name in roster_names:
        return raw_name
    for canon in roster_names:
        if names_match(raw_name, canon):
            return canon
    return None


# ---------------------------------------------------------------------------
# Helper: timetable parsing
# ---------------------------------------------------------------------------

def convert_weekly_schedule(file_or_stream):
    """
    Parse a multi-sheet timetable workbook.

    Returns
    -------
    structured : pd.DataFrame   – long-format rows (Day, Time Slot, Details)
    slot_time_map : dict        – {day_key: {col_name: time_range_string}}
    """
    sheets = pd.read_excel(file_or_stream, sheet_name=None)
    data = []
    slot_time_map: dict[str, dict] = {}

    for day, df in sheets.items():
        df = df.copy()
        df.rename(columns={df.columns[0]: "Room"}, inplace=True)
        day_key = day.strip().lower()

        # Extract time range strings from the first header-only row
        header_rows = df[df["Room"].isna()]
        time_map: dict = {}
        if not header_rows.empty:
            hrow = header_rows.iloc[0]
            for col in df.columns:
                if col == "Room":
                    continue
                val = hrow[col]
                if pd.notna(val) and re.search(r'\d{1,2}\s*:\s*\d{2}', str(val)):
                    time_map[col] = str(val)
        slot_time_map[day_key] = time_map

        df = df[df["Room"].notna()]
        df_long = df.melt(id_vars=["Room"], var_name="Time Slot", value_name="Details")
        df_long["Day"] = day_key
        data.append(df_long)

    structured = pd.concat(data, ignore_index=True).dropna(subset=["Details"])
    return structured, slot_time_map


# ---------------------------------------------------------------------------
# Helper: slot generation
# ---------------------------------------------------------------------------

def generate_slots(start: str, end: str, duration: int) -> list[str]:
    """
    Produce a list of 'HH:MM-HH:MM' slots of *duration* minutes between
    *start* and *end* (both in 'HH:MM' format).
    """
    slots: list[str] = []
    cur = datetime.strptime(start, "%H:%M")
    end_dt = datetime.strptime(end, "%H:%M")
    while cur + timedelta(minutes=duration) <= end_dt:
        s = cur.strftime("%H:%M")
        e = (cur + timedelta(minutes=duration)).strftime("%H:%M")
        slots.append(f"{s}-{e}")
        cur += timedelta(minutes=duration)
    return slots


# ---------------------------------------------------------------------------
# Helper: domain matching
# ---------------------------------------------------------------------------

def domain_match(domain_a: str, domain_b: str) -> bool:
    """
    True when the two domain strings share at least one meaningful word token
    or one is a substring of the other.
    """
    domain_a = (domain_a or "").lower().strip()
    domain_b = (domain_b or "").lower().strip()
    if not domain_a or not domain_b:
        return False
    a_words = set(re.findall(r'\w+', domain_a))
    b_words = set(re.findall(r'\w+', domain_b))
    return bool(a_words & b_words) or domain_a in domain_b or domain_b in domain_a


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_panel_schedule(
    timetable_file,
    expertise_file,
    projects_file,
    num_panels: int,
    teachers_per_panel: int,
    duration: int,
    raw_days,
    start_time_str: str,
    end_time_str: str,
) -> list[dict]:
    """
    Generate a conflict-free evaluation panel schedule.

    Parameters
    ----------
    timetable_file     : file-like object (BytesIO or path) for the timetable .xlsx
    expertise_file     : file-like object for the teacher expertise .xlsx
    projects_file      : file-like object for the project list .xlsx
    num_panels         : number of parallel evaluation panels
    teachers_per_panel : advisory target evaluators per panel (used for scoring)
    duration           : slot length in minutes
    raw_days           : comma/space separated evaluation days string or list
    start_time_str     : session start time (any 12h/24h format)
    end_time_str       : session end time (any 12h/24h format)

    Returns
    -------
    list[dict] — one entry per panel:
        {
            "panel_name": str,
            "domains":    str,
            "members":    list[str],
            "projects":   list[{Project, Day, Time, Teachers, Excluded_busy, Overbooked}]
        }
    """

    # ------------------------------------------------------------------
    # Phase 1 — Parse timetable & extract busy schedule
    # ------------------------------------------------------------------
    structured_df, slot_time_map = convert_weekly_schedule(timetable_file)

    raw_instructor_rows: list[tuple] = []
    for _, row in structured_df.iterrows():
        details = str(row["Details"])
        match = re.search(r'Instructor:\s*(.+)', details)
        if not match:
            continue
        name = clean_name(match.group(1))
        if not name:
            continue
        raw_instructor_rows.append((row["Day"], row["Time Slot"], name))

    # ------------------------------------------------------------------
    # Phase 2 — Load expertise roster & build canonical teacher domains
    # ------------------------------------------------------------------
    expertise_df = pd.read_excel(expertise_file)
    expertise_df.columns = expertise_df.columns.str.strip()
    expertise_df.rename(columns={
        expertise_df.columns[0]: "Teacher",
        expertise_df.columns[1]: "Domain"
    }, inplace=True)
    expertise_df = expertise_df.dropna(subset=["Teacher"])
    expertise_df["Domain"] = (
        expertise_df["Domain"].fillna("").astype(str).str.lower().str.strip()
    )

    raw_expertise_domains: dict = defaultdict(set)
    for _, row in expertise_df.iterrows():
        name = clean_name(row["Teacher"])
        if not name:
            continue
        if row["Domain"]:
            raw_expertise_domains[name].add(row["Domain"])
        else:
            raw_expertise_domains.setdefault(name, set())

    canonical_map = canonicalize_names(raw_expertise_domains.keys())
    master_teacher_domains: dict = defaultdict(set)
    for raw_name, doms in raw_expertise_domains.items():
        master_teacher_domains[canonical_map[raw_name]] |= doms

    master_teacher_domain_str = {
        t: ", ".join(sorted(d for d in doms if d))
        for t, doms in master_teacher_domains.items()
    }
    all_teachers = sorted(master_teacher_domain_str.keys())

    # ------------------------------------------------------------------
    # Phase 3 — Build busy-schedule map (only roster-eligible teachers)
    # ------------------------------------------------------------------
    busy_map: dict = defaultdict(list)
    for day, slot_label, raw_name in raw_instructor_rows:
        roster_teacher = match_to_roster(raw_name, all_teachers)
        if not roster_teacher:
            continue
        real_time = slot_time_map.get(day, {}).get(slot_label)
        if not real_time:
            continue
        found_times = TIME_PAIR_RE.findall(real_time)
        if len(found_times) < 2:
            continue
        start_t = convert_time_format(found_times[0])
        end_t = convert_time_format(found_times[1])
        slot = f"{start_t}-{end_t}"
        busy_map[(roster_teacher, day)].append(slot)

    # ------------------------------------------------------------------
    # Phase 4 — Load projects
    # ------------------------------------------------------------------
    projects_df = pd.read_excel(projects_file)
    projects_df.columns = projects_df.columns.str.strip()
    projects_df.rename(columns={
        projects_df.columns[0]: "Project",
        projects_df.columns[1]: "Domain"
    }, inplace=True)
    projects_df["Domain"] = projects_df["Domain"].fillna("").str.lower().str.strip()

    # ------------------------------------------------------------------
    # Phase 5 — Parse days & generate time slots
    # ------------------------------------------------------------------
    raw_days_cleaned = re.sub(r'\band\b', ',', str(raw_days), flags=re.IGNORECASE)
    raw_days_cleaned = re.sub(r'[.\/&]+', ',', raw_days_cleaned)
    days = [d.strip().lower() for d in raw_days_cleaned.split(",") if d.strip()]

    start = convert_time_format(start_time_str)
    end = convert_time_format(end_time_str)
    time_slots = generate_slots(start, end, duration)

    # ------------------------------------------------------------------
    # Phase 6 — Domain partitioning (round-robin across panels)
    # ------------------------------------------------------------------
    expertise_domain_tokens: set[str] = set()
    for doms in raw_expertise_domains.values():
        for d in doms:
            for token in re.split(r'[,/&]+', d):
                token = token.strip()
                if token:
                    expertise_domain_tokens.add(token)
    expertise_domain_tokens_sorted = sorted(expertise_domain_tokens)

    panel_names = [f"Panel {i + 1}" for i in range(num_panels)]
    panel_domain_groups: dict = defaultdict(list)
    for idx, dom in enumerate(expertise_domain_tokens_sorted):
        panel_domain_groups[panel_names[idx % num_panels]].append(dom)

    panel_domains_label = {
        p: (", ".join(panel_domain_groups[p]) if panel_domain_groups[p] else "mixed")
        for p in panel_names
    }

    # ------------------------------------------------------------------
    # Phase 7 — Teacher-to-panel allocation
    # ------------------------------------------------------------------
    panels: dict = {p: {"Members": [], "Projects": []} for p in panel_names}

    teacher_scores = []
    for teacher in all_teachers:
        dom_str = master_teacher_domain_str[teacher]
        scores = {
            p: sum(1 for od in panel_domain_groups[p] if domain_match(od, dom_str))
            for p in panel_names
        }
        teacher_scores.append((teacher, dom_str, scores))

    matched = [
        (t, d, s) for t, d, s in teacher_scores
        if max(s.values(), default=0) > 0
    ]
    unmatched = [
        (t, d, s) for t, d, s in teacher_scores
        if max(s.values(), default=0) == 0
    ]

    for t, d, s in sorted(matched, key=lambda x: -max(x[2].values())):
        best_score = max(s.values())
        best_panels = [p for p in panel_names if s[p] == best_score]
        best_panels.sort(key=lambda p: len(panels[p]["Members"]))
        panels[best_panels[0]]["Members"].append(t)

    for t, d, s in sorted(unmatched, key=lambda x: x[0]):
        smallest = min(panel_names, key=lambda p: len(panels[p]["Members"]))
        panels[smallest]["Members"].append(t)

    # ------------------------------------------------------------------
    # Phase 8 — Project scheduling with conflict resolution
    # ------------------------------------------------------------------
    project_panel_counts: dict = {p: 0 for p in panel_names}

    def best_panel_for_project(proj_domain: str) -> str:
        scores = {
            p: sum(1 for od in panel_domain_groups[p] if domain_match(od, proj_domain))
            for p in panel_names
        }
        best = max(scores.values(), default=0)
        candidates = (
            [p for p in panel_names if scores[p] == best]
            if best > 0
            else list(panel_names)
        )
        candidates.sort(key=lambda p: project_panel_counts[p])
        return candidates[0]

    def free_members(panel_name: str, day: str, slot: str) -> list[str]:
        free = []
        for teacher in panels[panel_name]["Members"]:
            busy_slots = busy_map.get((teacher, day), [])
            if not any(is_time_overlap(slot, b) for b in busy_slots):
                free.append(teacher)
        return free

    all_combos = [(d, s) for d in days for s in time_slots]

    panel_projects: dict = defaultdict(list)
    for _, proj in projects_df.iterrows():
        p = best_panel_for_project(str(proj["Domain"]).strip())
        project_panel_counts[p] += 1
        panel_projects[p].append(proj)

    for p in panel_names:
        cursor = 0
        panel_used_combos: set = set()

        for proj in panel_projects[p]:
            chosen_day = chosen_slot = chosen_members = None
            best_day, best_slot, best_members = None, None, []

            for step in range(len(all_combos)):
                idx = (cursor + step) % len(all_combos)
                day, slot = all_combos[idx]
                if (day, slot) in panel_used_combos:
                    continue
                members = free_members(p, day, slot)
                if len(members) > len(best_members):
                    best_day, best_slot, best_members = day, slot, members
                if len(members) == len(panels[p]["Members"]):
                    chosen_day, chosen_slot, chosen_members = day, slot, members
                    cursor = idx + 1
                    break

            overbooked = False
            if chosen_day is None:
                if best_day is not None:
                    chosen_day, chosen_slot, chosen_members = best_day, best_slot, best_members
                    cursor = all_combos.index((chosen_day, chosen_slot)) + 1
                else:
                    chosen_day, chosen_slot = all_combos[0]
                    chosen_members = free_members(p, chosen_day, chosen_slot)
                    overbooked = True

            panel_used_combos.add((chosen_day, chosen_slot))
            excluded = [t for t in panels[p]["Members"] if t not in chosen_members]

            panels[p]["Projects"].append({
                "Project":       str(proj["Project"]),
                "Day":           chosen_day.capitalize(),
                "Time":          chosen_slot,
                "Teachers":      chosen_members,
                "Excluded_busy": excluded,
                "Overbooked":    overbooked,
            })

    # ------------------------------------------------------------------
    # Phase 9 — Assemble output
    # ------------------------------------------------------------------
    output = []
    for p in panel_names:
        output.append({
            "panel_name": p,
            "domains":    panel_domains_label[p],
            "members":    panels[p]["Members"],
            "projects":   panels[p]["Projects"],
        })

    return output
