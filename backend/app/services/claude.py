from dotenv import load_dotenv
load_dotenv()

import anthropic
import os
import json

client = anthropic.Anthropic(api_key=os.getenv("CLAUDE_API_KEY"))

ARMILA_DNA = """
You are helping Armila Design Studio with business development outreach.

About Armila Design:
- Professional 3D architectural visualization studio based in Madrid, Spain
- Specializes in: exterior/interior visualization, residential and commercial projects
- Tools: Blender, 3ds Max, AI rendering tools (Vaethat, NewArc.ai)
- Style: Minimalist Scandinavian, Modern Organic, Warm Minimalism
- Founder: Milad Rostami
- Target clients: Architecture firms, CGI studios, Real estate developers
- Website: armiladesign.com
"""


def parse_json_response(text: str):
    text = text.strip()
    if '```' in text:
        parts = text.split('```')
        for part in parts:
            part = part.strip()
            if part.startswith('json'):
                part = part[4:].strip()
            if part.startswith('[') or part.startswith('{'):
                text = part
                break
    return json.loads(text)


def generate_email(company: dict, tone: str = "friendly") -> dict:
    tone_guide = {
        "formal": "Write in a professional, formal tone.",
        "friendly": "Write in a warm, friendly but professional tone.",
        "brief": "Write very briefly — max 3 short paragraphs.",
        "storytelling": "Start with a compelling story or observation about their work."
    }

    prompt = f"""
{ARMILA_DNA}

Write a cold outreach email to this company on behalf of Armila Design:

Company: {company.get('name')}
Industry: {company.get('industry')}
Country: {company.get('country')}
City: {company.get('city')}
Website: {company.get('website', 'N/A')}
Summary: {company.get('ai_summary', 'N/A')}

Tone: {tone_guide.get(tone, tone_guide['friendly'])}

Rules:
- Subject line must be specific and not generic
- Mention their industry/location naturally
- Explain what Armila Design offers and why it's relevant to them
- Keep it under 150 words
- End with a clear but soft call to action
- Do NOT use placeholder text like [Your Name]
- Sign as: Milad Rostami | Armila Design | armiladesign.com

Return ONLY a JSON object with two fields:
{{"subject": "...", "body": "..."}}
Do not include any other text or markdown.
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(message.content[0].text)


def generate_summary(company: dict) -> str:
    """Legacy quick summary (no web search) — kept for backward compatibility."""
    prompt = f"""
Write a 2-3 sentence summary of this company for an architectural visualization studio's CRM.
Focus on: what they do, their size/style, and potential for outsourcing visualization work.

Company: {company.get('name')}
Industry: {company.get('industry')}
Country: {company.get('country')}
Website: {company.get('website', 'N/A')}

Return ONLY the summary text, no labels or formatting.
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )

    return message.content[0].text.strip()


def research_company(company: dict) -> dict:
    """
    Real web-search-grounded research. Claude actually searches the web to
    confirm this is the correct company, extracts real contact details, and
    produces a score based on verified findings — not a guess.
    """
    known = []
    if company.get("website"): known.append(f"Website: {company['website']}")
    if company.get("country"): known.append(f"Country: {company['country']}")
    if company.get("city"): known.append(f"City: {company['city']}")
    if company.get("industry"): known.append(f"Industry (unconfirmed): {company['industry']}")
    known_str = "\n".join(known) if known else "No additional details known — search by name only."

    prompt = f"""Search the web to research this real company. Do not guess or assume — only report what you actually find from search results.

Company name: {company.get('name')}
{known_str}

Steps:
1. Search for this exact company and confirm you found the real one (check official website, LinkedIn, or business listings — be careful with common names, use the country/city to disambiguate if given).
2. From what you find, extract: a real public contact email if listed, their official website, LinkedIn company page URL, Instagram handle/URL, their actual industry/specialty, and an estimate of company size (solo/small/medium/large based on team size or scale of work shown).
3. Write a 2-3 sentence summary based ONLY on what you actually found — their real focus, notable projects or style, and why they would (or wouldn't) be a good potential client for an architectural visualization studio (Armila Design) that provides outsourced 3D rendering.
4. Score 0-100 how strong a lead they are for Armila Design, based on real signals: do they appear to need/use visualization work, is their scale large enough to outsource, is the industry a good match (architecture, real estate, interior design, CGI, construction). Be honest — if you found little to nothing, the score should be low.

Return ONLY valid JSON, no other text, in exactly this shape:
{{
  "verified": true or false,
  "summary": "2-3 sentence summary based on real findings",
  "email": "found email or null",
  "website": "confirmed website URL or null",
  "linkedin": "LinkedIn company URL or null",
  "instagram": "Instagram URL or handle or null",
  "industry": "best-matching one of: Architecture, CGI, Interior Design, Real Estate, Visualization, Other",
  "company_size": "one of: solo, small, medium, large",
  "score": 0-100,
  "score_reasoning": "one short sentence explaining the score"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 5}],
        messages=[{"role": "user", "content": prompt}]
    )

    text_blocks = [block.text for block in message.content if getattr(block, "type", None) == "text"]
    full_text = "\n".join(text_blocks)

    result = parse_json_response(full_text)
    if not isinstance(result, dict):
        raise ValueError("AI research did not return valid structured data")
    return result


def smart_search(query: str, companies: list) -> list:
    company_summary = "\n".join([
        f"ID:{c['id']} | {c.get('name')} | {c.get('country')} | {c.get('industry')} | score:{c.get('opportunity_score')} | status:{c.get('status')} | heat:{c.get('heat_level')}"
        for c in companies
    ])

    prompt = f"""
You are a smart search engine for a CRM system.

User query: "{query}"

Available companies:
{company_summary}

Return ONLY a JSON array of matching company IDs like: [1, 3, 5]
If no matches, return: []
Do not include any other text.
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(message.content[0].text)


def generate_daily_tasks(companies: list, lang: str = "en") -> list:
    today_stats = {
        "total": len(companies),
        "new": len([c for c in companies if c.get('status') == 'new']),
        "reviewed": len([c for c in companies if c.get('status') == 'reviewed']),
        "sent": len([c for c in companies if c.get('status') == 'sent']),
        "replied": len([c for c in companies if c.get('status') == 'replied']),
        "hot": len([c for c in companies if c.get('heat_level') == 'hot']),
        "no_summary": len([c for c in companies if not c.get('ai_summary')]),
    }

    top_companies = sorted(
        [c for c in companies if c.get('status') in ['new', 'reviewed']],
        key=lambda x: x.get('opportunity_score', 0),
        reverse=True
    )[:10]

    company_list = "\n".join([
        f"- {c.get('name')} | {c.get('country')} | {c.get('industry')} | score:{c.get('opportunity_score')} | status:{c.get('status')}"
        for c in top_companies
    ])

    lang_instruction = (
        "IMPORTANT: Write all task titles and descriptions in Persian (Farsi). Use natural professional Persian."
        if lang == "fa"
        else "Write all task titles and descriptions in English."
    )

    prompt = f"""
{ARMILA_DNA}

CRM Stats:
- Total: {today_stats['total']} | New: {today_stats['new']} | Reviewed: {today_stats['reviewed']}
- Sent: {today_stats['sent']} | Replied: {today_stats['replied']}
- Hot: {today_stats['hot']} | Missing summary: {today_stats['no_summary']}

Top companies:
{company_list}

{lang_instruction}

Generate exactly 5 specific actionable daily tasks for Milad.
Types: review, email, followup, research, update

Return ONLY this JSON array, no markdown, no extra text:
[
  {{"type": "email", "priority": 1, "title": "...", "description": "...", "company_name": "..."}}
]
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(message.content[0].text)

def generate_weekly_report(data: dict, lang: str = "en") -> dict:
    is_fa = lang == "fa"

    # Build company details for top leads
    top_leads = sorted(
        [c for c in data['companies'] if c.get('status') not in ['archive', 'client']],
        key=lambda x: x.get('opportunity_score', 0),
        reverse=True
    )[:8]

    leads_text = "\n".join([
        f"- {c.get('name')} | {c.get('country')} | {c.get('industry')} | score:{c.get('opportunity_score')} | status:{c.get('status')} | heat:{c.get('heat_level')}"
        for c in top_leads
    ])

    # Follow-up needed
    import datetime
    now = datetime.datetime.utcnow()
    follow_ups = []
    for c in data['companies']:
        if c.get('status') == 'sent' and c.get('updated_at'):
            try:
                updated = datetime.datetime.fromisoformat(str(c['updated_at']).replace('Z',''))
                days = (now - updated).days
                if days >= 14:
                    follow_ups.append(f"- {c.get('name')} ({days} days ago)")
            except:
                pass

    follow_up_text = "\n".join(follow_ups) if follow_ups else ("هیچ موردی نیست" if is_fa else "None")

    status_summary = "\n".join([f"  {k}: {v}" for k, v in data['status_counts'].items() if v > 0])

    lang_instruction = (
        "IMPORTANT: Write the ENTIRE report in Persian (Farsi). Use professional business Persian."
        if is_fa else
        "Write the entire report in English."
    )

    date_str = now.strftime("%B %d, %Y")

    prompt = f"""
{ARMILA_DNA}

You are generating a weekly business development report for Milad Rostami at Armila Design.

{lang_instruction}

Current date: {date_str}

CRM DATA:
- Total companies: {data['total']}
- Favorites: {data['favorites']}
- Emails sent: {data['emails_sent']} | Replied: {data['emails_replied']}
- Reply rate: {data['reply_rate']}%

Pipeline status:
{status_summary}

Top leads by score:
{leads_text}

Follow-up needed (sent 14+ days ago):
{follow_up_text}

Generate a structured weekly report with these EXACT sections.
Return ONLY a JSON object with these fields (no markdown, no extra text):

{{
  "title": "Weekly Report - {date_str}",
  "summary": "2-3 sentence executive summary of the week",
  "pipeline_insight": "2-3 sentences analyzing the pipeline health and trends",
  "top_leads": "Highlight 2-3 specific companies worth focusing on this week and why",
  "follow_up_action": "Specific follow-up recommendations for overdue contacts",
  "email_performance": "Analysis of email campaign performance",
  "weekly_goals": "3-4 specific actionable goals for next week as a bulleted list",
  "motivation": "One short motivational sentence for Milad"
}}
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(message.content[0].text)


def _bullets(items) -> str:
    return "\n".join(items) if items else "- (none specified)"


def _usage(message) -> dict:
    u = getattr(message, "usage", None)
    return {
        "input_tokens": getattr(u, "input_tokens", 0) or 0,
        "output_tokens": getattr(u, "output_tokens", 0) or 0,
    }


def build_search_queries(criteria: dict, limit: int = 12) -> list[str]:
    """Turn the hunt criteria into concrete search-engine queries.

    Written by hand rather than by the model: these are mechanical
    combinations, and paying Claude to produce "interior design studio Dubai
    site:dezeen.com" would cost more than running the search.
    """
    from app.services.discovery_sources import source_domains, signal_queries

    places = [p.strip() for p in (
        (criteria.get("cities") or "") + "," + (criteria.get("countries") or "")
    ).split(",") if p.strip()] or [""]
    segments = criteria.get("segments") or ["architecture studio", "interior design studio"]
    domains = source_domains(criteria.get("sources") or [])

    queries: list[str] = []
    # Source-scoped queries first — a site: filter on an award shortlist or a
    # registry is what reaches past the famous studios.
    for domain in domains:
        for place in places[:2]:
            queries.append(f"site:{domain} {segments[0]} {place}".strip())
    # Then the plain combinations, which cover firms no directory lists.
    for seg in segments[:3]:
        for place in places[:3]:
            queries.append(f"{seg} {place}".strip())
    # Then any buying-signal phrasing, which is where the best leads hide.
    for place in places[:2]:
        for phrase in signal_queries(criteria.get("signals") or []):
            queries.append(f"{phrase} {place}".strip())

    seen, out = set(), []
    for q in queries:
        q = " ".join(q.split())
        if q and q not in seen:
            seen.add(q)
            out.append(q)
    return out[:limit]


def scout_leads(existing_names: list, criteria: dict) -> tuple[list, dict]:
    """Stage 1 — find *who exists*, and nothing more.

    Deliberately shallow: name, website, city, country and where it was found.
    No email hunting, no site fetching, no per-company assessment. That keeps
    a wide sweep cheap, because most of what comes back gets rejected — paying
    to research 25 companies to keep 6 is the expensive way round.

    Runs the searches through a commodity search API when one is configured
    (see services/websearch.py) and only shows the model snippets, which is
    ~30x cheaper than Anthropic's server-side web search. Falls back to the
    built-in tool when no search key is set, so the feature still works.

    Returns (leads, token usage).
    """
    from app.services import websearch

    prefer = criteria.get("search_provider")
    if websearch.is_configured(prefer):
        return _scout_cheap(existing_names, criteria)
    return _scout_builtin(existing_names, criteria)


def _scout_cheap(existing_names: list, criteria: dict) -> tuple[list, dict]:
    """Scout using our own search calls — the model only ever sees snippets."""
    from app.services import websearch

    count = max(1, min(int(criteria.get("count") or 15), 40))
    queries = build_search_queries(criteria, limit=min(12, 4 + count // 3))
    hits = websearch.search_many(queries, per_query=8, prefer=criteria.get("search_provider"))

    if not hits:
        return [], {"input_tokens": 0, "output_tokens": 0}

    known = ", ".join(existing_names[:200]) if existing_names else "none yet"
    brief = (criteria.get("brief") or "").strip()
    segments = criteria.get("segments") or []

    # Snippets only — a title, a URL and two lines. This is the whole saving.
    results_block = "\n".join(
        f"{i + 1}. {h['title']}\n   {h['url']}\n   {h['snippet'][:220]}"
        for i, h in enumerate(hits[:80])
    )

    prompt = f"""{ARMILA_DNA}

Below are real web search results. Pick out up to {count} distinct COMPANIES from
them that could plausibly commission architectural visualisation, and return
them as structured data. You are reading results, not searching — work only
from what is written below.

{f"## The brief{chr(10)}{brief}{chr(10)}" if brief else ""}
## What we're looking for
- Countries/regions: {(criteria.get('countries') or '').strip() or 'any'}
- Cities: {(criteria.get('cities') or '').strip() or 'any'}
- Business type: {', '.join(segments) if segments else 'architecture, interior design, or real-estate development'}

## Already in our catalog — never return these
{known}

## Search results
{results_block}

## Rules
- One entry per company, not per result. Merge duplicates.
- Skip results that aren't a company: articles about a project, directories,
  award pages themselves, job boards, marketplaces, Wikipedia.
- `source_url` must be one of the URLs above — the one you took them from.
- `website` should be the company's own domain when a result reveals it,
  otherwise null. Do not invent one.
- Infer country/city only when the result says so; otherwise null.

## Output
Return ONLY a JSON array, no prose and no markdown fence:
[
  {{
    "name": "Company name",
    "website": "https://... or null",
    "country": "Country or null",
    "city": "City or null",
    "segment": "best guess at business type",
    "source": "which listing or page this came from",
    "source_url": "the URL from the list above",
    "note": "one short line on what they appear to do"
  }}
]"""

    # Haiku is plenty for pulling structured records out of text, and costs a
    # third of Sonnet. The judgement calls happen in the enrich stage.
    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )
    text_blocks = [b.text for b in message.content if getattr(b, "type", None) == "text"]
    result = parse_json_response("\n".join(text_blocks))
    if not isinstance(result, list):
        raise ValueError("Scout did not return a list")
    return result, _usage(message)


def _scout_builtin(existing_names: list, criteria: dict) -> tuple[list, dict]:
    """Fallback scout using Anthropic's server-side web search.

    Correct but expensive — a measured run cost $0.58 for five companies. Set
    BRAVE_SEARCH_API_KEY to take the cheap path instead.
    """
    from app.services.discovery_sources import describe_sources, describe_signals

    known = ", ".join(existing_names[:200]) if existing_names else "none yet"
    count = max(1, min(int(criteria.get("count") or 15), 40))

    countries = (criteria.get("countries") or "").strip() or "any country, but prefer UAE, Saudi Arabia, Scandinavia, UK, Germany, Netherlands, Spain"
    cities = (criteria.get("cities") or "").strip() or "any city"
    segments = criteria.get("segments") or []
    brief = (criteria.get("brief") or "").strip()

    source_lines = describe_sources(criteria.get("sources") or [])
    signal_lines = describe_signals(criteria.get("signals") or [])

    search_plan = (
        "Search these specific sources directly:\n" + _bullets(source_lines)
        if source_lines else
        "Search broadly, but prefer industry directories, award shortlists and "
        "national architecture registries over generic web results."
    )

    # The operator's own words come first when they've written any. Every other
    # field is optional, so a brief-only hunt has to work on its own — burying
    # it under a list of defaults would make it the weakest input rather than
    # the strongest.
    brief_block = (
        f"## What we're after (the operator's own words — treat this as the brief)\n{brief}\n"
        if brief else ""
    )

    rules = [
        "- Only companies you actually saw in a search result. Never invent one.",
        "- `source_url` must be the page you found them on. No citation, no lead.",
        "- Prefer firms that are not household names — the long tail converts better.",
        f"- Return the full {count} if you can find them; fewer is fine, padding is not.",
    ]
    if criteria.get("require_website"):
        rules.append("- Skip anything you can't find a website for.")

    prompt = f"""{ARMILA_DNA}

Build a shortlist of {count} REAL companies that might commission architectural
visualisation. This is a first pass: identify who exists. Do NOT research them
in depth, do NOT look for email addresses, and do NOT visit their websites — a
later pass does that only for the ones we choose to keep.

{brief_block}
## Where to look
{search_plan}

## Who to look for
- Countries/regions: {countries}
- Cities: {cities}
- Business type: {', '.join(segments) if segments else 'architecture, interior design, or real-estate development'}

## Signals worth noting if you happen to see them
{_bullets(signal_lines)}

## Already in our catalog — never return these
{known}

## Rules
{chr(10).join(rules)}

## Output
Return ONLY a JSON array, no prose and no markdown fence:
[
  {{
    "name": "Company name",
    "website": "https://... or null if not shown in the result",
    "country": "Country",
    "city": "City or null",
    "segment": "best guess at business type",
    "source": "where you found them, e.g. 'Dezeen Awards 2025 shortlist'",
    "source_url": "the exact URL",
    "note": "one short line on what they appear to do"
  }}
]"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        # Low effort and no thinking: this pass is list-building, not judgement.
        # The reasoning budget belongs in the enrich stage, on far fewer rows.
        output_config={"effort": "low"},
        thinking={"type": "disabled"},
        tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 18}],
        messages=[{"role": "user", "content": prompt}],
    )
    text_blocks = [b.text for b in message.content if getattr(b, "type", None) == "text"]
    result = parse_json_response("\n".join(text_blocks))
    if not isinstance(result, list):
        raise ValueError("Scout did not return a list")
    return result, _usage(message)


def enrich_leads(leads: list, criteria: dict) -> tuple[list, dict]:
    """Stage 2 — research only the companies that were kept.

    Establishes contact details, size and segment, and reports which buying
    signals are actually present. It does **not** return a score: it returns
    facts, and `services/scoring.py` turns those into a number. A
    model-produced 0-100 drifts between runs and can't be re-tuned; a formula
    over facts can.

    When a search key is configured we fetch the pages ourselves and hand the
    model trimmed text, which is far cheaper than letting it pull whole pages
    into context. Otherwise it falls back to Anthropic's web_fetch tool.

    Returns (enriched leads, token usage).
    """
    from app.services import websearch

    if websearch.is_configured(criteria.get("search_provider")):
        return _enrich_cheap(leads, criteria)
    return _enrich_builtin(leads, criteria)


def _enrich_cheap(leads: list, criteria: dict) -> tuple[list, dict]:
    """Enrich from pages we fetched ourselves."""
    from app.services import websearch
    from app.services.discovery_sources import describe_signals

    signal_lines = describe_signals(criteria.get("signals") or []) or describe_signals(
        ["hiring_viz", "recent_award", "new_project", "exhibiting", "funding",
         "dated_visuals", "no_inhouse", "active_social"]
    )
    brief = (criteria.get("brief") or "").strip()

    dossiers, index = [], []
    for lead in leads:
        page = websearch.fetch_company_pages(lead.get("website") or "")
        index.append(lead)
        found_emails = ", ".join(page["emails"]) if page["emails"] else "none found in the page source"
        dossiers.append(
            f"### {len(index)}. {lead.get('name')}\n"
            f"Location per the search result: "
            f"{', '.join(x for x in [lead.get('city'), lead.get('country')] if x) or 'unknown'}\n"
            f"Website: {lead.get('website') or 'unknown'}\n"
            f"Email addresses found in the page source: {found_emails}\n"
            f"Page text:\n{page['text'][:5000] or '(could not be read: ' + str(page['error']) + ')'}\n"
        )

    prompt = f"""{ARMILA_DNA}

Below are {len(index)} companies with the text of their own websites. Work only from
what is written here — do not guess anything the pages don't support.

{f"## The brief{chr(10)}{brief}{chr(10)}" if brief else ""}
## For each company, establish
- The best contact email from the addresses listed for it. Prefer a named
  person over a shared inbox. If none were found, return null — never invent one.
- LinkedIn / Instagram URLs if the page text mentions them.
- Team size: solo (1-2), small (3-20), medium (21-100), large (100+). Judge from
  the team page, project volume and tone; null if there's genuinely no signal.
- Business type and the projects they do.
- Which buying signals the page actually evidences:
{_bullets(signal_lines)}
- `style_fit`, -8 to +8: how close their work is to what Armila renders well
  (minimalist Scandinavian, modern organic, warm minimalism). Positive when the
  aesthetic matches and their imagery looks like better renders would help;
  negative for a poor stylistic match or already-excellent visuals. 0 if unclear.

## Rules
- Null beats a plausible guess, especially for emails.
- `signals` may only contain keys from the list above, and only where the page
  gives you evidence. Do not infer a signal from the company's existence.
- `evidence` must quote or closely paraphrase something you actually read.
- Do not score the company. Report facts; we compute the score.

## Companies
{chr(10).join(dossiers)}

## Output
Return ONLY a JSON array in the same order, no prose:
[
  {{
    "name": "Company name (as given)",
    "email": "best published email or null",
    "linkedin": "URL or null", "instagram": "URL or null", "phone": "or null",
    "country": "Country", "city": "City or null",
    "industry": "one of: Architecture, Interior Design, Real Estate, CGI, Visualization, Animation, Construction",
    "segment": "more specific business type",
    "company_size": "solo|small|medium|large",
    "signals": ["verified signal keys"],
    "evidence": "the specific facts you read that matter for outreach",
    "style_fit": -8..8,
    "confidence": "high|medium|low",
    "why": "one sentence on why they're worth an email from Armila"
  }}
]"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )
    text_blocks = [b.text for b in message.content if getattr(b, "type", None) == "text"]
    result = parse_json_response("\n".join(text_blocks))
    if not isinstance(result, list):
        raise ValueError("Enrichment did not return a list")
    return result, _usage(message)


def _enrich_builtin(leads: list, criteria: dict) -> tuple[list, dict]:
    """Fallback enrichment using Anthropic's web_fetch tool — accurate, pricey."""
    from app.services.discovery_sources import describe_signals

    signal_lines = describe_signals(criteria.get("signals") or []) or describe_signals(
        ["hiring_viz", "recent_award", "new_project", "exhibiting", "funding",
         "dated_visuals", "no_inhouse", "active_social"]
    )
    brief = (criteria.get("brief") or "").strip()

    roster = "\n".join(
        f"{i + 1}. {l.get('name')} — {l.get('website') or 'website unknown'}"
        f" — {', '.join(x for x in [l.get('city'), l.get('country')] if x) or 'location unknown'}"
        for i, l in enumerate(leads)
    )

    prompt = f"""{ARMILA_DNA}

Research these {len(leads)} companies so we can decide who to approach. Visit each
company's own website (and LinkedIn if useful) and report what you actually find.

## Companies
{roster}

## For each one, establish
- A published contact email. Prefer a named person's address over a shared inbox.
  Never guess or construct an address — if there isn't one published, return null.
- Website, LinkedIn and Instagram URLs.
- Team size: solo (1-2), small (3-20), medium (21-100), large (100+).
- Business type and the kind of projects they do.
- Which of these buying signals are genuinely present, with the evidence you read:
{_bullets(signal_lines)}
- `style_fit`, from -8 to +8: how close their work is to what Armila renders
  well (minimalist Scandinavian, modern organic, warm minimalism). Positive if
  their aesthetic matches and their current imagery looks weak enough that
  better renders would visibly help; negative if their work is a poor stylistic
  match or their existing visuals are already excellent. 0 if you can't tell.

## Extra brief
{brief or '(none)'}

## Rules
- Report only what you read on a real page. Null beats a plausible guess,
  especially for email addresses.
- `signals` must contain only the keys listed above, and only ones you can
  point to evidence for.
- Do not score the company. Report the facts; we compute the score.

## Output
Return ONLY a JSON array in the same order as the list above, no prose:
[
  {{
    "name": "Company name (as given)",
    "email": "published email or null",
    "website": "https://... or null",
    "linkedin": "URL or null",
    "instagram": "URL or null",
    "phone": "published phone or null",
    "country": "Country",
    "city": "City or null",
    "industry": "one of: Architecture, Interior Design, Real Estate, CGI, Visualization, Animation, Construction",
    "segment": "more specific business type",
    "company_size": "solo|small|medium|large",
    "signals": ["signal keys you verified"],
    "evidence": "the specific facts you read that matter for outreach",
    "style_fit": -8..8,
    "confidence": "high|medium|low",
    "why": "one sentence on why they're worth an email from Armila"
  }}
]"""

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        thinking={"type": "adaptive"},
        tools=[
            {"type": "web_search_20260209", "name": "web_search", "max_uses": 15},
            {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 25},
        ],
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        message = stream.get_final_message()

    text_blocks = [b.text for b in message.content if getattr(b, "type", None) == "text"]
    result = parse_json_response("\n".join(text_blocks))
    if not isinstance(result, list):
        raise ValueError("Enrichment did not return a list")
    return result, _usage(message)


def hunt_leads(existing_names: list, criteria: dict) -> list:
    """One-shot deep hunt — search and research in a single pass.

    Kept for the cases where the extra tokens are worth skipping the review
    step. The staged `scout_leads` → `enrich_leads` path is cheaper for
    anything wide, because it only researches what survives the first cut.
    """
    from app.services.discovery_sources import describe_sources, describe_signals

    known = ", ".join(existing_names[:200]) if existing_names else "none yet"
    count = max(1, min(int(criteria.get("count") or 10), 25))

    countries = (criteria.get("countries") or "").strip() or "any country, but prefer UAE, Saudi Arabia, Scandinavia, UK, Germany, Netherlands, Spain"
    cities = (criteria.get("cities") or "").strip() or "any city"
    segments = criteria.get("segments") or []
    project_types = criteria.get("project_types") or []
    sizes = criteria.get("company_sizes") or []
    languages = (criteria.get("languages") or "").strip()
    brief = (criteria.get("brief") or "").strip()

    source_lines = describe_sources(criteria.get("sources") or [])
    signal_lines = describe_signals(criteria.get("signals") or [])

    search_plan = (
        "Search these specific sources. Go to them directly rather than relying on a generic web search:\n"
        + _bullets(source_lines)
        if source_lines else
        "No specific sources were chosen — search broadly, but prefer industry directories, "
        "award shortlists and national architecture registries over generic web results."
    )

    requirements = []
    if criteria.get("require_website"):
        requirements.append("- Skip any company whose website you could not find and confirm resolves.")
    if criteria.get("require_email"):
        requirements.append("- Skip any company where you could not find a real published contact email.")
    if criteria.get("min_score"):
        requirements.append(f"- Skip anything you would score below {int(criteria['min_score'])}.")

    prompt = f"""{ARMILA_DNA}

You are hunting new business-development leads for Armila Design. Find {count} REAL
companies that plausibly commission architectural visualisation and could become clients.

## Where to look
{search_plan}

## Who to look for
- Countries/regions: {countries}
- Cities: {cities}
- Business type: {', '.join(segments) if segments else 'architecture, interior design, real-estate development or related'}
- Project types they work on: {', '.join(project_types) if project_types else 'any'}
- Company size: {', '.join(sizes) if sizes else 'any'}
- Website/content language: {languages or 'any'}

## Buying signals to prioritise
{_bullets(signal_lines)}

## Extra brief from the operator
{brief or '(none)'}

## Already in our catalog — never return these
{known}

## Hard rules
- Every company must be one you actually found in this session through search or by fetching a page. Never invent a company, a website, an email or a person.
- `source` and `source_url` must point at the page where you found them. If you cannot cite it, drop the lead.
- Never guess an email address. Only return one that is published on their own site or an official listing. Prefer a real inbox over a generic one, but a generic `info@` is fine.
- `evidence` must be a specific fact you read — a project name, an award, a job posting, an exhibitor entry. Not a generic description.
- Set `confidence` to "high" only when you verified the company on its own website.
- Leave any field you could not confirm as null. A null is better than a plausible guess.
- Prefer firms that are not already household names; the long tail converts better than the famous studios.
{chr(10).join(requirements) if requirements else ''}

## Output
Return ONLY a valid JSON array, no prose and no markdown fence, of exactly this shape:
[
  {{
    "name": "Company name",
    "website": "https://... or null",
    "email": "published contact email or null",
    "country": "Country",
    "city": "City or null",
    "industry": "one of: Architecture, Interior Design, Real Estate, CGI, Visualization, Animation, Construction",
    "company_size": "solo|small|medium|large",
    "linkedin": "LinkedIn company URL or null",
    "instagram": "Instagram URL or null",
    "source": "which source you found them in, e.g. 'Dezeen Awards 2025 shortlist'",
    "source_url": "the exact URL you found them at",
    "evidence": "the specific fact you read that makes them a lead",
    "signals": ["matched signal labels, or []"],
    "why": "one sentence on why they fit Armila specifically",
    "confidence": "high|medium|low",
    "score": 0-100
  }}
]"""

    # Streaming keeps the connection alive through a long multi-search turn —
    # a hunt across several sources can run for minutes.
    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        thinking={"type": "adaptive"},
        tools=[
            {"type": "web_search_20260209", "name": "web_search", "max_uses": 30},
            {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 20},
        ],
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        message = stream.get_final_message()

    text_blocks = [b.text for b in message.content if getattr(b, "type", None) == "text"]
    result = parse_json_response("\n".join(text_blocks))
    if not isinstance(result, list):
        raise ValueError("Lead discovery did not return a list")
    return result


def discover_leads(existing_names: list, criteria: dict) -> list:
    """Backwards-compatible entry point for the old country/industry form."""
    return hunt_leads(existing_names, {
        "countries": criteria.get("country"),
        "segments": [criteria["industry"]] if criteria.get("industry") else [],
        "count": criteria.get("count") or 5,
    })
