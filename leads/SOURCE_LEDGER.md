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
| **Plain city-level boutique-studio WebSearch (Riyadh / Jeddah)** | 2026-08-02 | 1 | 6 (SHADES, Sibyl, Shai Designs, Majed Harasani, UrbanPhenomena, 88 Design) | **Highest-yield Saudi route by a wide margin.** With the Gulf awards press mostly 403, a plain "boutique architecture/interior studio \<city\>" search per city outperformed every structured source. Repeat per city: Dammam, Khobar, AlUla, Medina |
| Design Middle East / CID Awards (Gulf awards press) | 2026-08-02 (3rd attempt, blocked) | 3 | 3 total across all attempts | **Consistently fetch-hostile** — `design-middleeast.com` winners *and* shortlist pages, plus `commercialinteriordesign.com` CID Awards, all 403 on every attempt. Names are only obtainable from search snippets, which surface 1-3 per query. Budget one search, don't expect a full list |
| King Salman Charter for Architecture and Urbanism Award | 2026-08-02 (too early) | 1 | 0 | Second cycle submissions closed 31 Mar 2026; **2026 winners not yet announced**. 2024 winners are large civic projects (Ithra, KAFD Grand Mosque) — poor size fit anyway |
| Downtown Design Riyadh | — | 0 | — | **15–18 Sep 2026, JAX District, Diriyah** — exhibitor list worth pulling closer to the date |
| **Arabic-language WebSearch (Saudi)** | 2026-08-02 | 1 | 14 | **The unlock for Saudi after English listicles ran dry.** `مكتب هندسي معماري <city>` (architecture), `شركة تصميم داخلي <city>` (interior), `شركة تطوير عقاري السعودية` (developers) each return domestic firms with their own domains that never appear in English results. Arabic SME sites rarely expose emails in search snippets — go straight to a compact `EMAIL=... PHONE=... CITY=... SIZE=...` WebFetch of the homepage instead of a contact search. Apply the same pattern to UAE/Qatar next |
| Dubai Municipality consultant database | 2026-08-02 (tried, blocked) | — | 0 | **Not a public PDF as assumed** — the actual data sits behind `deqsmart.dm.gov.ae`, an interactive portal (Corporate-practice-permit.xhtml), not a downloadable list. Deprioritize this source; the app-only "Dubai BPS" path is equally unreachable via WebFetch |
| Cityscape Global exhibitor list | 2026-08-02 (tried, blocked) | — | 0 | 2026 edition is in Riyadh (Saudi), not Dubai — exhibitor list pages need JS/login, no names surfaced via search. Try again closer to the Nov 2026 event date when press coverage of exhibitors increases |

### Australia

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| **`architectureau.com/jobs/`** | 2026-08-02 | 1 | 4, all `hiring_viz` (Drew Dickson, MCG Architects, McIldowie Partners, DesignInc Brisbane) | **Proved the local-board thesis.** After 6 runs with zero hiring signals via international boards, this one page produced 4 in a single fetch, each naming the practice and suburb. Small board (~4 live listings) so re-check weekly rather than expecting bulk |
| **`architectureau.com/articles/2026-national-architecture-awards-shortlist/`** | 2026-08-02 | 1 | 6 (Besley & Spresser, Curious Practice, Bokey Grant, Anthony Gill, Taylor + Hinds, + J.AR Office cross-listed) | **Enormous single-page yield — 66 projects, ~80 practices named across 15 categories.** Only a fraction processed. Winners aren't announced until 29 Oct 2026, so the shortlist is the live document. Small Project / Houses (New) / Alterations categories are where the solo and small practices concentrate |
| **`architectureau.com/articles/winners-revealed-2026-australian-interior-design-awards/`** | 2026-08-02 | 1 | 5 (Studio Gram, J.AR Office, Pattern Studio, YSG Studio, Occupy Studio) | Direct fetch, full winner table with category. **"Emerging Interior Design Practice" is a purpose-built small-practice category** — go straight to it. Occupy Studio came from there |
| `architectureau.com/directory/` | 2026-08-02 (listed, not verified) | 1 | 0 written | 145 results, filterable by discipline. Pulled 9 names (Studio Nine Architects, Ian Moore Architects, CplusC Architectural Workshop, Carter Williamson Architects, Chan Architecture, Hachem, PTW Architects, Lovell Chen, McCorkell Constructions) but **did not verify them on their own sites, so none were written** — free starting list for the next Australia run |
| Shortlist names not yet processed | — | — | — | Vittino Ashe, Nielsen Jenkins, Caleb Smith Architect, Fieldwork, Atelier Luke, Atelier Marks Gaal, Simon Pendal Architect, Rezen Studio, Trella Architecture and Interiors, Bourke and Bouteloup, Partners Hill, MA and Co, Officer Woods, Vokes and Peters, Cumulus Studio, Robert Simeoni, Edition Office, Kennedy Nolan, Phillips Pilkington, Grieve Gillett, Ashley Halliday, MORQ |
| AIA Emerging Architect Prize | 2026-08-02 (low yield) | 1 | 0 | 2026 national recipient named (Mike Sneyd) but the article gives no practice name or location — chapter-level Emerging Architect pages may be better |
| `co-architecture.com` · `careersindesign.com.au` · `indesignlive.com` | — | 0 | — | Untested Australian sources |

### Netherlands

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| **`bna.nl` member register** | 2026-08-03 | 2 | 10 | **The volume source for the Netherlands, ~1,000 bureaus.** Individual member pages fetch cleanly at `bna.nl/architecten/<id>/` and return NAME + EMAIL + PHONE + CITY + WEB in one call — **no separate contact sweep needed, ~100% email rate**, the best per-call yield of any source so far. ⚠️ **The browse page is JS-rendered and returns nothing** (`/architecten/` and `/vind-een-bna-architect/` both show only "Resultaten worden geladen"). Reach member pages via `site:bna.nl/architecten <keyword>` search instead — vary the keyword (city, "studio", "architecten", "bureau") to surface different slices of the register |
| BNA Beste Gebouw van het Jaar | 2026-08-03 | 1 | 10 | 2026 winner SAWA (Mei architects) + 8 nominees, via bouwenmetstaal.nl which fetches cleanly. Small annual pool |
| ARC Awards (de Architect) | 2026-08-03 | 1 | 1 | ARC25 gave only 3 winners and **two were Belgian** — check nationality before writing. ARC27 lands Jan 2027 |
| `architectenweb.nl` | 2026-08-03 | — | 0 | News articles fetch fine (used for ARC25); the **vacancy board** is the JS-blocked part, not the whole site — earlier ledger note was too broad |
| `archined.nl` vacaturebank | — | 0 | — | Untested |

### Switzerland

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| **`archinaut.ch` Top 100 Swiss offices** | 2026-08-03 | 1 | 14 | **Best-structured Tier 1 source found in any country.** 100 offices, each with city, and the list is *pre-banded by staff count* (>50 / 10–50 / <10) — so `company_size` comes from the source rather than inference, which is normally the weakest field. **Only ~15 of 100 processed — 85 names still free for the next runs.** Fetches directly, no 403 |
| Swiss Arc Award | 2026-08-03 (too early) | — | 0 | 2026 winners announced **29 Oct 2026**; the 42-project shortlist exists but isn't published as a readable list, and baunetz.de's coverage 403s. Revisit after the ceremony |
| Hochparterre / espazium.ch | — | 0 | — | Untested |
| SIA member register | — | 0 | — | ~15,000 members, untested |

**Swiss-specific note:** practices overwhelmingly publish contact forms or
script-protected addresses rather than plain emails — only 4 of the first 14
rows had one. Expect a low email rate here and don't spend extra fetches
chasing it (§11 rule 1).

### Denmark / Sweden / Norway

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| National award coverage (Kasper Salin, Nykredit, A+Awards) | 2026-08-01 | 1 | 5 | |
| danskeark.dk / arkitekt.se / arkitektur.no member directories | — | 0 | — | Never actually pulled the registry itself |

*(Add a new country section the first time it's hunted.)*

---

# Local-market sources by country

Every country runs its own architecture job boards, practice directories and
trade portals in its own language. These are where domestic firms actually
advertise and list themselves — a completely separate pool from the
English-language international sites (ArchDaily, Dezeen, Archinect), and far
less picked over.

**Why this matters more than it looks:** `hiring_viz` was logged as a dead end
for the US because `archinect.com/jobs` and `dezeenjobs.com` both 403 and
generic search only returns aggregator listicles. **The local boards don't have
that problem** — `architectureau.com/jobs` and `azuremagazine.com/jobs` fetch
directly and name the hiring practice and city in plain text. The signal was
never unreachable; the international sources were just the wrong door.

Statuses below are from **actual fetch tests**, not assumptions.

## ✅ Verified working — fetches directly and names firms

| Country | Source | What it returns | Notes |
|---|---|---|---|
| 🇦🇺 Australia | `architectureau.com/jobs/` | Practice name + suburb/state per listing | Returned Drew Dickson Architects, MCG Architects, McIldowie Partners, DesignInc Brisbane. **The single best hiring_viz source found in any country so far** |
| 🇦🇺 Australia | `architectureau.com/directory/` | Practice directory, filterable by discipline (architecture, interior, landscape, lighting, sustainability) | Not yet pulled — high priority for the Australia run |
| 🇨🇦 Canada | `azuremagazine.com/jobs/` | Firm name + city | Returned Design Workshop Architects, Studio Paolo Ferrari (Toronto), 5468796 (Winnipeg). Mixes in US listings — filter by city |
| 🇩🇰 Denmark | `arkitektforeningen.dk/jobbors/` | 16 named organisations in one fetch | Danish Association of Architects' own board. Mixes practices (Danielsen Architecture, C.F. Møller, Clement & Carlsen, HHM) with municipalities and state bodies — filter to the practices |
| 🇳🇴 Norway | `arkitektur.no/ledige-stillinger/` | Office name + city | Returned Arkitema, HLM Arkitektur (Bergen), Asplan Viak, Reiulf Ramstad arkitekter (Oslo) |

## ⛔ Verified blocked or empty — don't spend a fetch

| Country | Source | Why it failed |
|---|---|---|
| 🇩🇪 Germany | `competitionline.com/de/jobs` | JS-rendered; fetch returns the header only, no listings |
| 🇨🇭 Switzerland | `swiss-architects.com/de/stellenanzeigen` | 403 |
| 🇦🇹 Austria | `austria-architects.com/de/stellenanzeigen` | 403 — **the whole `<country>-architects.com` network appears to block fetchers**, so assume the same for world-architects, german-architects etc. |
| 🇨🇭 Switzerland | `hochparterre.ch/stellenplattform` | Fetched fine but showed "Keine Beiträge gefunden" — genuinely empty at time of check, worth retrying |
| 🇳🇱 Netherlands | `architectenweb.nl/vacatures/` | Fetched but "Geen resultaten gevonden"; listings live behind `/vacatures/default.aspx` |
| 🇦🇪 UAE | `dubaidesigndistrict.com/the-community/community-directory` | JS-rendered template with placeholder lorem-ipsum; real listings load client-side |
| 🇮🇪 Ireland | `riai.ie/careers-in-architecture/jobsearch` | Landing/instructions page only; the live board is elsewhere |
| 🇩🇰 Denmark | `arkitektjobs.dk` | Domain does not resolve |
| 🇮🇹 Italy | `professionearchitetto.it/lavoro/offerte/` | **Seasonal** — the board is suspended for summer and resumes **31 August 2026**. Not broken, just closed; retry after that date |

## 🔍 Discovered but not yet fetch-tested

Test one or two per run rather than all at once.

| Country | Sources |
|---|---|
| 🇩🇪 Germany | `baunetz.de/stellenmarkt/` (largest German architecture magazine) · `ak-berlin.de/service/stellenboerse/` and the other 15 state *Architektenkammer* boards · `bauingenieur24.de` · `architektenjob.de` |
| 🇳🇱 Netherlands | `archined.nl/vacaturebank/` · `archi-jobs.nl` |
| 🇧🇪 Belgium | `architectenjobs.be` |
| 🇨🇭 Switzerland | `espazium.ch/de/stellen` |
| 🇫🇷 France | `emploi.batiactu.com` · `emploi-btp.lemoniteur.fr` · `charretteservice.fr/fr/offres/architecture` (40-year specialist recruiter) · `archibat.com` |
| 🇪🇸 Spain | `coam.org/es/servicios/empleo` (Madrid college of architects; posting contact `empleo@coam.org` implies real firm postings) · `coam.org/red-arquitectos/` |
| 🇮🇹 Italy | `archi-jobs.it` |
| 🇮🇪 Ireland | `riai.ie/work-with-an-architect/find-an-architect/practice-directory/` — searchable by name, location, expertise |
| 🇦🇹 Austria | `nextroom.at` (curated by Vorarlberg Architecture Institute) |
| 🇦🇺 Australia | `co-architecture.com` · `careersindesign.com.au` · `indesignlive.com` (also covers APAC) |
| 🇸🇬 Singapore | `sg.jobstreet.com/architect-jobs` — search surfaced IX Architects, Zarch Collaboratives, staarch, JGP Architecture |
| 🇸🇦 Saudi | `saudieng.sa` (Saudi Council of Engineers register) · `eyeofriyadh.com/directory` |
| 🇶🇦 Qatar | Qatar Society of Engineers register |

## How to use these

1. **Lead with the local board for hiring signals**, not Archinect/Dezeen Jobs.
   A named practice on a local board is a `hiring_viz` lead the international
   sources will never surface.
2. **Filter out the non-practices.** National boards mix in municipalities,
   universities, state agencies and engineering giants (Sweco, Asplan Viak).
   Those are real organisations but poor fits — a municipality doesn't
   commission renders the way a 12-person studio does.
3. **Search in the local language** when going through WebSearch instead:
   `arkitektkontor`, `Architekturbüro`, `bureau d'architecture`,
   `studio di architettura`, `despacho de arquitectura`, `architectenbureau`.
4. **Note the seasonality.** European boards thin out in July–August; Italy's
   closes outright. Gulf boards do not.
