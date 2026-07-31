"""Where architecture leads actually live on the web.

Google search alone finds the same handful of famous studios over and over. The
useful sources are the places the industry already organises itself: award
shortlists, national registries, trade-fair exhibitor lists, publication
directories. Each entry names real sites so Claude searches *those* rather than
guessing, and each carries a short `hint` that goes into the prompt.

Adding a source here is all it takes — the hunt page reads this list, so the UI
picks it up with no frontend change.
"""

SOURCE_GROUPS = [
    {
        "key": "publications",
        "label": "Design publications & directories",
        "blurb": "Curated firm listings and project features — high quality, already filtered for design ambition.",
        "sources": [
            {"key": "archdaily", "label": "ArchDaily", "hint": "archdaily.com office profiles and project credits"},
            {"key": "dezeen", "label": "Dezeen", "hint": "dezeen.com studio features and Dezeen Showroom"},
            {"key": "architizer", "label": "Architizer", "hint": "architizer.com firm directory"},
            {"key": "archello", "label": "Archello", "hint": "archello.com brand and office directory"},
            {"key": "divisare", "label": "Divisare", "hint": "divisare.com authors index"},
            {"key": "world_architects", "label": "World-Architects", "hint": "world-architects.com national profile directories"},
            {"key": "architonic", "label": "Architonic", "hint": "architonic.com architect and designer index"},
            {"key": "designboom", "label": "Designboom", "hint": "designboom.com architecture section"},
            {"key": "interior_design_mag", "label": "Interior Design / Frame", "hint": "interiordesign.net Giants list, frameweb.com studio index"},
        ],
    },
    {
        "key": "awards",
        "label": "Awards & competition shortlists",
        "blurb": "A firm that just won something needs images for press. Shortlists are pre-qualified lead lists.",
        "sources": [
            {"key": "waf", "label": "World Architecture Festival", "hint": "worldarchitecturefestival.com shortlists by year and category"},
            {"key": "dezeen_awards", "label": "Dezeen Awards", "hint": "dezeen.com/awards longlists and shortlists"},
            {"key": "architizer_a", "label": "Architizer A+ Awards", "hint": "architizer.com/awards winners and finalists"},
            {"key": "mies", "label": "EU Mies van der Rohe Award", "hint": "miesarch.com nominated works"},
            {"key": "riba_awards", "label": "RIBA Awards / Stirling Prize", "hint": "architecture.com awards regional winners"},
            {"key": "aia_awards", "label": "AIA Awards", "hint": "aia.org design award recipients"},
            {"key": "me_architect", "label": "Middle East Architect / Cityscape Awards", "hint": "middleeastarchitect.com and cityscape award shortlists"},
            {"key": "iconic", "label": "Iconic / German Design Awards", "hint": "iconic-world.com and german-design-award.com winners"},
        ],
    },
    {
        "key": "registries",
        "label": "Professional bodies & registries",
        "blurb": "Official national member lists. Verified, complete, and almost nobody scrapes them for outreach.",
        "sources": [
            {"key": "riba_arb", "label": "RIBA / ARB — UK", "hint": "architecture.com find-an-architect, arb.org.uk register"},
            {"key": "aia_ncarb", "label": "AIA / NCARB — US", "hint": "aia.org firm directory"},
            {"key": "bak_bda", "label": "BAK / BDA — Germany", "hint": "bak.de and bda-bund.de member offices"},
            {"key": "cscae", "label": "CSCAE / COAM — Spain", "hint": "cscae.com and coam.org registered practices"},
            {"key": "cnappc", "label": "Ordine degli Architetti — Italy", "hint": "awn.it and provincial ordine directories"},
            {"key": "bna", "label": "BNA — Netherlands", "hint": "bna.nl bureau directory"},
            {"key": "nordic_bodies", "label": "Nordic institutes", "hint": "danskeark.dk, arkitekt.se, arkitektur.no, safa.fi member lists"},
            {"key": "ordre_fr", "label": "Ordre des Architectes — France", "hint": "architectes.org annuaire"},
            {"key": "gulf_registries", "label": "Gulf consultant registries", "hint": "Dubai Municipality / DDA consultant lists, Saudi Council of Engineers, Qatar UPDA, Abu Dhabi DMT"},
            {"key": "tr_chamber", "label": "Turkish Chamber of Architects", "hint": "mo.org.tr member offices"},
        ],
    },
    {
        "key": "fairs",
        "label": "Trade fairs & exhibitor lists",
        "blurb": "Exhibitor directories are public, dated, and full of firms with a marketing budget already committed.",
        "sources": [
            {"key": "big5", "label": "The Big 5 Global — Dubai", "hint": "thebig5.ae exhibitor directory"},
            {"key": "cityscape", "label": "Cityscape Global", "hint": "cityscapeglobal.com exhibitor and developer list"},
            {"key": "mipim", "label": "MIPIM — Cannes", "hint": "mipim.com participant directory"},
            {"key": "expo_real", "label": "EXPO REAL — Munich", "hint": "exporeal.net exhibitor list"},
            {"key": "salone", "label": "Salone del Mobile — Milan", "hint": "salonemilano.it exhibitor catalogue"},
            {"key": "bau_batimat", "label": "BAU Munich / Batimat Paris", "hint": "bau-muenchen.com and batimat.com exhibitor lists"},
            {"key": "downtown_design", "label": "Downtown Design / INDEX Dubai", "hint": "downtowndesign.com and indexexhibition.com exhibitors"},
        ],
    },
    {
        "key": "portfolio",
        "label": "Portfolio & social platforms",
        "blurb": "Studios that already publish visual work — they understand what renders are worth.",
        "sources": [
            {"key": "behance", "label": "Behance", "hint": "behance.net architecture and interior design curated galleries"},
            {"key": "artstation", "label": "ArtStation", "hint": "artstation.com archviz channel and studio profiles"},
            {"key": "cgarchitect", "label": "CGarchitect", "hint": "cgarchitect.com studio directory and Architectural 3D Awards"},
            {"key": "linkedin", "label": "LinkedIn company search", "hint": "linkedin.com/company pages with industry Architecture & Planning or Design Services"},
            {"key": "instagram", "label": "Instagram hashtags", "hint": "public accounts under #architecturestudio #interiordesignstudio #archviz in the target city"},
            {"key": "houzz", "label": "Houzz Pro directory", "hint": "houzz.com professional directory filtered by city"},
        ],
    },
    {
        "key": "maps",
        "label": "Maps & local business listings",
        "blurb": "Best for coverage of a specific city, including the small studios no publication covers.",
        "sources": [
            {"key": "google_maps", "label": "Google Maps / Places", "hint": "'architecture firm <city>' and 'interior design studio <city>' map results"},
            {"key": "clutch", "label": "Clutch / DesignRush / GoodFirms", "hint": "clutch.co, designrush.com, goodfirms.co agency directories"},
            {"key": "local_directories", "label": "Local business directories", "hint": "the country's Yellow Pages equivalent, Europages, Kompass"},
        ],
    },
    {
        "key": "developers",
        "label": "Developers, contractors & tenders",
        "blurb": "The people who commission buildings — bigger budgets and a direct need for marketing imagery.",
        "sources": [
            {"key": "gulf_developers", "label": "Gulf developers", "hint": "Emaar, DAMAC, Aldar, Nakheel, ROSHN, NEOM and their announced project partners"},
            {"key": "enr", "label": "ENR / Construction Week", "hint": "enr.com top contractors and constructionweekonline.com company profiles"},
            {"key": "tenders", "label": "Project & tender portals", "hint": "meed.com projects, projectsme, tendersinfo listings for upcoming developments"},
            {"key": "property_press", "label": "Property press releases", "hint": "propertyweek.com, arabianbusiness.com real-estate launches"},
        ],
    },
    {
        "key": "hiring",
        "label": "Hiring signals (highest intent)",
        "blurb": "A firm advertising for a 3D artist either outsources already or is about to. The strongest signal there is.",
        "sources": [
            {"key": "archinect_jobs", "label": "Archinect / Dezeen Jobs", "hint": "archinect.com/jobs and dezeen.com/jobs listings for visualiser or 3D artist roles"},
            {"key": "linkedin_jobs", "label": "LinkedIn Jobs", "hint": "LinkedIn postings for 'architectural visualizer', '3D artist', 'CGI artist'"},
            {"key": "cgarchitect_jobs", "label": "CGarchitect jobs board", "hint": "cgarchitect.com job listings and studio hiring posts"},
        ],
    },
    {
        "key": "registers",
        "label": "Company registers & data",
        "blurb": "Legal entity data — useful to confirm a firm is real and still trading before you spend a credit on it.",
        "sources": [
            {"key": "companies_house", "label": "Companies House / Handelsregister", "hint": "find-and-update.company-information.service.gov.uk, handelsregister.de"},
            {"key": "opencorporates", "label": "OpenCorporates", "hint": "opencorporates.com company records"},
            {"key": "crunchbase", "label": "Crunchbase", "hint": "crunchbase.com organisation profiles and funding rounds"},
        ],
    },
]

SEGMENTS = [
    "Architecture studio", "Interior design studio", "Landscape architecture",
    "Urban planning / masterplanning", "Real estate developer", "Construction contractor",
    "Hospitality group", "Retail brand rollout", "Furniture / product brand",
    "Facade & engineering consultant", "Arch-viz studio (overflow partner)",
    "Property marketing agency", "Exhibition & set design",
]

PROJECT_TYPES = [
    "Residential villa", "Multi-family residential", "Commercial / office", "Hospitality / hotel",
    "Retail", "Healthcare", "Education", "Cultural / museum", "Industrial",
    "Masterplan", "Mixed-use", "Sports", "Transport",
]

SIGNALS = [
    {"key": "hiring_viz", "label": "Hiring a visualiser or 3D artist", "hint": "an open role for a 3D/CGI/visualisation position in the last 6 months"},
    {"key": "recent_award", "label": "Recently won or shortlisted for an award", "hint": "appears on an award shortlist or winners list in the last 18 months"},
    {"key": "new_project", "label": "Announced a new project", "hint": "a project launch, groundbreaking or planning submission announced recently"},
    {"key": "exhibiting", "label": "Exhibiting at an upcoming fair", "hint": "listed as an exhibitor at a trade fair happening in the next 12 months"},
    {"key": "funding", "label": "Recently funded or expanding", "hint": "a funding round, new office, or entry into a new market"},
    {"key": "dated_visuals", "label": "Visuals on their site look dated", "hint": "the renders or images on their website look low quality or years old"},
    {"key": "no_inhouse", "label": "No in-house visualisation team", "hint": "the team page shows no 3D or visualisation staff, so the work is outsourced"},
    {"key": "active_social", "label": "Actively posting project imagery", "hint": "regularly publishing renders or project photos on Instagram or LinkedIn"},
]

COMPANY_SIZES = [
    {"key": "solo", "label": "Solo / 1–2 people"},
    {"key": "small", "label": "Small (3–20)"},
    {"key": "medium", "label": "Medium (21–100)"},
    {"key": "large", "label": "Large (100+)"},
]

_SOURCE_INDEX = {
    s["key"]: {**s, "group": g["label"]}
    for g in SOURCE_GROUPS for s in g["sources"]
}
_SIGNAL_INDEX = {s["key"]: s for s in SIGNALS}


def describe_sources(keys: list[str]) -> list[str]:
    """Turn source keys into the concrete 'search here' lines the prompt uses."""
    lines = []
    for key in keys or []:
        src = _SOURCE_INDEX.get(key)
        if src:
            lines.append(f"- {src['label']} ({src['group']}): {src['hint']}")
    return lines


def describe_signals(keys: list[str]) -> list[str]:
    lines = []
    for key in keys or []:
        sig = _SIGNAL_INDEX.get(key)
        if sig:
            lines.append(f"- {sig['label']}: {sig['hint']}")
    return lines


def catalog() -> dict:
    """The whole picker, shaped for the frontend."""
    return {
        "groups": SOURCE_GROUPS,
        "segments": SEGMENTS,
        "project_types": PROJECT_TYPES,
        "signals": SIGNALS,
        "company_sizes": COMPANY_SIZES,
    }
