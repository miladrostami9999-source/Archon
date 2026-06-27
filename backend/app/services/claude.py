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
