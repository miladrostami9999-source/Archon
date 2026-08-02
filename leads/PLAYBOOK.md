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

**Which specific sources to use this run comes from `leads/SOURCE_LEDGER.md`,
not from memory or habit.** With ~35 sources across 7 tiers, defaulting to
whichever 2–3 are easiest to remember (archisoup, plain WebSearch) means most
of this catalog never gets touched and the segment mix skews hard toward
whatever those sources happen to cover. The ledger tracks what's been tried
per country and picks the longest-idle sources — read it before searching, and
update it after. It also has the segment-specific Tier 1 sources for
developers and interior design that fix the architecture skew below.

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

⚠️ `dezeenjobs.com` and `archinect.com/jobs` **403 on direct fetch**, and generic
search on them only returns aggregator listicles (Glassdoor/ZipRecruiter counts)
rather than individual postings.

**Use the country's own job board instead.** This is the fix for what looked
like a dead signal: `architectureau.com/jobs` (Australia),
`azuremagazine.com/jobs` (Canada), `arkitektforeningen.dk/jobbors` (Denmark) and
`arkitektur.no/ledige-stillinger` (Norway) all fetch directly and name the
hiring practice and city in plain text. Every country has one — the full
verified list, with what's blocked and what's untested, is in
**`leads/SOURCE_LEDGER.md` → "Local-market sources by country"**. Check there
before writing off `hiring_viz` for any market.

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

### Don't filter by size — score does that job

**Large firms are not excluded.** `scoring.py` already penalises them
correctly (`large` = 9 outsourcing pts vs `small` = 20 — an 11-point hit out of
100) — that's the whole point of the scoring rewrite. Rejecting a 200-person
regional firm before even fetching its site throws away information for free:
the name and domain already cost nothing (they came from a listicle), and one
light-tier fetch (§5) is all it takes to log it with an honest `company_size`
and let the app rank it where it belongs. A regional office of a large firm
might genuinely have no in-house 3D team, or a specific department worth a
targeted pitch — that possibility is worth a single fetch, not a guess.

**The only names to skip outright** — because they add zero information (every
studio on earth already has them in a CRM and has already tried and failed to
sell to them, not because of size):

> Foster + Partners, Zaha Hadid Architects, BIG, Gensler, Skidmore Owings &
> Merrill (SOM), HOK, Perkins&Will, AECOM, KPF, Populous, NBBJ, Stantec, Jacobs

Extend this list only when a firm is *globally* iconic, not merely large. A
150-person regional practice nobody outside its city has heard of is not on
this list, however large — it goes in the file with `company_size=large`.

**Two more soft-deprioritise cases** (still include, just expect a lower
score):
- **Arch-viz studios** — competitor first, 9 need pts
- **Tier-D market with no signal** (§9) — 8 market pts caps the total too low
  to matter much, but a strong signal can still lift it

### Prefer
- 3–20 people, no in-house 3D → the single heaviest scoring factor
- Any timing signal — hiring > new project ≈ award > exhibiting > funding
- A named person's email over `info@` (9 vs 7 reach pts)
- The long tail over the famous

---

## 5. How company data is actually obtained

Fixed pipeline. Step 2 is the real cost and the real quality gate — and it now
runs at **two speeds**, chosen per candidate, not one fixed depth for everyone.

**Step 1 — Discover (cheap, parallel).**
4 `WebSearch` calls at once across different source tiers. Collect names +
whatever URL is offered. Take the **exact URL the search result gives** —
never reconstruct one from the name (`https://www.` + slug + `.com`). Guessed
URLs are the single biggest cause of wasted fetches (wrong subdomain, wrong
TLD, cert mismatches on a domain that isn't actually theirs) — every ENOTFOUND
and cert error logged in past runs traced back to a guessed URL, never to one
copied from search output.

**Step 2 — Verify on the company's own site (the gate).**
`WebFetch` the firm's own domain — never a directory page as the source of
truth. Company sites are almost never bot-blocked, unlike the directories that
list them.

**Choose the depth per candidate:**

- **Light pass (default — one fetch, no follow-up)** for everything, and *all*
  of the never-exclude-by-size cases (§4): large/famous-but-not-mega-brand
  firms, medium firms with no obvious signal yet. One `WebFetch` on the
  homepage, prompted to extract email + city + any team-size mention in the
  same call. If the email isn't on the homepage, **leave it blank — don't
  chase `/contact` for this tier.** If the fetch itself fails (403, cert error,
  connection refused, 503), **try once more, then drop it** — a second
  failure means the site is genuinely unreachable this pass, not that a
  directory listing was wrong.
- **Deep pass (2–3 fetches)** reserved for candidates that already show a
  Tier 1–4 signal (hiring/award/new project/exhibiting) or look `solo`/`small`
  on the light pass — these are exactly the rows where extra data actually
  moves the score. Follow up with `/contact`, `/team` or `/people`, and a
  news/projects page for `style_fit` evidence.

This is the lever that matters most: the light pass turns "I have a name and a
domain from a listicle" into a real row for close to zero extra cost, so
nothing found gets thrown away for being large — it just costs one fetch
instead of three.

**Ask for compact output, not prose.** A `WebFetch`/`WebSearch` prompt like "what
is this company, team size, email..." returns a 150–300 token paragraph that
mostly restates the question. Ask instead for exactly the fields needed, in a
fixed short format:

> `Reply in this exact format, no prose: EMAIL=... PHONE=... SIZE=solo/small/
> medium/large SIGNAL=<one fact or none>`

Same information, a fraction of the tokens — and every one of those tokens sits
in context for the rest of the run, so the saving compounds across a session.

**On the light pass, still record what's available:**
- **Email** — only if visible without navigating. Prefer a named person.
- **Phone, city, country**
- **Team size** — a `/team` count if the *same page* shows it; otherwise infer
  from language ("two-partner studio", office count, "150+ professionals
  across four offices") and say so in `evidence`. Say `solo`/`small`/`medium`/
  `large`, never a precise guessed headcount.
- **Segment** → the `industry` value from §1
- **Signals** — only with evidence actually read on a page
- **Style fit** (−8…+8) — `0` if the site doesn't show enough to judge (which
  is expected and fine on a light pass)
- **Social** — only links found on their own site

**Common redirect traps:** `.ae → .com`, `www → apex`, old brand domains
(`snorrestinessen.com → bystinessen.com`), and **acquisitions** — a redirect to
a completely different domain (`dyerbrown.com → corgan.com/dyerbrown`,
`tria.design → hfa-ae.com`) means the firm has been absorbed into a larger one.
That's still a valid row (`company_size=large`, note the acquisition in
`evidence`) — the redirect target *is* the verification that the entity is
real, just no longer independent.

**Step 3 — Validate the email domain (see §6).**

**Step 4 — Dedupe, then append** to `leads/<country>.csv`.

---

## 6. Email & data verification

Yes — verification runs on every row, in three layers.

**Layer 1 — Provenance.** The address must originate from **the company's own
domain**. What matters is *which page it came from*, not who fetched it:

- ✅ **Accept** — read on their site by `WebFetch`, **or** quoted in a
  `WebSearch` result whose source URL is their own domain (the search index is
  quoting the same contact page a fetch would return, so there's no extra
  staleness risk). This is the normal case and needs no follow-up fetch.
- ⛔ **Reject** — data-broker pages (RocketReach, Lusha, ZoomInfo, ContactOut,
  SignalHire, prospeo, getprospect). These publish *guessed* address patterns
  (`{first}@domain`) presented as fact. An invented email costs more than a
  missing one.
- ⚠️ **Third-party directories** (Houzz, Yell, Clutch, chamber listings) — treat
  as a lead, not a source. Fine for finding the domain; confirm the address on
  the company's own domain before writing it.

Redacted snippets (`[email protected]`) carry no information — treat as absent
and either fetch the page or leave the cell empty.

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

**Run this to §11's four-phase shape — the target is 25–40 rows.**

1. Pick the country (or take the one requested).
2. Read `leads/<country>.csv` → hold existing names + domains.
3. Read `leads/SOURCE_LEDGER.md` for that country → pick sources by the
   rotation algorithm there (longest-idle first, weighted toward whichever
   segment is furthest behind its §1 target mix), preferring sources that
   return name + city + website together (§11 rule 2).
4. **Phase A** — harvest names from list pages until you have 60+, verifying
   nothing yet. **Phase B** — 10–14 contact searches in one block.
5. Verify every candidate found (§5) — light pass by default, deep pass only
   for signal-rich or solo/small candidates. **Don't pre-filter by size** (§4)
   — a large/famous-but-not-mega-brand firm still gets a light-pass fetch and
   goes in the file with an honest `company_size`.
6. MX-check every new email in one batch (§6).
7. Dedupe (§7), append, validate the file parses.
8. **Update `leads/SOURCE_LEDGER.md`** — mark each source used today, its
   yield, and any notes for next time.
9. Report: count, segment mix, signal mix, and **what was rejected and why**
   (should now mostly be genuine fetch failures and the named mega-brand list,
   not size-based judgment calls).
10. Log the run in `leads/HUNT_LOG.md`, commit and push.

---

## 11. Throughput protocol — 25–40 rows per run

**Target: 25–40 companies per run.** Runs that land under 20 have a diagnosable
cause, not bad luck — check it against this section before accepting the number.

### The measured bottleneck is verification, not discovery

Discovery is nearly free: one award page named **80 practices** (Australia
2026 shortlist), another named **66 projects**, a single BIID page closed the
UK interior gap by itself. The cost is entirely in turning a name into a row.

Historical rate: **~2.4 tool calls per written row.** At that rate a run
plateaus near 10–15. The protocol below targets **≤1 call per row**.

### Run shape — four phases, wide batches

| Phase | Calls | What |
|---|---|---|
| **A. Harvest** | 2–4 | Fetch *list* sources only (award shortlists, listicles, job boards, directories). Target **60+ names** before verifying anything. Do not verify during this phase. |
| **B. Contact sweep** | **10–14 in ONE block** | One `WebSearch` per company: `"<exact name>" <city> website contact email`. Most return the email in the snippet — those are **done**, no fetch (§6 Layer 1). |
| **C. Gap fill** | 4–8 | `WebFetch` only the companies Phase B left without an email. Expect ~30% of the batch. One attempt each; failures get a blank email cell, not a retry loop. |
| **D. Close** | 3 | One MX batch over all new domains · one write · one validate. |

≈25 calls → 30 rows. **The batch width in Phase B is the whole lever** — six
parallel searches caps a run near 15 rows; twelve gets to 30. Never run Phase B
searches one at a time.

### Rules that make the width possible

1. **A row needs only: name, website, country, city, industry, size, evidence,
   source.** Email is *optional*. Never stall a row hunting for contact details
   — write it and move on. A no-email row still imports and still scores.
2. **Prefer sources that pre-resolve the domain.** archisoup gives address +
   website; ArchitectureAU's job board gives practice + suburb; BIID gives
   studio + region. Those need one call per company. A bare list of names needs
   two. Source choice sets the ceiling before the run starts — the ledger notes
   which is which.
3. **`style_fit = 0` is a valid answer** and the expected one on a light pass.
   Do not open a projects page to refine it.
4. **Never re-search a company** whose name and city you already have — go
   straight to the contact search.

### Diagnosing a short run

| Symptom | Cause | Fix |
|---|---|---|
| <20 rows, many fetches | Phase B batches too narrow | Widen to 12+ parallel |
| <20 rows, few names | Wrong source tier | Harvest a Tier 1 list page first |
| Lots of 403s | Fetching directories/awards press directly | Reach via search (Gulf press is 403-only) |
| Names but no contacts | Fetching each site | Use the contact-search snippet instead |

**Never traded for speed:** inventing an email, skipping the MX batch, skipping
dedupe, or writing evidence not actually read.
