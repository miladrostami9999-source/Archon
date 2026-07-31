---
description: Hunt architecture leads for Archon and write an import-ready CSV
---

Hunt new companies for the Archon catalog and append them to the per-country
lead files that `/import` accepts.

This runs on the Claude Code subscription, so it costs nothing per run — unlike
the in-app Lead Hunter, which bills the API for every search. Use this for bulk
catalog building; use the app for one-off hunts.

**Brief:** $ARGUMENTS

## Read this first

**`leads/PLAYBOOK.md` is the method** — segments, the ranked source catalog,
search patterns, filters, the verification pipeline, and country quotas. Read it
before searching. This file only says *how to run*; the playbook says *what to
do*.

If no brief was given, don't ask — take the next country by quota gap from
§9 of the playbook and say which one you picked. Only ask if the brief is
ambiguous in a way that changes the work.

## Who we're finding leads for

Armila Design — a 3D architectural visualisation studio in Madrid that takes
outsourced rendering work. Founder: Milad Rostami. Style: minimalist
Scandinavian, modern organic, warm minimalism.

## What makes a good lead

Weighted the way `backend/app/services/scoring.py` scores them, so what you
prioritise matches what the app will rank:

1. **Would they outsource?** — the heaviest factor (26 pts). A 3–20 person
   studio with no in-house 3D team is the target. A 500-person practice with its
   own visualisation department is a slow, hard sale. Small beats prestigious.
2. **Timing** (20) — a reason to reply *this month*: hiring a visualiser is the
   strongest signal, then a new project, a recent award, an upcoming fair booth.
3. **Need** (22) — developers commission the most imagery, then architecture and
   interior studios. Another arch-viz studio is a competitor, not a client.
4. **Market** (17) — UAE/Saudi/Qatar pay best, then Scandinavia/UK/Switzerland,
   then Germany/Netherlands/US/Canada/Australia.
5. **Reach** (15) — a published email. A named person beats `info@`.

**Hunt every segment, not just architecture** — developers, interior design,
hospitality, retail rollout, property marketing and construction all buy
renders. Playbook §1 has the full list with target mix.

## How to run it

1. **Pick the country**, then read `leads/<country>.csv` and hold its existing
   names and domains.
2. **Search in parallel** — 4 `WebSearch` calls at once across *different*
   source tiers (playbook §2/§3), not four variants of one query. Lead with
   Tier 1 listicles on a fresh country.
3. **Verify on the company's own site.** `WebFetch` their domain — never trust a
   directory page as the source of truth. A company whose site you couldn't open
   does not go in the file.
4. **Never invent anything** — not a company, not a URL, and above all not an
   email address. Leave the cell empty instead. An invented email burns the
   sending domain's reputation, which costs far more than a missing row.
5. **MX-check the new emails** in one batch before writing:
   `Resolve-DnsName -Name <domain> -Type MX`. No MX record → clear the email.
6. **Dedupe** against the country file by name *and* domain.
7. **Append** — never rewrite existing rows.

## Output

Append to `leads/<country>.csv` (lowercase kebab-case: `united-kingdom.csv`,
`saudi-arabia.csv`, `uae.csv`, `usa.csv`), creating it with this header if new:

```
name,website,email,phone,country,city,industry,company_size,linkedin,instagram,tags,signals,style_fit,evidence,source
```

| Column | Values |
|---|---|
| `industry` | Architecture, Interior Design, Real Estate, CGI, Visualization, Animation, Construction |
| `company_size` | `solo` (1–2), `small` (3–20), `medium` (21–100), `large` (100+) |
| `signals` | semicolon-separated keys — `hiring_viz`, `recent_award`, `new_project`, `exhibiting`, `funding`, `dated_visuals`, `no_inhouse`, `active_social`. Only ones you found evidence for. |
| `style_fit` | −8 to 8 — how close their work is to Armila's aesthetic, and whether better renders would visibly help. 0 if you can't tell. |
| `evidence` | the specific fact you read that makes them a lead |
| `source` | where you found them, e.g. `Dezeen Awards 2025 shortlist` |

`signals`, `style_fit` and `evidence` feed the app's scoring — a row without
them still imports, it just scores lower than it deserves. Quote any field
containing a comma.

## When you're done

Verify the file parses, then commit and push. Report:
- how many added, and the running total for that country against its quota
- the spread by segment and by size
- which signals were found
- **what you rejected and why** — this is how the playbook gets tuned
- the next country by quota gap

Then tell Milad to upload the file at `app.armiladesign.com/import`.
