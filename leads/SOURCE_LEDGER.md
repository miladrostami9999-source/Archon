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
| **Architizer "100 Best … in the United States"** | 2026-08-04 | 1 | 8 | Returned 57 firms (ranks 100-44) with cities in one fetch. ⚠️ **Single page only** - `/2/` returns the same content, so ranks 43-1 are unreachable this way. Skews to small design-led practices |
| **Architizer per-city lists** ("30 Best in \<city\>") | 2026-08-06 | 3 | 25 | **The better Architizer route** — but now **exhausted**: only three US city editions exist (Seattle 33 firms, San Francisco 30, Chicago 30) and all three are used. No Denver, Portland, Minneapolis or Austin editions. Overlap against the catalog rose to 5-6 firms per list by the end, indicating those three cities are near saturation. Non-US editions exist (Australia at least) and are untouched |
| Architizer A+List | — | 0 | — | |
| AIA national firm directory | — | 0 | — | |
| ASID / IIDA state chapter awards | — | 0 | — | Tried searching — chapter award-winner pages 403 direct; need the WebSearch-then-verify pattern like RIBA regional awards |
| Archinect Jobs / Dezeen Jobs / LinkedIn Jobs (hiring_viz) | 2026-08-01 (tried, failed) | — | 0 | **Confirmed dead end after 4 attempts across 2 runs**: archinect.com/jobs and dezeenjobs.com both 403 on direct fetch, and every WebSearch phrasing returns job-aggregator listicles (Glassdoor/ZipRecruiter counts) instead of individual company postings. One exception found by accident: Workshop/APD hiring an in-house "Architectural Visualization Specialist" — but that's evidence *against* outsourcing, not a lead. Stop spending searches on this signal for the US until a better-indexed source is found (try Built In or a state-specific job board next, not generic search) |
| Behance / ArtStation / Houzz / Clutch | — | 0 | — | |
| Fairs (Big 5 is Gulf-only — not applicable to US; use ICFF, NeoCon instead) | — | 0 | — | |
| **archisoup city lists (Austin)** | 2026-08-15 | 1 | 12 (Alterstudio, Jay Corder, McKinney York, Chioco, Barley|Pfeiffer, Dick Clark + Associates, Forge Craft, LaRue, Geschke Group, Vanguard Studio, Clark Richardson, Pfluger) | `archisoup.com/architecture-firms-in-austin` (note the URL pattern is `/architecture-firms-in-<city>`, not `/blog/best-architecture-firms-in-<city>`) fetched cleanly with all 20 names + websites in one call — best single source this run. **archisoup NYC and Denver pages 404/return no firm list at the guessed URL** — the site doesn't have every city, verify with `site:archisoup.com` search before assuming a city page exists |
| **archisoup Portland** | 2026-08-15 | 1 | 1 (FIELDWORK Design & Architecture) | List page yielded only one firm this pass before the run was interrupted mid-batch — Portland's page appears thinner than Austin's, or only the top entry was captured before the connection dropped. Worth a clean re-fetch to confirm the full list |
| **Native-language boutique-studio WebSearch, second-tier cities** | 2026-08-15 | 1 | 28 across Portland OR (2), Minneapolis/St. Paul (6), Charlotte (3), Kansas City (5), Pittsburgh (5), Salt Lake City (5), plus 2 Chicago-area real estate developers via CREDA/NAIOP and 1 Raleigh developer | Repeats the pattern that worked for Denver/Nashville last round — per-city "boutique architecture/interior design firm" search reliably surfaces 3-6 small studios per city with published emails. **CREDA (NAIOP) Chicago 2025 Awards** page also worked directly for real estate leads (Northern Builders, The Missner Group) — same regional-NAIOP-chapter pattern as SoCal/Central Florida. Run was cut short by a connection error partway through Phase B, so several more cities on the list (AIA San Diego/Colorado, more NAIOP chapters, ASID/IIDA) are still untried for next time |
| WebSearch boutique-studio sweep (Denver) | 2026-08-15 | 1 | 9 (StudioHOFF, Studio Architecture, Craine, Root Architecture and Development, Arch11, KGA Studio, Sopher Sparn, Confluent Development) | Untried city, no dedicated listicle found — plain `"boutique architecture firm Denver"` WebSearch worked well, most results were genuinely 3-20 person practices |
| WebSearch boutique-studio sweep (Nashville) | 2026-08-15 | 1 | 9 (Centric, Allard Ward, Gilbert McLaughlin Casella, Smith Gee, Anecdote, CDP, Parkes & Lamb, Natalie Hager, Marcelle Guilbeau, JL Design) | Same pattern for Nashville architecture + interior design; email hit rate lower for solo interior designers (several only surface a personal Gmail, which we don't accept — leave blank rather than use a non-company domain) |
| **NAIOP chapter-level Developer/Owner of the Year** (tested: NAIOP SoCal) | 2026-08-15 | 1 | 2 (9th St. Partners — 2026 Principal/Owner/Developer of the Year winner, Kurv Industrial — multi-category finalist) | `naiopsocal.org/2026-awards-awardees/` and the linked finalists article both fetched directly with full winner/finalist lists by category — confirms the chapter-award pattern works outside Central Florida. Most SoCal categories skew to contractors/brokers, not developers — Principal/Owner/Developer of the Year is the category to mine |
| AIA San Diego / AIA Colorado 2026 chapter awards | 2026-08-15 (tried, failed) | — | 0 | Both chapters' 2026 winners are unpublished as of this run (San Diego event is Aug 20 2026, Colorado's is Sept 17 2026) — retry after those dates |
| **archisoup Portland (re-fetch attempt)** | 2026-08-17 (tried, failed) | 1 | 0 | `archisoup.com/architecture-firms-in-portland` gave `ECONNREFUSED` on two separate attempts this run — looks like a transient network/DNS issue on archisoup's side rather than the URL being wrong. Still only 1 firm (FIELDWORK) captured for Portland total; retry with a fresh connection next round before giving up on this city |
| **Native-language/boutique-studio WebSearch, second-tier cities round 2** | 2026-08-17 | 1 | 25 across Phoenix (4: West Design Studio, Studio Ma, Serbin Studio, Candelaria Design), San Diego (2: DEVIE Studio, Formation Studio), Sacramento (2: Simopoulos Designs, Haven Studios), Indianapolis (4: HAUS Architecture, ONE 10 STUDIO, Studio RD, Blackline Studio), Columbus (4: The Columbus Architectural Studio, GUNZELMAN architecture+interiors, Creative Studio Architects, urbanorder architecture), Richmond/Norfolk (3: GARC, Full Scale Studio, Studio Z Architecture, Walter Parks Architects), Cincinnati (5: Platte Architecture+Design, Grove Architects, Team B Architecture & Design, City Studios Architecture, Michael McInturf Architects) | Same repeatable pattern as Denver/Nashville/Minneapolis rounds — confirms it scales to any untried second-tier city. Email hit rate ~50%; several sites only publish a contact form or a personal Gmail (Grove Architects) which was correctly left blank. **PHX Architecture, JWDA Architects and Ten Seventy Architecture already existed in the file from an earlier round** — caught by the pre-write dedupe script, a reminder this pattern keeps resurfacing small-city studios across runs |
| NAIOP Georgia/Atlanta, NAIOP Northern California, NAIOP Dallas-Fort Worth chapter awards | 2026-08-17 (tried, failed) | — | 0 | None of the three chapters surface a chapter-level "Developer of the Year" 2026 result via WebSearch — results only return the *national* NAIOP award (Ryan Companies) or generic chapter homepages. NAIOP Georgia's 2025 awards page and content both 403'd on direct WebFetch. SoCal/Central Florida/Chicago(CREDA) remain the only chapters confirmed working directly — try fetching each candidate chapter's own awards URL directly next time instead of relying on WebSearch snippets |
| AIA Michigan / AIA Detroit 2026 awards | 2026-08-17 (tried, failed) | — | 0 | 2026 winners exist (SmithGroup, Provoke Design + MGA Architects) but SmithGroup is a mega-firm and the source article (buildingenclosureonline.com) 403'd on direct WebFetch, and WebSearch alone didn't surface enough named small firms to be worth the follow-up calls this round — deprioritize vs. a state with a directly-fetchable awards page |
| **archisoup, untried cities round 5 (Tampa/St. Louis/New Orleans/Milwaukee)** | 2026-08-17 (tried, failed) | 1 | 0 | `site:archisoup.com "architecture firms in <city>"` returned zero archisoup hits for all four cities this round — archisoup simply doesn't have pages for these; fell back to plain boutique-studio WebSearch instead, which worked as usual. Don't keep re-trying `site:archisoup.com` for a city once it 404s on the first search |
| **Boutique-studio WebSearch round 5** (Tampa, St. Louis, New Orleans, Louisville, Milwaukee, Boise, Oklahoma City) | 2026-08-17 | 1 | 32 (3 Tampa, 3 St. Louis, 7 New Orleans, 5 Louisville, 3 Milwaukee, 2 Boise, 9 Oklahoma City incl. 2 real estate developers) | Same repeatable pattern, seventh city batch in a row to work cleanly — Oklahoma City was unusually rich for interior design (5+ solo/small studios). Email hit rate ~45%: several sites only publish a contact form, and 2 candidates (Studio Boise, VY Architecture) surfaced only a personal Gmail and were correctly left blank rather than accepted |
| **ASID Texas Chapter 2026 Austin Design Excellence Awards** | 2026-08-17 | 1 | 1 (Donna Figg Design, 1st place) | `tx.asid.org/awards/2026-austin-design-excellence-awards/1st-place-849` fetched directly with no 403 — confirms the WebSearch-then-direct-fetch pattern works for ASID chapter awards after 2+ failed rounds. Yield was thin (1 named winner on this specific results page) — try other placement pages (`2nd-place`, `3rd-place`, other categories) on the same site next round, there are likely more per-category pages |
| **NAIOP New Jersey / Pittsburgh Developer of the Year 2026** | 2026-08-17 (tried, failed) | 1 | 0 | NJ chapter's 2026 gala covered Deal of the Year and various non-developer awards, no "Developer of the Year" category found. Pittsburgh's banquet (May 28 2026) result wasn't surfaced by WebSearch — only past-years' RIDC wins. Neither chapter's own awards URL was directly fetchable this round; try a direct fetch of naioppittsburgh.com/events/2026/awardsbanquet post-event next round |

### United Kingdom

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| RIBA regional awards | 2026-08-15 | 4 | 43 (24 earlier + 19: East [Napier Clarke, Edward McCann, TiggColl, Kirkland Fraser Moor, TAS Architects, Beech Architects, Haysom Ward Miller, Alison Brooks Architects, Bennetts Associates], West Midlands [Pringle Richards Sharratt, Associated Architects], South West and Wessex [Barc Architects, MJW Architects]) | East, West Midlands and South West/Wessex full shortlists now covered via WebFetch/WebSearch (AJ 403s on West Midlands direct fetch, riba.org and pbctoday work as fallback). RIAS/Scotland is a **separate body, not RIBA** — its awards site had no direct crawlable list, but WebSearch snippets + one summary article yielded 6 firms (GRAS, jmarchitects, Collective Architecture, Studio Octopi, Hoskins Architects) cleanly. Wales (RSAW) shortlist re-checked, all 6 winners already in file from a prior pass — no new names. Still worth a deeper look: East Midlands (only partially mined) |
| **AJ Small Projects Awards** | 2026-08-15 | 1 | 15 (2026 shortlist: Owain Williams, Studio Grieveson, Studio MUTT, BanfieldWood, KAST Architects, Mark Hackett Architect, James Alder Architects, Maria Gasparian Studio, NOOMA Studio, Northern Bureau for Architecture, Neiheiser Argyros, Bricolage; 2025 winners/shortlist: Invisible Studio, OEB Architects, Daniel Koo Architects, AAVA Architects) | **Untried source, high yield — `architectsjournal.co.uk/news/aj-small-projects-2026-shortlist-revealed` and the `smallprojects.architectsjournal.co.uk` 2025-winners page both fetch directly** with a clean 20-name shortlist and a longer historical winners list. Skews heavily solo/small London residential — exactly the target profile. Contact-sweep hit rate was low (~45%) since many are brand-new 1-2 person practices without indexed contact pages; several sites 403'd on WebFetch even when the domain was confirmed by search. Worth a repeat pass when the 2027 shortlist lands |
| **BIID Interior Design Awards** | 2026-08-02 | 1 | 8 (The Vawdrey House, Studio 9 Design, Keyhole Interiors, Rendall & Wright, Studio Clementine, Kate Bingham, Simple Simon Design, KINDLY) | **Best UK interior-design source found — `biid.org.uk/winners-25` fetches directly and lists every winner with category and region.** Fixed the UK interior gap in one call (0 → 8). 2026 winners not announced until 15 Oct 2026, so the 2025 list is the current one; revisit after that date. Regional structure means it reaches small studios outside London |
| Dezeen Awards UK longlist | 2026-08-15 (tried, failed) | 1 | 0 | 2026 longlist not yet published (awards open for entries Feb 2026, ceremony not until Nov 2026); 2025 UK interiors longlist search only surfaced one already-covered name (Bluelion Studios/Foster Lomas). Retry closer to the Sept 2026 longlist announcement |
| RIBA House of the Year longlist | 2026-08-15 (tried, failed) | 1 | 0 | 2026 longlist not yet published as of this run; only historical (2019-2022) results indexed. Retry later in the year |
| **RESI Awards / Property Week** | 2026-08-02 | 1 | 3 (Treveth, Stories, RUFFARCHITECTS, Oberlanders) | `resiawards.com/live/en/page/2026-winners` fetches directly with the full category list. Note: no "Small Developer" category in 2026 — the useful ones are Specialist Developer, Development of the Year (Fewer than 350 Homes) and Best Residential Design (Under 350 Units), which is where the smaller firms sit. Regional equivalents (Insider South West Residential Property Awards etc.) also yielded a B Corp developer |
| Archello / Architizer listicles | — | 0 | — | |
| **BIID new-member quarterly digest** | 2026-08-12 | 1 | 4 (Jenna Basford Interiors, Victoria Meale Design, Valor Collective, Kettle Design) | `biid.org.uk/news/new-biid-members-and-industry-partners-*` pages fetch directly and list every new member each quarter, mostly named-person solo studios. High-volume but low-hit-rate for verifiable emails — most solo entries only give a name with no findable site/email (e.g. Drumond Interior Design's own domain didn't resolve on fetch, Bell Lowry Design and COA Atelier didn't surface real websites at all). Worth a repeat pass per quarter, budget ~1 search per candidate name |
| Hiring boards | 2026-08-12 (tried, failed) | 1 | 0 | Same dead end as the US: WebSearch for "3D visualiser"/"CGI artist" + "UK" surfaces only recruiter/job-aggregator listings (MADD Recruitment, Indeed, LinkedIn Jobs counts), never a hiring studio's own page. The one studio name that surfaced (RedWhite CA) is itself a competing arch-viz studio, not a client. Stop spending searches on this signal for the UK too |
| **RIBA East Midlands (deep dive)** | 2026-08-17 | 1 | 1 (CPMG Architects) | East Midlands turned out to be **already well-mined from the prior "partially mined" pass** — Mole Architects, Jonathan Hendry Architects, Chiles Evans + Care Architects, Brisco Loran and Tuckey Design Studio were all already in the file from round 3. Only CPMG Architects (co-architect on the Design and Digital Arts Building) was new. Diminishing returns on this specific region now; don't prioritize it again soon |
| **Insider regional property awards (North West)** | 2026-08-17 | 1 | 3 (Buttress Architects, CODA Studios, Kingswood Homes) | `insidermedia.com` North West Residential Property Awards 2026 coverage article 403s on direct WebFetch but WebSearch snippets surfaced a clean winners list. Good developer/architect mix. Worth repeating for Yorkshire/South East/Wales editions (Yorkshire 2026 winners not yet published as of this run — ceremony is 24 Sept 2026) |
| BIID full member directory | 2026-08-17 (tried, failed) | 1 | 0 | `biid.org.uk/find-a-member` fetch timed out (ETIMEOUT) rather than 403ing — likely JS-rendered as flagged in the ledger note. Worth one more attempt via a search-engine-indexed sub-page rather than the interactive directory itself next round |
| Hospitality/retail interior design segment (plain WebSearch) | 2026-08-17 | 1 | 12 (Muzo, TO Design, Studio 93, The Stylesmiths, Johnson Naylor, ICA Studio, Boxx Design Studio, Cotton Tree Interiors, Harp Design, Wanda Creative, Harlequin Design, MF Design Studio) | **Best-yield source this round.** Plain "boutique hospitality/retail interior design studio UK" searches outperformed the structured award sources — hit rate on names was high, though ~40% had no publicly indexed email (contact-form-only sites). Worth repeating per-city (Manchester, Birmingham, Leeds hospitality segments untried) |
| Edinburgh/Scotland boutique interior search (plain WebSearch) | 2026-08-17 | 1 | 6 (Bryce McKenzie Design, Malcolm Duffin Design, Robertson Lindsay Interiors, Studio Sam Buckley, Jeffreys Interiors, Skela Studio) | First dedicated Edinburgh interior-design city search (previous Scotland coverage was RIAS architecture awards only) — good yield of solo/small luxury-residential studios. Glasgow and Aberdeen untried |
| Bath/Bristol small-practice search (plain WebSearch) | 2026-08-17 | 1 | 4 (Lacey Architecture, Philip Clifford Design, Designscape Architects, Richard Pedlar Architects) | Plain "small architecture practice Bristol/Bath" search surfaced solid solo/small residential practices not covered by the RIBA South West Awards pass |
| North West property developer search | 2026-08-17 | 1 | 1 (Heaton Group) | Single targeted developer name search; low-effort top-up alongside the Insider North West awards pull |

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
| **Arabic-language WebSearch (UAE)** | 2026-08-15 | 1 (5 queries: Dubai/Abu Dhabi architecture, interior, developer, Sharjah/Al Ain) | 0 written directly | Did **not** repeat the Saudi win — every query returned aggregator blogs (yellowpages-uae, buildeey, super1number) and firms already in the file (Algedra, Antonovich, Rady Interior) rather than fresh names. UAE's SEO-blog layer is thicker than Saudi's, crowding out small independent sites in Arabic search. Not worth repeating as a primary source for UAE; English-language boutique/listicle search still outperforms it here |
| **arcxplore.com/architecture-firms-in-abu-dhabi/** | 2026-08-15 | 1 | 14 (Metaverse Architects, M+N Architecture, Bayaty Architects, Al Bahri Engineering Consultancy & Interior Design, Aperture Design Studio, ARKI Group, Design Hub Interior Design & Decoration, MF Architect, and others deduped/skipped as too large) | **Best single source this run** — fetches directly (unlike Archello), lists 70 firms with city, mostly small/medium Abu Dhabi practices alongside the expected mega-brands (Gensler, SOM, Foster+Partners — skipped per playbook exclusion list). One fetch, ~14 usable rows |
| Architecture Leaders Awards 2026 "Emerging Firm/Studio of the Year" shortlist | 2026-08-15 | 1 | 3 new (SharpMinds Consulting Engineers, FRM Urban, tangramGulf/Tangrammena) | Category-specific search (rather than generic "winner" search) finally surfaced the shortlist Archello/CID-style pages block on direct fetch. FRM Urban, Sharpminds, Soch Collective, Tangrammena all appeared; Soch Collective had no findable independent website so was dropped |
| Al Ain interior design segment (plain WebSearch) | 2026-08-15 | 1 | 3 (Laarte, YMS Group, EC Consult) | **First pass at Al Ain specifically** — previously only Dubai/Abu Dhabi/Sharjah covered. Small yield but clean; worth a deeper pass next UAE run alongside Fujairah (still untouched) |
| Gulf Business Real Estate Summit & Awards 2026 | 2026-08-15 | 1 | 3 (Arif Developments, ANAX Developments, ALA Developments) | Newer awards program (supersedes/parallels the older Gulf Real Estate Awards search); named a "Residential Developer of the Year" and several boutique-developer honorees directly in press coverage, no fetch needed |
| Hospitality/boutique interior WebSearch (Dubai) | 2026-08-15 | 1 | 4 (Spazio, Fajr Interiors, Decorious, Five Ateliers) | Plain "hospitality interior design firm Dubai" query — good hit rate, though most of these publish only contact forms (2 of 4 had no email) |

### Saudi Arabia

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| **Milad-provided "Saudi_Architecture_Design_RealEstate_Deep_Verified_2026.xlsx" dossier** | 2026-08-12 | 1 | 76 (of 101 candidate rows; ~25 already in the CSV from earlier passes) | Milad supplied a pre-built ~101-row "Deep Verification" dossier with its own Website Health / Email Verification columns. Per instruction, every candidate not already on the CSV was independently re-verified with WebFetch rather than trusting the dossier's own labels. **Findings that diverged from the dossier's own claims:** `hamdanconsult.com`, `daralriyadh.com`, `madaya.sa`, `urec.com.sa`, `vater.sa`, `tegksa.com`, `aluladevelopment.com` had **no DNS record at all** (dead domains) despite the dossier marking most of them "ACTIVE/REACHABLE" or leaving them "Not independently fetched" — dropped. `almajaz.net` and `ajdan.com` loaded empty/unconfirmable content on independent fetch — dropped for insufficient verification. `kec.com.sa` (404), `soudah.sa` (403) — dropped. Conversely, several rows the dossier had marked "UNVERIFIED – FETCH PROBLEM" (`keoic.com`→redirects healthily to `keo.com`, `ruaalmadinah.com`, `pixarch.net`, `render-vision.com`, `7cgi.com`, `primeconsulting.sa`) turned out to be genuinely healthy on independent re-fetch and were kept, some with emails the dossier itself hadn't surfaced (e.g. `abdullah@7cgi.com`, `partner@render-vision.com`, `sale@maverickframe.com`). The dossier's "Diriyah Company" email was the literal obfuscation-artifact string `[email-protected]`, not a real address — company kept (site independently healthy) but no email written. `dargroup.com`/Dar Group was excluded — the dossier itself flags it as redirecting to Sidara post-rebrand. GulfRender excluded — dossier-confirmed account-suspended hosting page. 34 large global/regional firms (Foster+Partners, Zaha Hadid, Gensler, HOK, AECOM, Arup, WSP, JLL, CBRE, etc. with real KSA operations) were kept per the "large firms always include" policy, tagged `company_size=large` with negative-to-neutral `style_fit` (corporate mega-firms with their own in-house visualization capability). 8 arch-viz/CGI competitor studios (Render Atelier, Pixarch, VisEngine, Render Vision Studio, Maverick Frame, ArchiCGI, 7CGI) kept per the standing arch-viz-always-include policy. All emails MX-verified in one PowerShell batch before commit. |

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
| **`archinaut.ch` Top 100 Swiss offices** | 2026-08-12 | 2 | 49 | **Best-structured Tier 1 source found in any country.** 100 offices, each with city, and the list is *pre-banded by staff count* (Gross >50 / Mittel 10–50 / Klein <10) — so `company_size` comes from the source rather than inference. Second pass fetched the full 100-name list in one WebFetch, cross-referenced against existing 60 CSV rows, and ran a WebSearch contact sweep on the remaining ~55 free names, yielding 35 new firms (2 dropped — Leopold Banchini and rotative Studio — no confirmed live website/domain found). **List is now fully exhausted** for this CSV; any further Switzerland run needs a new source |
| Swiss Arc Award | 2026-08-03 (too early) | — | 0 | 2026 winners announced **29 Oct 2026**; the 42-project shortlist exists but isn't published as a readable list, and baunetz.de's coverage 403s. Revisit after the ceremony |
| Hochparterre / espazium.ch | 2026-08-12 | 1 | 0 | Tried espazium.ch/de/architektur (no firm names, only student/competition content) and hochparterre.ch via WebSearch/site: query (returned editorial articles mentioning firms in passing, not a browsable directory). Not a usable list source — treat as exhausted, don't retry directly, but individual firm names surfaced in its articles (e.g. "Wilde Karte" young-office features) are worth a follow-up WebSearch by name |
| SIA member register | 2026-08-12 | 1 | 0 | Confirmed too large/unstructured to browse; site-filtered searches (SIA Sektion Zürich etc.) return association-org pages, not member lists. Not a usable source |
| WebSearch harvest: young-office queries (Zurich/Basel/Lausanne/Geneva, "junges Büro gegründet") | 2026-08-12 | 1 | ~29 | Best replacement for archinaut.ch — targeted German/French queries for young/small firms per city surfaced well-known local firm names directly (KGRUPPE, Ferrara, PerroneSchneider, BGM, Haberstroh, Barcelo Baumann in Basel; Rocades, studio SML, STUDIO LKA, Fornet in Lausanne; Schaub Zwicky, C/O Architektur, lilin, Malte Kloes, Piazza Meier in Zurich; Sujets Objets, Cabinet, Coral Studio, Corpus in Geneva). Repeatable next round with different city/keyword combos |
| Prix Lignum 2024 winners | 2026-08-12 | 1 | 2 | National wood-architecture award; small yield but both recipients (Rolf Mühlethaler, RBCH architectes) were on-style solo/small practices. Next Prix Lignum cycle is 2027, so this is now exhausted until then |
| Swiss interior/retail design segment (dexigner directory, RTF Zurich top-30, hospitality searches) | 2026-08-12 | 1 | 7 | First real pass at Swiss Interior Design segment — Stephanie Kasel, Cornermoon, Studio Frey, Demivista, Rougemont Interiors, Studioforma, SU. Studio, swissCollab. Good yield, worth repeating for Basel/Geneva/Ticino interior studios not yet covered |

**Swiss-specific note:** practices overwhelmingly publish contact forms or
script-protected addresses rather than plain emails — of the 35 firms added
2026-08-12 (round 1), 25 had a plain-text email (all MX-verified) and 10 had only a
contact form/obfuscated address. Round 2 (2026-08-12, WebSearch harvest) found
29 of 36 new firms had a plain-text email (all MX-verified), better than
round 1's rate since architecture-directory/business-listing search results
surface emails directly. Expect roughly a 70-80% email rate on Swiss searches
and don't over-invest chasing the rest (§11 rule 1).

### Italy

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| `site:archello.com "best architecture firms in Italy"` (via WebSearch, direct fetch 403s as expected) | 2026-08-12 | 1 | 4 (NOA, Carola Vannini, Park Associati [dupe], Labics) | Search-index summary gave 4 names + one-line descriptions without needing a fetch; confirms the playbook's "search index has the content" workaround for Archello 403s |
| The Plan Award / In-Arch (`theplan.it`, `inarch.it`) | 2026-08-12 | 1 | 0 (all 5 already in file from a prior run) | 2025 winners fully mined already (facchinelli daboit saviane, zarcola, C&P, AMDL CIRCLE, Balance, FORM-A mention). 2026 IN/Architettura award is still in open-nomination phase (deadline was 15 June 2026, national winners announced 13 Nov 2026) — revisit after that date for a fresh batch |
| Elle Decor Italia Best of Interiors | 2026-08-12 | 1 | 0 | 2026 edition submissions only closed 15 Sept 2026; no public winner list yet. Revisit late 2026 |
| Salone del Mobile 2026 exhibitor coverage | 2026-08-12 | 1 | 0 | Only brand-name furniture manufacturers surfaced (Poliform, Flou, Lema…), not design/architecture studios; the full exhibitor list needs the paid/registered Salone portal, not open web search. Not a usable source for this catalog — skip next time unless a "young designers" sub-list (e.g. Salone Raritas curators) is targeted specifically |
| Native-language WebSearch: `"studio di architettura" <città>` per Turin/Florence/Naples/Bologna | 2026-08-12 | 1 | ~24 | **Best yield of the run**, confirming the playbook's non-English-search pattern. One query per city surfaced 5-8 small/solo studios each with name+city+often phone, e.g. Turin (Studio ALL ARCH, Studio MSA, CIVICO13, QBO), Florence (ZPSTUDIO, Studio Benaim, Operatre, P&M Palterer Medardi), Naples (M Architettura, FADD Architects, Ariaproject), Bologna (Stile Bottega, Dieni Studio, rossottanio, Studio Lenzi). Repeatable for Genoa, Venice, Verona, Palermo, Bari next round |
| `archdaily.com/office` browse via WebSearch | 2026-08-12 | 1 | 3 (2050+, Archiplanstudio, Studio Bocchi) | Small but clean yield — office pages give city + focus directly. Worth a second pass with different city-keyword combos (Venice, Turin, Genoa) |
| `archi-jobs.it` | not tried | 0 | — | Listed as a source to try this pass but not reached — deprioritized once the native-language city searches proved higher-yield; worth a try next Italy run for `hiring_viz` signal specifically |
| `professionearchitetto.it/lavoro/offerte/` | — | — | — | Confirmed still seasonally suspended per earlier note; resumes 31 Aug 2026 |

**Italy-specific note:** email rate was high — 24 of 26 new rows have a confirmed, MX-verified email (mostly `info@` on the firm's own domain), only Studio ALL ARCH and CIVICO13 came up phone-only after a follow-up fetch. One MX failure caught: `studiobenaim.it` resolves (SOA only, no MX record) so its email was cleared even though a plausible `info@studiobenaim.it` address was quoted in search snippets — a reminder that Layer 1 (provenance) passing doesn't guarantee Layer 3 (MX) passes. Milan is now well covered from a prior run; this pass deliberately targeted Turin/Florence/Naples/Bologna/Mantova/Parma/Pozzuoli/Bolzano to broaden city spread.

### Spain

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| Native-language WebSearch: `"estudio de arquitectura"`/`"estudio de interiorismo"` per city (Barcelona, Valencia, Sevilla, Bilbao, Málaga) | 2026-08-12 | 1 | ~20 direct names + led to the Barcelona/Sevilla listicles below | Best single-query yield again, as in Italy/Saudi. Barcelona and Valencia queries each surfaced 6-10 named studios directly in the snippet; Sevilla/Bilbao/Málaga combined query worked but city-specific single queries would likely do better next round |
| `barcelona.place/estudios-arquitectura/` (found via native-language search, fetched directly) | 2026-08-12 | 1 | 30 names | Single-page listicle, no site 403 — fetched clean, gave name + occasional URL. Best Tier-1-style yield of the run; revisit for other Catalan cities (Girona, Tarragona) |
| `nanarquitectura.com` Sevilla listicle (found via native-language search, fetched directly) | 2026-08-12 | 1 | 15 names | Clean fetch, no URLs but names + "nanarquitectura.com" source; contact sweep found ~8/15 emails. Same site likely has Málaga/Bilbao equivalents — try `nanarquitectura.com` + city search next round |
| `site:archello.com "best architecture firms in Spain"` | 2026-08-12 | 1 | 0 new | Search index only surfaced already-known large/famous names (IDOM, Fran Silvestre, Pich Architects — the latter two already covered independently); no incremental yield this pass |
| Premios COAM 2025 / CSCAE Premios ARQUITECTURA 2025 finalists | 2026-08-12 | 1 | 0 new | Finalist list names were large/established practices (aldayjover, Nieto Sobejano, estudioHerreros, Linazasoro) already globally known or too big to add value; skip repeating this specific award unless a regional/young-architect sub-category is found |
| Premios FAD de Arquitectura e Interiorismo 2025 | 2026-08-12 | 1 | 0 new (not mined further) | Confirmed 31 finalists exist but individual studio names weren't in the search snippet — would need a follow-up fetch of `fad.cat`/`arquinfad.org` finalist page directly; worth trying next round, not reached this pass |
| `estudio arquitectura Bilbao contratando visualizador 3D` (hiring signal) | 2026-08-12 | 1 | 0 (only 3D-render vendor studios surfaced, no job postings) | Confirms the playbook's warning on hiring-board searches for smaller markets — Bilbao 3D-render companies (Domingo Loro, Renders.studio, LookRender, Bilbao3D) came up instead of hiring architecture firms; not pursued as leads since they're anonymous small render shops with thin verification, deprioritize for now |
| `promotora inmobiliaria España nuevo proyecto residencial 2026` (developer signal) | 2026-08-12 | 1 | 2 (Aedas Homes, Culmia, via Brains RE ranking) | brainsre.news ranking article named the top Spanish developers by homes-started 2026; both already large but confirmed `new_project` signal and MX-verified emails. Worth revisiting the same ranking for mid-tier developers further down the list (Habitat Inmobiliaria, Vía Célere already in file) |

**Spain-specific note:** email rate was roughly 55% (22 of 40 new rows have a confirmed MX-verified email) — noticeably lower than Italy's ~90%, because business-directory search snippets (Houzz, Empresite, RocketReach) dominate results for small Spanish studios and don't quote a usable address; several studios only expose a contact form. Two emails were rejected for domain mismatch (Nook Architects' gmail.com address, Mag-arquitectura's personal gmail) per playbook §6 Layer 2. Madrid itself was intentionally light-touch this round since Armila Design is based there — no Madrid architecture studios were added, only interior design studios and large developers, to avoid over-mining Armila's own backyard for direct peers.

### Germany

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| Native-language WebSearch: `"Innenarchitektur Studio" <Stadt>` / `"Architekturbüro" <Stadt> kleines Büro` per city (Hamburg, Köln, Leipzig, Frankfurt, Düsseldorf, München, Stuttgart) | 2026-08-15 | 1 | ~29 | Best single pattern of the run again, matching Italy/Spain — each city query surfaced 4-8 small/solo studios directly in the snippet, most with a plausible domain and often an address. Leipzig and Düsseldorf were especially rich (6 studios each). Berlin, Munich and Frankfurt architecture itself already heavily covered from prior manual-list runs, so this pass deliberately targeted interior design and the secondary cities |
| BDA Preis Bayern 2025 shortlist (`bda-bayern.de`, coverage via `md-mag.com`) | 2026-08-15 | 1 | 0 | Confirmed 24 projects shortlisted (108 submitted) but the coverage article text doesn't name the firms — only links to the primary `bda-preis-bayern.de` shortlist page, which wasn't fetched this round. Worth a direct fetch of `bda-preis-bayern.de`'s shortlist page next time; the BDA Land-chapter award pattern (like RIBA regional) is still untested for Germany |
| German Design Award 2026 interior/architecture categories | 2026-08-15 | 1 | 0 | Gallery is described as still mid-launch with only 2025/2026 winners visible and no comprehensive interior list surfaced via search; revisit once the full gallery populates |
| `Immobilienentwickler`/`Projektentwickler` + city (Berlin) native-language search | 2026-08-15 | 1 | 4 | Direct developer names with contact info in snippets (Terra Immobilien, Zauner Developments, PRIMUS Immobilien, PBI Berlin) — small-to-medium Berlin developers, no fetch needed. Worth repeating per-city (Munich, Hamburg, Frankfurt) next round since developers are historically under-represented |
| `competitionline.com/de/jobs` | confirmed dead again | — | 0 | Still JS-rendered, header only — do not retry |
| `baunetz.de/stellenmarkt/`, state Architektenkammer boards | not tried this round | 0 | — | Still untested; hiring-board searches have been dead ends in nearly every country this project has tried, deprioritized in favor of the higher-yield native-language pattern |

**Germany-specific note:** MX pass rate was 100% on domains that had a plausible email at all — every email quoted in a search snippet resolved with a valid MX record. About 17% of new rows (5 of 29) have no email because the snippet only surfaced a phone/address (H&L Architekten Leipzig, Adlich & Fliedner, AS Architektur Studio, Studio Simon Bauer/SIBA, Anna Wollenberg) — per playbook these were left blank rather than chased with a follow-up fetch, since none showed a signal that would justify a deep pass. Segment mix skewed toward Interior Design (11) and Architecture (14) this round with 4 Real Estate developers added to start closing that historic gap; no arch-viz/CGI studios or hiring signals surfaced this pass. Next-best source to try: BDA Land-chapter award pages fetched directly (Bayern, NRW, Berlin chapters each publish their own shortlist), and per-city developer searches for Munich/Hamburg/Frankfurt.

| Source | Last used | Times | Firms yielded | Notes |
|---|---|---|---|---|
| `bda-preis-bayern.de` direct fetch (BDA Preis Bayern 2025 shortlist) | 2026-08-17 | 1 | 0 | Confirmed dead end as flagged: fetched the site directly this round, page states "16 Projekte wurden ausgezeichnet" but the actual shortlist/firm names are behind a separate nav link not reachable via WebFetch text extraction. Do not retry this exact URL; if pursued again, would need the specific shortlist sub-page URL, not the homepage. |
| `Immobilienentwickler`/`Projektentwickler` + city native-language search (Munich, Hamburg, Frankfurt) | 2026-08-17 | 1 | 9 | Repeated the Berlin-round pattern across three more cities: 3 Munich developers (Garche 3, Meine-Immoentwickler, Eckart Immobilien), 4 Hamburg (Deutsche Immobilien Entwicklungs, ICON Immobilien, projektwerke hamburg, MAAMCO), 2 Frankfurt (OFB Projektentwicklung, imova) plus CILON GmbH also Frankfurt. Confirms this is a reliable, repeatable per-city pattern — worth running again for Cologne/Stuttgart/Düsseldorf next round. |
| Native-language WebSearch: `"Innenarchitektur Studio"` / `"Architekturbüro" ... kleines Büro` per city (Nuremberg, Dresden, Hanover, Bremen, Essen) | 2026-08-17 | 1 | 20 | Same pattern, five new cities. Nuremberg (5, mostly solo interior studios) and Dresden (6, mostly solo/small architecture) were richest; Essen yielded 4 interior studios via one query. Hanover and Bremen were thinner (4 and 2) — smaller markets, fewer boutique studios surfacing in top results. |
| German Design Award interior/architecture categories | not retried this round | 0 | — | Deprioritized again in favor of the higher-yield native-language and developer patterns; still worth a check once gallery is confirmed fully populated. |

**Germany round 2 note:** 32 new rows added (90 → 122 against a 250 quota). Segment mix: 9 Real Estate developers, 14 Interior Design, 9 Architecture. Size mix: mostly solo/small (28 of 32), 1 medium (OFB Projektentwicklung). Signals: no_inhouse tagged on most solo/small studios, new_project on 6 of the 9 developers, active_social on 1. Rejected: Bauwerk Hamburg (Projektentwicklung Hamburg developer — no email surfaced anywhere, only a contact-form link, dropped per playbook rather than guess); Stadtblick Architekten Hamburg (only email found was `stefan.scholz@mmst-architekten.de`, a domain mismatch vs. the firm's own `stadtblick-architekten.de` — dropped per Layer 2 domain-mismatch rule); Architekten Kunze Reisnecker, KANANI Innenarchitektur, and Meine-Immoentwickler GmbH kept but with blank email (no address surfaced in search or a direct Impressum fetch). Next-best source for round 3: repeat the Immobilienentwickler/Projektentwickler pattern for Cologne, Stuttgart, Düsseldorf (all untested for developers so far), and try BDA Land-chapter pages for NRW/Berlin directly rather than Bayern again.

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
| 🇴🇲 Oman | `omanyp.com` | **Name + city + phone from category pages; website + address from company pages** | Milad's find, fetch-tested 2026-08-08. See the dedicated section below — this is the first complete *national register* in the catalogue, and the pattern generalises |

## 🇴🇲 OmanYP — how to work it

Oman was previously recorded as a market with no practice-level awards and no
browsable registry. `omanyp.com` closes that gap, and it is worth documenting
in full because **the same site runs national editions elsewhere**
(`/international-business-directories-map`) — if the pattern holds, this
unlocks the whole GCC.

**URL shapes** (all fetch-tested, no 403):

- Category index — `omanyp.com/browse-business-directory`
- Listing page — `omanyp.com/category/<Underscored_Name>` → 20 companies, each
  with **name + city + phone**
- Pagination — `omanyp.com/category/<Underscored_Name>/2` ← path segment, **not**
  `?page=2`. The query-string form silently re-serves page 1, so a run that used
  it would harvest the same 20 names repeatedly and look like the category was
  exhausted
- Company page — `omanyp.com/company/<id>/<Name>` → **website + full address**,
  and sometimes a real email

**Relevant categories and depth:**

| Category | Path | Pages |
|---|---|---|
| Architectural Services | `/category/Architectural_services` | 5 (~100 firms) |
| Interior Design | `/category/Interior_design` | not yet counted |
| Property Development | `/category/Property_development` | not yet counted |
| Civil Engineering | `/category/Civil_engineering` | not yet counted |
| Engineers / Engineering | `/category/Engineers`, `/category/Engineering` | not yet counted |
| Estate Agents / Realtors / Property Consultants | `/category/Estate_agents`, `/category/Realtors`, `/category/Property_consultants` | not yet counted |
| Construction / Construction Services | `/category/Construction`, `/category/Construction_services` | not yet counted |

**The directory splits into two eras, and this decides the whole run.** The
legacy records — low company IDs (roughly under 13000), all showing "registered
with us on 24/28 Aug 2012" — carry **phone and PO box only**. No website, no
email. Ten detail-page fetches of these in a row returned nothing usable. The
recent high-ID listings do publish a site (Kate Kerdi 16432, Visiondcs 16840,
Al Balushi 16327). **Read the company ID off the listing href before spending a
fetch** — a low ID is almost always a wasted call.

For the legacy names the directory is still worth having, but only as a
*name source*: search each firm individually and their own site usually turns
up. That route found Muamir, Quad Design, Nadan, Al Hatmy, Triad Oman, EARC
Sabla, Bunyan and Raaz Design — none of which OmanYP itself linked.

**Two records are stale**, so verify before writing: Huckle & Partners was
acquired by t2o engineers in 2022 and now trades as Huckle Design, and "Real
Visions Interiors – Oman" is the same firm as RVI Architects.

**Emails are obfuscated on most company pages** — they render as
`[email protected]`, the standard anti-scrape mask. Some pages leak the real
one (GMap LLC gave `sales@gmapoman.com` in clear). Treat a masked address as
absent and get the email from the company's **own** site instead — the site URL
is the thing OmanYP reliably provides, and that is what makes it useful.

**Run shape — 2 calls per written row, after a free harvest:**

1. Harvest category pages (1 fetch = 20 names + cities + phones)
2. Company page for the ones worth keeping → website (1 fetch)
3. Their own site → email (1 fetch)
4. MX batch as usual

**Filter hard at step 2.** The categories are broad and mix genuine design
practices with trading and contracting companies — the Architectural Services
page alone carried Ramesh Khimji Group, Ahmed Mohsin Trading and Dalma Steel
Works. Names to prefer are the ones reading as design practices: Zawaya, Quad
Design, MME Design Solutions, Architecture House, Architecture & Design
Consultants, Al Jazeera Engineering Consultancy (Architects & Planners).

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
| 🇦🇹 Austria | ✅ **`nextroom.at` confirmed working** — fetches directly and lists ~19 offices with cities on the homepage alone, skewed to small and solo practices. Curated rather than exhaustive, so the homepage rotates; re-fetch on later runs to surface different offices. The one Austrian source that isn't blocked |
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
