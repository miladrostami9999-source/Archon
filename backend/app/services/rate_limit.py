"""Central rate limiter for the abuse-prone public endpoints.

Why this exists: before it, nothing throttled login, signup, forgot-password
or payment submission — so password brute-force, account-creation spam, and
email bombing (each forgot-password / payment submit sends mail) were all
free. This adds a per-client cap on exactly those endpoints.

Storage is in-memory (the default). That's deliberate: the app runs as a
single uvicorn process, the codebase intentionally avoids a Redis dependency
for this kind of counting, and even under multiple workers a per-worker cap
still blunts brute-force meaningfully. If the deployment ever scales to many
workers and needs a shared counter, point `storage_uri` at the Redis already
in requirements — no call-site changes needed.

Keying: behind Railway/Vercel every request's TCP peer is the platform proxy,
so `request.client.host` would be one shared IP and the limit would apply
globally instead of per-user. We read the left-most hop of `X-Forwarded-For`
(the original client) instead, falling back to the peer address when the
header is absent (local dev, or a direct connection). X-Forwarded-For is
client-spoofable in general, but on this managed platform the proxy overwrites
it, so it's the correct signal here.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _client_key(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # "client, proxy1, proxy2" — the original client is the first entry.
        first = xff.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


# default_limits stays empty: only the endpoints that explicitly opt in via
# @limiter.limit(...) are throttled, so ordinary authenticated API traffic
# (which is already gated by auth + plan quotas) is never rate-limited.
limiter = Limiter(key_func=_client_key)
