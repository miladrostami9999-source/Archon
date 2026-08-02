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
| **AIA state/regional chapter award pages** (tested: AIA Triangle NC) | 2026-08-01 | 1 | 10 (in situ studio, EVOKE Studio, The Raleigh Architecture Co., Katherine Hogan Architects, ThoughtCraft Architects, Charlton Architecture, Studio 310, Habanero Architecture — 8 kept from AIA Triangle, list now fully processed) | **Confirmed Tier 3 source, same pattern as RIBA regional awards** — one chapter page named ~15 firms across categories, most genuinely small. Every US state/city has its own chapter and annual awards page — large untapped vein. AIA Colorado tried next but its 2026 winners aren't published yet (only jury + 2025 results) — **check award-timing before relying on a chapter as this year's source; fall back to last year's winners if this year isn't out** |
| **AIA Austin 2026 Design Awards** (chapter award, direct-fetchable) | 2026-08-02 | 1 | 8 (A Parallel Architecture, Murray Legge, Low Design Office, Clayton Korte, Baldridge Architects, Frame Hospitality Group + McCraney via NAIOP cross-check) | `aiaaustin.org/2026-design-awards/` fetched directly with no 403 — gave 18 named firms across 4 categories in one call. Confirms the AIA-chapter-page pattern is repeatable: **check each chapter's award-announcement date first** (Colorado/Seattle/Minnesota hadn't published 2026 results yet when tried) rather than assuming any given chapter is ready |
| Archello country/city lists | 2026-08-01 | 1 | 1 (dSPACE Studio, Chicago) | Confirmed real but low yield this pass — Chicago/SF lists were dominated by large/famous firms (Studio Gang, Handel Architects 200+ people); only one genuinely small firm surfaced. Worth retrying on a second-tier city rather than the obvious big-name cities |
| Bisnow boutique developer search | 2026-08-01 | 1 | 3 (Continuum, Pure Development, The Abraham Companies) | |
| **NAIOP chapter-level Developer of the Year** | 2026-08-02 | 1 | 1 (McCraney Property Company — NAIOP Central Florida, 18-22 employees) | National award (Ryan Companies) is always too large, but **regional/chapter-level Developer of the Year is a good small-developer source** — confirmed on first try. Try more chapters (there are ~50 regional NAIOP chapters, each with its own annual award) |
| Property marketing agency search | 2026-08-01 | 1 | 1 (TREM Group) | Segment mostly returns marketing-agency-for-agents (not developers) or big-agency "best of" listicles — low yield, deprioritize vs. Bisnow/NAIOP for the real estate segment |
| Architizer A+List | — | 0 | — | |
| AIA national firm directory | — | 0 | — | |
| ASID / IIDA state chapter awards | — | 0 | — | Tried searching — chapter award-winner pages 403 direct; need the WebSearch-then-verify pattern like RIBA regional awards |
| Archinect Jobs / Dezeen Jobs / LinkedIn Jobs (hiring_viz) | 2026-08-01 (tried, failed) | — | 0 | **Confirmed dead end after 4 attempts across 2 runs**: archinect.com/jobs and dezeenjobs.com both 403 on direct fetch, and every WebSearch phrasing returns job-aggregator listicles (Glassdoor/ZipRecruiter counts) instead of individual company postings. One exception found by accident: Workshop/APD hiring an in-house "Architectural Visualization Specialist" — but that's evidence *against* outsourcing, not a lead. Stop spending searches on this signal for the US until a better-indexed source is found (try Built In or a state-specific job board next, not generic search) |
| Behance / ArtStation / Houzz / Clutch | — | 0 | — | |
| Fairs (Big 5 is Gulf-only — not applicable to US; use ICFF, NeoCon instead) | — | 0 | — | |

### United Kingdom

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| RIBA regional awards | 2026-08-02 | 2 | 15 (9 earlier + 6: Chiles Evans + Care, Mole, Jonathan Hendry, Brisco Loran, Tonkin Liu, Baillie Baillie) | South East, North West, South, **East Midlands, Yorkshire, National** done. Still untouched: London, East, West Midlands, North East, South West/Wessex, Wales, Northern Ireland, Scotland regional. **riba.org pages 403 direct — architectsjournal.co.uk coverage of the same awards fetches fine and lists every winner + practice**, use that route |
| **BIID Interior Design Awards** | 2026-08-02 | 1 | 8 (The Vawdrey House, Studio 9 Design, Keyhole Interiors, Rendall & Wright, Studio Clementine, Kate Bingham, Simple Simon Design, KINDLY) | **Best UK interior-design source found — `biid.org.uk/winners-25` fetches directly and lists every winner with category and region.** Fixed the UK interior gap in one call (0 → 8). 2026 winners not announced until 15 Oct 2026, so the 2025 list is the current one; revisit after that date. Regional structure means it reaches small studios outside London |
| **RESI Awards / Property Week** | 2026-08-02 | 1 | 3 (Treveth, Stories, RUFFARCHITECTS, Oberlanders) | `resiawards.com/live/en/page/2026-winners` fetches directly with the full category list. Note: no "Small Developer" category in 2026 — the useful ones are Specialist Developer, Development of the Year (Fewer than 350 Homes) and Best Residential Design (Under 350 Units), which is where the smaller firms sit. Regional equivalents (Insider South West Residential Property Awards etc.) also yielded a B Corp developer |
| Archello / Architizer listicles | — | 0 | — | |
| BIID member directory (not awards) | — | 0 | — | Separate from the awards page — a full member list would be a much bigger pool |
| Hiring boards | — | 0 | — | UK not yet tried; the US attempt was a confirmed dead end, so expect the same unless a UK-specific board indexes better |

### UAE / Saudi Arabia / Qatar

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| LinkedIn / general search | 2026-08-01 | 1 | 11 (UAE 7, Saudi 3, Qatar 1) | |
| **Archello "25 best architecture firms in Dubai"** | 2026-08-02 | 1 | 2 (X-Architects, LW Design Group) | Direct fetch 403s like other Archello pages — reached via WebSearch snippets instead, which only surfaced 2 of the 25 names. Revisit with more specific queries to pull the rest of the list |
| Architecture Leaders Awards 2026 (Design Middle East) | 2026-08-02 | 1 | 1 (Kattan Design — Creative Architecture Studio of the Year) | Both the winners and shortlist pages 403 direct; WebSearch only surfaced one named winner clearly. A full read of this awards list is still owed — try searching each category name individually ("Boutique Firm of the Year", "Emerging Studio of the Year" etc.) |
| WebSearch "boutique design studio Dubai" (general) | 2026-08-02 | 1 | 3 (Roar, C'est ici Design, North Point Architecture) | High hit rate — Roar's own "CID Middle East Boutique Design Firm of the Year" award surfaced organically this way |
| Dubai Municipality consultant database | 2026-08-02 (tried, blocked) | — | 0 | **Not a public PDF as assumed** — the actual data sits behind `deqsmart.dm.gov.ae`, an interactive portal (Corporate-practice-permit.xhtml), not a downloadable list. Deprioritize this source; the app-only "Dubai BPS" path is equally unreachable via WebFetch |
| Cityscape Global exhibitor list | 2026-08-02 (tried, blocked) | — | 0 | 2026 edition is in Riyadh (Saudi), not Dubai — exhibitor list pages need JS/login, no names surfaced via search. Try again closer to the Nov 2026 event date when press coverage of exhibitors increases |

### Denmark / Sweden / Norway

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| National award coverage (Kasper Salin, Nykredit, A+Awards) | 2026-08-01 | 1 | 5 | |
| danskeark.dk / arkitekt.se / arkitektur.no member directories | — | 0 | — | Never actually pulled the registry itself |

*(Add a new country section the first time it's hunted.)*
