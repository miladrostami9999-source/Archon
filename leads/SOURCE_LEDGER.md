# Source Rotation Ledger

Solves one problem: with ~35 sources across 7 tiers, every run defaults to the
same 2-3 familiar ones (archisoup, generic WebSearch) and the rest never get
touched. This ledger tracks what's been tried per country so each run can pick
what's actually stale — not randomly, not everything, deliberately.

**Why rotation, not random:** a random pick can hit the same source twice in a
row and never reach another. A round-robin by "longest since last used" is
deterministic, guarantees full coverage after N runs, and is auditable — you
can see exactly why a source was picked. Random adds variance for no benefit.

**Why rotation, not exhaustive-every-time:** hitting all 35 sources every run
would multiply search cost 5-8x for a shrinking marginal return (most
countries only have real inventory on 4-6 of the 7 tiers anyway — a small
country has no fair-exhibitor list worth checking every single run). A run
touches ~5 sources: the country's best Tier 1 source (always, since it's the
highest yield) + 4 more chosen by the algorithm below.

## Per-run source selection algorithm

1. Read this file's table for the target country. If the country has no rows
   yet, this is a fresh country — start with Tier 1 + Tier 3 (listicles and
   awards give the fastest first batch).
2. Compute the **segment gap**: compare the country's running segment mix
   (from its `leads/<country>.csv`) against the target mix in playbook §1
   (40% architecture / 25% developer-real estate / 20% interior / 15% other).
   Whichever bucket is furthest below target gets priority.
3. Pick sources:
   - **1 source** = the country's best untried (or longest-idle) Tier 1
     source, preferring one for the gapped segment (e.g. a developer-focused
     listicle if Real Estate is behind).
   - **3 more sources** = the longest-idle entries across Tiers 2, 3, 4, 6, 7
     (skip Tier 5 — one-firm-at-a-time, lowest priority to rotate in), again
     preferring the gapped segment where a source exists for it.
4. Run the searches, verify, append, then **update the table below**: mark
   each source used today, increment its count, note firms yielded.

## Segment-specific Tier 1 sources (fixes the architecture skew)

Found because the first two runs were 35/39 architecture and 0 interior
design — the generic Tier 1 list (Archello, archisoup, Architizer) is
architecture-only, so anything that doesn't add developer/interior sources
here will keep skewing the same way no matter how careful the search prompts
are.

| Segment | Source | Pattern |
|---|---|---|
| Real estate developer | **Bisnow** city pages | `site:bisnow.com "<city>" developer boutique` |
| Real estate developer | **Connect CRE** | `site:connectcre.com boutique developer <region>` |
| Real estate developer | **NAIOP Developer of the Year** (state chapters) | annual award, small/regional developers |
| Real estate developer | Local Urbanize-network city sites | `urbanize.city` — Dallas, LA, SF etc. editions |
| Real estate developer | Local business journal real-estate awards | `"<city> business journal" "real estate awards" developer` |
| Interior design | **Interior Design Magazine "Giants"** list | segmented by size band — pick the small/mid bands, not the top 20 |
| Interior design | **Boutique Design (BD) magazine** | boutique hospitality/interiors, name in the title |
| Interior design | ASID / IIDA **state chapter** award winners | smaller pool than the national award, closer to boutique size |
| Interior design | Archello / Architizer "best interior design firms in \<city\>" | same listicle pattern as architecture, just filtered to interiors |

## Ledger

One row per source actually used for a country. `—` = never tried.

### United States

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| archisoup city lists | 2026-08-01 | 2 | 39 (17 light + 22 re-verified) | Boston + Philadelphia done. Next: Chicago, LA, NYC, Seattle, Denver, Miami, Austin, Nashville |
| AIA 2026 award winners | 2026-08-01 | 1 | 3 (Duvall Decker, Cotton Estes, Renée del Gaudio) | National + state chapter awards both worth mining further |
| PR Newswire / Businesswire developer search | 2026-08-01 | 1 | 3 (Pearlstone, Signet, Matterhorn) | Real estate only — good source for the gapped segment |
| Bisnow boutique developer search | 2026-08-01 | 1 | 3 (Continuum, Pure Development, The Abraham Companies) | NAIOP national award was too large (Ryan Companies) — chapter-level pages worth trying directly next, not just search |
| Interior Design Magazine Rising Giants 2026 | 2026-08-01 | 1 | 10 (Meyer Design, Aria Group, EDG Design, Design Republic, Looney & Associates, STG Design, KZF Design, Architecture Incorporated, Jeffrey Beers International, BLINK Design Group) | Direct fetch worked on the article page — a real Tier 1 source for interior design, same pattern as archisoup. List fully processed now (10/10 named firms used). Top 100 Giants list untried (likely too large/famous) — Rising Giants (#101-200) is the right band |
| **AIA state/regional chapter award pages** (tested: AIA Triangle NC) | 2026-08-01 | 1 | 8 (in situ studio, EVOKE Studio, The Raleigh Architecture Co., Katherine Hogan Architects, ThoughtCraft Architects, Charlton Architecture — 6 kept, 2 more names logged but not yet processed: Studio 310, Habanero Architecture) | **New confirmed Tier 3 source, same pattern as RIBA regional awards** — one chapter page named ~15 firms across categories, most genuinely small. Every US state/city has an AIA chapter with its own annual awards page — this is a large untapped vein, try a different chapter/city each run |
| Bisnow boutique developer search | 2026-08-01 | 1 | 3 (Continuum, Pure Development, The Abraham Companies) | NAIOP national award was too large (Ryan Companies) — chapter-level pages worth trying directly next, not just search |
| Archello country/city lists | — | 0 | — | Not yet tried for a US city — high priority next |
| Architizer A+List | — | 0 | — | |
| AIA national firm directory | — | 0 | — | |
| ASID / IIDA state chapter awards | — | 0 | — | Tried searching — chapter award-winner pages 403 direct; need the WebSearch-then-verify pattern like RIBA regional awards |
| Archinect Jobs / Dezeen Jobs / LinkedIn Jobs (hiring_viz) | — | 0 | — | Still 0 hiring signals found in 3 runs — searches keep surfacing job-board aggregator pages, not individual postings. Try fetching archinect.com/jobs directly with a specific city filter instead of a generic search next time |
| NAIOP chapter-level Developer of the Year | — | 0 | — | National award only found large firms; try state/regional chapters directly |
| Behance / ArtStation / Houzz / Clutch | — | 0 | — | |
| Fairs (Big 5 is Gulf-only — not applicable to US; use ICFF, NeoCon instead) | — | 0 | — | |

### United Kingdom

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| RIBA regional awards | 2026-08-01 | 1 | 9 | Only South East + North West + South tried — 10 more regions untouched |
| Archello / Architizer listicles | — | 0 | — | |
| BIID / ASID interior directories | — | 0 | — | Interior design segment gap |
| Hiring boards | — | 0 | — | |

### UAE / Saudi Arabia / Qatar

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| LinkedIn / general search | 2026-08-01 | 1 | 11 (UAE 7, Saudi 3, Qatar 1) | |
| Dubai Municipality consultant PDF | — | 0 | — | Verified accessible, never actually pulled — high priority |
| Design Middle East / Architecture Leaders Awards | 2026-08-01 (partial) | 1 | 2 | Only skimmed — full shortlist not read |
| Cityscape / Big 5 exhibitor lists | — | 0 | — | |

### Denmark / Sweden / Norway

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| National award coverage (Kasper Salin, Nykredit, A+Awards) | 2026-08-01 | 1 | 5 | |
| danskeark.dk / arkitekt.se / arkitektur.no member directories | — | 0 | — | Never actually pulled the registry itself |

*(Add a new country section the first time it's hunted.)*
