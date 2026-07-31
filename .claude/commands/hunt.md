---
description: Hunt architecture leads for Archon and write an import-ready CSV
---

Hunt new companies for the Archon catalog and write them to a CSV that
`/import` accepts.

This runs on the Claude Code subscription, so it costs nothing per run — unlike
the in-app Lead Hunter, which bills the API for every search. Use this for bulk
catalog building; use the app for one-off hunts.

**Brief:** $ARGUMENTS

If no brief was given, ask what to hunt for (region, business type, any buying
signal) and wait for an answer before searching.

## Who we're finding leads for

Armila Design — a 3D architectural visualisation studio in Madrid that takes
outsourced rendering work. Founder: Milad Rostami. Style: minimalist
Scandinavian, modern organic, warm minimalism. Clients are architecture firms,
interior designers, CGI studios and real-estate developers.

## What makes a good lead

Weighted the way `backend/app/services/scoring.py` scores them, so what you
prioritise matches what the app will rank:

1. **Would they outsource?** — the heaviest factor. A 3–20 person studio with
   no in-house 3D team is the target. A 500-person practice with its own
   visualisation department is a slow, hard sale. Small beats prestigious.
2. **Timing** — is there a reason to reply this month? Hiring a visualiser is
   the strongest signal there is, then a new project announcement, a recent
   award, an upcoming fair booth.
3. **Need** — developers commission the most imagery, then architecture and
   interior studios. Another arch-viz studio is a competitor, not a client.
4. **Market** — UAE, Saudi and Qatar pay best; then Scandinavia and the UK;
   then Germany, Netherlands, US.
5. **Reachable** — a published email. A named person beats `info@`.

## Where to search

Go to the sources the industry organises itself around, not just a general
search. `backend/app/services/discovery_sources.py` holds the full list of 53 —
read it if you need more. The high-yield ones:

- **Award shortlists** — they just won something and need press images:
  worldarchitecturefestival.com, dezeen.com/awards, architizer.com/awards,
  miesarch.com, architecture.com (RIBA)
- **Job boards** — hiring a visualiser is the strongest buying signal:
  archinect.com/jobs, dezeen.com/jobs, cgarchitect.com, LinkedIn
- **National registries** — verified, complete, almost nobody mines them:
  architecture.com + arb.org.uk (UK), bda-bund.de (DE), cscae.com (ES),
  bna.nl (NL), danskeark.dk (DK), Dubai Municipality consultant list
- **Fair exhibitor lists** — dated, public, and everyone on them has a
  marketing budget: thebig5.ae, cityscapeglobal.com, mipim.com, exporeal.net
- **Publications** — archdaily.com, dezeen.com, archello.com, divisare.com

A `site:` filter on these reaches the long tail a plain search never surfaces.

## How to run it

1. **Search first, in parallel.** Fire several WebSearch calls at once across
   different sources rather than one at a time.
2. **Then verify.** WebFetch each candidate's own website to confirm it exists,
   find the contact email, and judge the team size. A company you couldn't open
   the site for does not go in the file.
3. **Never invent anything** — not a company, not a URL, and above all not an
   email address. Leave a cell empty instead. An invented email burns the
   sending domain's reputation, which is far more expensive than a missing row.
4. **Check for duplicates.** Read `hunt-output.csv` if it already exists and
   skip anything in it. The importer also rejects duplicates by name and
   domain, so a slip is recoverable — but don't rely on that.
5. **Prefer the long tail.** Foster + Partners is already in everyone's CRM.

## Output

Write `hunt-output.csv` in the repo root with exactly this header:

```
name,website,email,phone,country,city,industry,company_size,linkedin,instagram,tags,signals,style_fit,evidence,source
```

Column notes:

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

When you're done, report how many you found, the spread by country and size,
and any you rejected and why. Then tell Milad to upload the file at
`app.armiladesign.com/import`.
