# Lead Hunting Playbook

The operating manual for `/hunt`. Read this before every run — it says which
segments to hunt, which sources actually work, how a candidate gets verified,
and what disqualifies one.

`.claude/commands/hunt.md` is the trigger; this file is the method.

**Goal:** 3,000 verified companies as the first milestone, 6,000+ after that.
One file per country in `leads/<country>.csv`, appended to on every run, never
rewritten from scratch.

---

## 1. What we're hunting — the segments

Not just architecture studios. Every segment below commissions imagery. They're
ordered by `NEED_BY_SEGMENT` in `backend/app/services/scoring.py`, so this list
and the app's ranking agree.

| Segment | Need pts | Why they buy renders | `industry` value |
|---|---|---|---|
| **Real estate developer** | 22 | Every launch needs marketing imagery, and the budget sits in the marketing line — not squeezed out of a project fee. **Highest-value segment.** | `Real Estate` |
| Architecture studio | 20 | Competitions, planning submissions, client presentations, press | `Architecture` |
| Interior design studio | 19 | Concept boards, FF&E presentations, client sign-off | `Interior Design` |
| Hospitality group | 18 | Hotel and F&B rollouts, brand standards decks | `Real Estate` |
| Retail brand rollout | 17 | Store concepts replicated across many sites | `Real Estate` |
| Property marketing agency | 16 | They resell imagery to developers — repeat volume | `Real Estate` |
| Urban planning / masterplanning | 16 | Aerials, phasing diagrams, public consultation boards | `Architecture` |
| Landscape architecture | 15 | Planting and public-realm visuals | `Architecture` |
| Construction contractor | 13 | Design-build tenders need imagery to win | `Construction` |
| Exhibition & set design | 12 | Stand concepts with hard fair deadlines | `Architecture` |
| Furniture / product brand | 12 | Product-in-context lifestyle imagery | `Real Estate` |
| Facade & engineering consultant | 11 | Detail and system visuals | `Construction` |
| Animation studio | 10 | Overflow partner for motion work | `Animation` |
| **Arch-viz / CGI studio** | 9 | **Competitor first**, overflow partner second. Real work comes from them, but rarely and at a lower rate. Hunt sparingly. | `CGI` / `Visualization` |

**Practical mix per run:** roughly 40% architecture, 25% developers/real estate,
20% interior design, 15% everything else. Developers are underweighted in most
lead lists precisely because they're harder to find — that's the edge.

---

## 2. Source catalog — ordered by actual yield

Yield tiers come from measured results, not theory. Tier 1 sources return
**25–200 named companies from a single page**; Tier 4 returns one at a time.

### Tier 1 — Curated listicles (highest yield per search)

The single best discovery pattern found. One page names 25–220 firms.

| Source | Pattern | Yield |
|---|---|---|
| **Archello country/city lists** | `site:archello.com "best architecture firms in <country>"` — also `<city>`, and `2026` variants | 25–100/page |
| **Archello global list** | `archello.com/news/100-best-architecture-firms-in-the-world` | 100 |
| **Architizer A+List** | `architizer.com` "A+List" / "firms to watch" — 220+ firms | 220 |
| **Archello "50 best in the United States"** | same pattern, per-country | 50 |
| **archisoup city lists** | `site:archisoup.com "architecture firms in <city>"` — confirmed fetchable directly, gives name + address + website per firm, no verification step needed for those fields. Covers most major US/UK cities (Austin, Boston, Chicago, Philadelphia, LA…) | 14–20/page |
| **Design Middle East / Middle East Architect power lists** | annual "top firms" features | 20–50 |
| **Construction Week "top developers to watch"** | Gulf developers, annual | 10–30 |

⚠️ Archello and Architizer pages **403 on direct fetch** — get the names via
`WebSearch` (the search index has the content), then verify each firm on its
own site. **archisoup fetches fine directly** and already gives address +
website, so it only needs a light verification pass (email, size, signals).

### Tier 2 — Registries & association directories

Verified, complete, and almost nobody mines them for outreach.

| Country | Source | Access |
|---|---|---|
| UK | `find-an-architect.architecture.com/practices/search` — 4,100+ chartered practices | ✅ fetchable |
| UK | `arb.org.uk` register | ✅ |
| UK interiors | BIID member directory | via search |
| US | AIA firm directory · `designfinder.asid.org` (ASID) · `iida.org/memberships/directory` | ⚠️ 403 direct → use `site:` search |
| Australia | `members.architecture.com.au/FindAnArchitect` | ⚠️ 403 direct → use `site:` search |
| Canada | RAIC directory | via search |
| Germany | `bda-bund.de` · `bak.de` state chambers | via search |
| Netherlands | `bna.nl` — ~1,000 bureaus | via search |
| Denmark/Sweden/Norway/Finland | `danskeark.dk` · `arkitekt.se` · `arkitektur.no` · `safa.fi` | via search |
| Switzerland | SIA (`sia.ch`) — ~15,000 members | via search |
| Spain | `cscae.com` · `coam.org` | via search |
| France | `architectes.org` annuaire | via search |
| Italy | `awn.it` + provincial ordine | via search |
| **UAE** | **Dubai Municipality registered consultancy offices — published as PDF databases** at `dm.gov.ae/municipality-business/consultants-contractors-and-suppliers-data/` | ✅ PDF |
| Saudi | Saudi Council of Engineers | via search |
| Qatar | UPDA registry | via search |

### Tier 3 — Awards & competition shortlists

Pre-qualified: they just won something and need press images **now**
(`recent_award` = 6 timing pts).

`worldarchitecturefestival.com` · `dezeen.com/awards` · `architizer.com/awards` ·
`miesarch.com` · `architecture.com` (RIBA national + **regional** awards) ·
`aia.org` · Archello Awards · Design Middle East Awards (KSA + Architecture
Leaders) · national prizes (Kasper Salin SE, Nykredit DK, Finn Juhl DK)

**RIBA regional awards are unusually good** — they surface genuinely small
practices that national awards never reach. Proven: 9 of the first 9 UK leads.

### Tier 4 — Hiring signals (highest intent, lowest volume)

`hiring_viz` is worth 9 timing pts + 6 outsourcing pts — the strongest single
signal in the model. But volume is low and most postings are from recruiters or
large firms, so budget one search, not five.

`archinect.com/jobs` · `dezeenjobs.com` · `cgarchitect.com` · LinkedIn Jobs ·
Bayt/GulfTalent (Gulf) · Glassdoor/Indeed (filter out agencies)

⚠️ `dezeenjobs.com` and `archinect.com/jobs` **403 on direct fetch** — reach them
through search results instead.

### Tier 5 — Publications & project features

One firm at a time, but excellent for style-fit judgement and fresh
`new_project` signals.

`archdaily.com/office` (browsable A–Z, several thousand offices) · `dezeen.com` ·
`designboom.com` · `divisare.com` · `world-architects.com` · `frameweb.com`

### Tier 6 — General web search & Google Maps (city-level coverage)

For the small studios no publication or registry ever lists — the long tail
inside one city.

- **General web search** — `WebSearch` itself already behaves as a general
  search engine and is the workhorse for everything above. For a specific city
  with no listicle available, a plain query works: `"architecture studio
  <city>"`, `"interior design studio <city>"`. It surfaces exactly this mix:
  firm sites, local directories, and — critically — listicle articles like
  archisoup's (Tier 1) that the more targeted `site:` queries miss because the
  city wasn't known to have one yet.
- **Google Maps — tested, does not work directly.** `WebFetch` on any
  `google.com/maps/search/...` URL redirects to a `consent.google.com` wall and
  returns nothing usable. Do not spend a call on it.
  **The working substitute:** a plain city + segment `WebSearch` query surfaces
  the same local businesses that Maps would — via directory pages, "near me"
  aggregators, and local listicles — because Google's own general index and
  Maps draw from the same business listings. Treat "search Google Maps for a
  city" as "run a plain city-level WebSearch", not as a literal Maps fetch.
- **Houzz, Clutch, DesignRush, GoodFirms** — filterable by city, though most
  403 on direct fetch like the award directories; reach via `site:` search.

### Tier 7 — Fairs, developers & tenders

Everyone on an exhibitor list has a committed marketing budget and a date.

`thebig5.ae` · `cityscapeglobal.com` (Riyadh, Nov) · `mipim.com` · `exporeal.net` ·
`salonemilano.it` · `downtowndesign.com` · MEED/tender portals ·
`bayut.com`/`propertyfinder.ae` new-launch roundups (Gulf developers) ·
`crunchbase.com` real-estate hubs

---

## 3. The search patterns that actually work

Ranked by companies-returned-per-search:

1. **`site:` + listicle** — `site:archello.com "best architecture firms in Germany"`
2. **`site:` + registry** — `site:bna.nl bureau Amsterdam`
3. **Award + year + region** — `RIBA North West Awards 2026 winners shortlist`
4. **Segment + city + signal** — `boutique developer Dubai new launch 2026`
5. **Native language** — `arkitektkontor Oslo`, `Architekturbüro München`,
   `despacho de arquitectura Madrid`. Reaches firms that never appear in English
   results. Use for DE/FR/IT/ES/NL/Nordics.

**Always fire 4 searches in parallel**, across *different* source tiers — never
four variations of one query.

---

## 4. Filters — what gets rejected

A candidate must clear every gate below. Roughly half of what search returns
gets cut here, and that's the point.

### Hard rejects (never written to file)
- **Site won't open / domain doesn't resolve** — can't confirm it exists
- **No verifiable name** — a directory stub with no real company behind it
- **Recruiters, job boards, aggregators, SEO listicle farms** — not real firms
- **Already in the country file** — checked by name *and* domain before writing
- **Invented anything** — if the email isn't published, the cell stays empty.
  An invented address burns the sending domain's reputation, which costs far
  more than a missing row.

### Soft rejects (deprioritise, only include if the run is short)
- **100+ people with a named in-house visualisation team** — slow, hard sale
  (`large` = 9 outsourcing pts vs `small` = 20)
- **Arch-viz studios** — competitor, 9 need pts
- **Tier-5 market with no signal** — 8 market pts caps the total too low
- **Household names** (Foster, BIG, Zaha, Gensler) — already in everyone's CRM

### Prefer
- 3–20 people, no in-house 3D → the single heaviest scoring factor
- Any timing signal — hiring > new project ≈ award > exhibiting > funding
- A named person's email over `info@` (9 vs 7 reach pts)
- The long tail over the famous

---

## 5. How company data is actually obtained

Fixed pipeline. Step 2 is the real cost and the real quality gate.

**Step 1 — Discover (cheap, parallel).**
4 `WebSearch` calls at once across different source tiers. Collect names +
whatever URL is offered. Nothing is trusted yet.

**Step 2 — Verify on the company's own site (the gate).**
`WebFetch` the firm's own domain — never a directory page as the source of
truth. Company sites are almost never bot-blocked, unlike the directories that
list them. Extract:
- **Email** — homepage first, then `/contact`, `/kontakt`, `/contact-us`,
  `/kontakt-oss`, `/contacto`. Prefer a named person over a shared inbox.
- **Phone, city, country**
- **Team size** — count the `/team` or `/people` page if it exists; otherwise
  infer from language ("two-partner studio", "founded by"). Say `solo`/`small`/
  `medium`/`large`, never guess a precise headcount.
- **Segment** → the `industry` value from §1
- **Signals** — only with evidence actually read on a page
- **Style fit** (−8…+8) — how close their work is to Armila's minimalist
  Scandinavian / warm-minimal register, and whether better renders would
  visibly help. `0` if the site doesn't show enough to judge.
- **Social** — only links found on their own site

**Common redirect traps:** `.ae → .com`, `www → apex`, and old brand domains
(`snorrestinessen.com → bystinessen.com`). Follow the redirect and record the
final URL.

**Step 3 — Validate the email domain (see §6).**

**Step 4 — Dedupe, then append** to `leads/<country>.csv`.

---

## 6. Email & data verification

Yes — verification runs on every row, in three layers.

**Layer 1 — Provenance.** The address must have been *read on the company's own
site*. An address that only appeared in a search snippet, a data-broker page
(RocketReach, Lusha, ZoomInfo), or a directory listing is **not** accepted —
those are frequently stale or fabricated. If it can't be confirmed on their own
site, the cell stays empty.

**Layer 2 — Syntax + pattern.** Must contain `@`, a plausible TLD, and a domain
that matches the company's own website. `info@somethingelse.com` on a firm whose
site is `firm.co.uk` is a red flag → drop it.

**Layer 3 — DNS/MX check.** The domain must actually accept mail:

```bash
Resolve-DnsName -Name example.com -Type MX
```

Verified working — real domains return their mail host
(`…mail.protection.outlook.com`, `…aspmx.l.google.com`); dead domains return
nothing. Run it in one batch over the run's new rows before committing. A row
whose domain has **no MX record** gets its email cleared, because sending there
produces a hard bounce and hard bounces damage the sending domain.

**What is *not* verified:** whether the specific mailbox exists. That needs SMTP
probing or a paid service (ZeroBounce, NeverBounce). Given every address is
taken from the company's own published contact page, mailbox-level risk is low —
but a first send to a fresh country file should be a small warm-up batch, not
all 300 at once.

**Signal evidence.** Every `signals` key needs a fact in the `evidence` column
that was actually read — "won RIBA South East Award 2026 for Casa Bassa", not
"seems active". Unsupported signals inflate the score and poison the ranking.

---

## 7. Anti-duplication

Three layers, because a duplicate wastes an unlock credit on the user's side:

1. **Before searching** — read `leads/<country>.csv`, hold its names + domains.
2. **Before writing** — match each candidate on normalised name *and* domain.
3. **On import** — `import_csv` skips by name (`ilike`) and domain anyway.

Never rely on layer 3 alone.

---

## 8. Output contract

One file per country: `leads/<country>.csv`, lowercase kebab-case
(`united-kingdom.csv`, `saudi-arabia.csv`, `uae.csv`, `usa.csv`).

Header, exactly:

```
name,website,email,phone,country,city,industry,company_size,linkedin,instagram,tags,signals,style_fit,evidence,source
```

- `company_size` — `solo` (1–2) · `small` (3–20) · `medium` (21–100) · `large` (100+)
- `signals` — semicolon-separated, only evidenced: `hiring_viz`, `recent_award`,
  `new_project`, `exhibiting`, `funding`, `dated_visuals`, `no_inhouse`,
  `active_social`
- `style_fit` — −8…8
- Quote any field containing a comma.

**Append only.** Existing rows are never rewritten by a later run.

---

## 9. Country priority & quotas

Value = market rate × addressable pool × reachability. Market rate alone is
misleading: the US pays 13/17 but has ~19,000–27,000 architecture firms (75%
under 10 people), while Qatar pays 17/17 with a pool near 350.

| Tier | Countries | Quota each |
|---|---|---|
| **S** | 🇺🇸 USA **500** · 🇦🇪 UAE **350** · 🇬🇧 UK **350** · 🇸🇦 Saudi Arabia **300** | — |
| **A** | 🇩🇪 Germany 250 · 🇦🇺 Australia 200 · 🇨🇦 Canada 180 · 🇨🇭 Switzerland 150 · 🇳🇱 Netherlands 150 | — |
| **B** | 🇸🇪 🇩🇰 120 · 🇳🇴 🇶🇦 100 · 🇮🇪 🇫🇮 🇦🇹 🇧🇪 80 · 🇰🇼 60 | — |
| **C** | 🇫🇷 🇮🇹 120 · 🇪🇸 100 · 🇸🇬 🇵🇹 🇧🇭 🇴🇲 🇳🇿 🇯🇵 🇰🇷 40–60 | — |
| **D** | 🇵🇱 🇨🇿 🇹🇷 🇬🇷 🇮🇱 🇲🇽 🇧🇷 … | opportunistic |

Milestones: **M1** 1,500 (Tier S) → **M2** 2,430 (+A) → **M3** 3,250 (+B, first
goal cleared) → **M4** ~3,850 (+C) → **M5** 6,000+.

Quotas are ceilings per pass, not per project — a country can be revisited.

---

## 10. Per-run checklist

1. Pick the country (or take the one requested).
2. Read `leads/<country>.csv` → hold existing names + domains.
3. Fire 4 parallel searches across **different** source tiers (§2), leading with
   Tier 1 listicles for a fresh country.
4. Verify each candidate on its **own** site (§5).
5. MX-check every new email in one batch (§6).
6. Dedupe (§7), append, validate the file parses.
7. Report: count, segment mix, signal mix, and **what was rejected and why**.
8. Commit and push.

**Expected yield:** 20–25 verified companies per run from award/publication
sources; 35–45 when leading with Tier 1 listicles on a fresh country.
