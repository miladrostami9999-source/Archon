"""Canonical country names for the shared catalog.

The same country ends up spelled two ways depending on the source (a CSV
import, a hunt, manual entry) — "USA" vs "United States", "UAE" vs "United
Arab Emirates" — which splits one market into two rows everywhere that groups
by country: the country-lock picker, the Market Map, Analytics. Applying this
at every write path stops new duplicates; `merge_country` (routers/companies/
core.py) fixes rows that already exist.
"""

# lowercase alias -> canonical spelling. Extend this as more variants turn up.
COUNTRY_ALIASES = {
    "usa": "United States",
    "us": "United States",
    "u.s.a.": "United States",
    "u.s.": "United States",
    "united states of america": "United States",
    "uae": "United Arab Emirates",
    "u.a.e.": "United Arab Emirates",
}


def normalize_country(name: str | None) -> str | None:
    if not name:
        return name
    stripped = name.strip()
    if not stripped:
        return stripped
    return COUNTRY_ALIASES.get(stripped.lower(), stripped)
