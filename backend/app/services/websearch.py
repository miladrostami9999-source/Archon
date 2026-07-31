"""Cheap web search and page fetching for lead hunting.

Anthropic's server-side `web_search` tool is excellent and very expensive for
this workload. A measured scout run — 5 companies, 1 source — cost $0.58:
$0.16 in search fees and $0.42 in tokens, because each search injects roughly
7,500 tokens of full result content into the context. The prompt itself was
1,563 tokens; 99% of the bill was search results.

The fix isn't a cheaper model, it's not shipping 120,000 tokens of web page
into the context in the first place. So we run the searches ourselves through a
commodity search API, hand the model a title, a URL and a two-line snippet per
result, and let it decide what to look at. Same job, ~2% of the tokens.

Providers (checked July 2026):
  * Serper — 2,500 free queries, no credit card. Start here.
  * Brave  — $5/1,000, with $5 of free credit a month (so ~1,000 free), but a
             card is required even for the free credit.
  * neither configured → callers fall back to Anthropic's built-in tool

Set `SERPER_API_KEY` or `BRAVE_SEARCH_API_KEY` to switch the cheap path on.
Serper is checked second only because Brave's key is the more common one to
already have; either alone is enough.
"""
from __future__ import annotations

import os
import re

import httpx

SEARCH_TIMEOUT = 20.0
FETCH_TIMEOUT = 15.0

# Pages are read for contact details and a sense of the work, not archived.
# 6k characters covers a typical About/Contact page with room to spare.
DEFAULT_PAGE_CHARS = 6000

_UA = "Mozilla/5.0 (compatible; ArchonLeadHunter/1.0; +https://armiladesign.com)"


def provider() -> str | None:
    """Which cheap provider is configured, if any."""
    if os.getenv("SERPER_API_KEY"):
        return "serper"
    if os.getenv("BRAVE_SEARCH_API_KEY"):
        return "brave"
    return None


def is_configured() -> bool:
    return provider() is not None


# ── search ─────────────────────────────────────────────────────────────────
def _brave(query: str, count: int) -> list[dict]:
    r = httpx.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": query, "count": min(count, 20)},
        headers={
            "Accept": "application/json",
            "X-Subscription-Token": os.environ["BRAVE_SEARCH_API_KEY"],
        },
        timeout=SEARCH_TIMEOUT,
    )
    r.raise_for_status()
    results = (r.json().get("web") or {}).get("results") or []
    return [
        {
            "title": item.get("title") or "",
            "url": item.get("url") or "",
            "snippet": _clean(item.get("description") or ""),
        }
        for item in results
    ]


def _serper(query: str, count: int) -> list[dict]:
    r = httpx.post(
        "https://google.serper.dev/search",
        json={"q": query, "num": min(count, 20)},
        headers={"X-API-KEY": os.environ["SERPER_API_KEY"], "Content-Type": "application/json"},
        timeout=SEARCH_TIMEOUT,
    )
    r.raise_for_status()
    return [
        {
            "title": item.get("title") or "",
            "url": item.get("link") or "",
            "snippet": _clean(item.get("snippet") or ""),
        }
        for item in (r.json().get("organic") or [])
    ]


def search(query: str, count: int = 8) -> list[dict]:
    """One search. Returns [{title, url, snippet}] — never raises."""
    try:
        p = provider()
        if p == "brave":
            return _brave(query, count)
        if p == "serper":
            return _serper(query, count)
    except Exception as e:
        print(f"[websearch] '{query[:60]}' failed: {e}")
    return []


def search_many(queries: list[str], per_query: int = 8) -> list[dict]:
    """Run several searches and merge, keeping the first sighting of each URL.

    De-duplicating here rather than in the prompt matters: overlapping queries
    are normal (several sources cover the same firm) and paying to send the
    same result three times is exactly the waste this module exists to avoid.
    """
    seen: set[str] = set()
    merged: list[dict] = []
    for q in queries:
        for hit in search(q, per_query):
            url = (hit.get("url") or "").rstrip("/")
            if not url or url in seen:
                continue
            seen.add(url)
            hit["query"] = q
            merged.append(hit)
    return merged


# ── page fetching ──────────────────────────────────────────────────────────
_SCRIPT_STYLE = re.compile(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", re.S | re.I)
_TAGS = re.compile(r"<[^>]+>")
_WS = re.compile(r"[ \t\r\f\v]+")
_BLANKS = re.compile(r"\n{3,}")
_MAILTO = re.compile(r"mailto:([^\"'?\s>]+)", re.I)
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _clean(text: str) -> str:
    return _WS.sub(" ", _TAGS.sub(" ", text)).strip()


def fetch_text(url: str, max_chars: int = DEFAULT_PAGE_CHARS) -> dict:
    """Fetch a page as plain text, plus any email addresses found on it.

    Emails are pulled out separately because they're the single most valuable
    thing on the page and are easy to lose: `mailto:` hrefs vanish when tags
    are stripped, and the visible text is often an image or obfuscated.
    """
    out = {"url": url, "text": "", "emails": [], "error": None}
    if not url:
        out["error"] = "no url"
        return out
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        r = httpx.get(
            url, timeout=FETCH_TIMEOUT, follow_redirects=True,
            headers={"User-Agent": _UA, "Accept": "text/html,application/xhtml+xml"},
        )
        r.raise_for_status()
        if "html" not in r.headers.get("content-type", "").lower():
            out["error"] = "not html"
            return out
        html = r.text
    except Exception as e:
        out["error"] = str(e)[:150]
        return out

    emails = set(_MAILTO.findall(html))
    body = _SCRIPT_STYLE.sub(" ", html)
    text = _BLANKS.sub("\n\n", _WS.sub(" ", _TAGS.sub("\n", body)))
    emails.update(_EMAIL.findall(text))

    # Drop the junk that image filenames and tracking pixels produce.
    clean_emails = [
        e.strip().lower() for e in emails
        if not e.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"))
    ]

    out["text"] = "\n".join(line.strip() for line in text.splitlines() if line.strip())[:max_chars]
    out["emails"] = sorted(set(clean_emails))[:8]
    return out


def fetch_company_pages(website: str, max_chars: int = DEFAULT_PAGE_CHARS) -> dict:
    """Fetch a company's home page and, if the email isn't there, its contact page.

    Most studios put the address on /contact rather than the landing page, so
    one extra request roughly doubles the hit rate — and it's free, unlike
    asking the model to go looking.
    """
    base = (website or "").rstrip("/")
    if not base:
        return {"text": "", "emails": [], "error": "no website"}
    if not base.startswith(("http://", "https://")):
        base = "https://" + base

    home = fetch_text(base, max_chars)
    emails = list(home["emails"])
    text = home["text"]

    if not emails:
        for path in ("/contact", "/contact-us", "/about"):
            page = fetch_text(base + path, max_chars // 2)
            if page["emails"] or page["text"]:
                emails.extend(page["emails"])
                text = (text + "\n\n" + page["text"])[: max_chars + max_chars // 2]
            if emails:
                break

    return {"text": text, "emails": sorted(set(emails))[:8], "error": home["error"]}
