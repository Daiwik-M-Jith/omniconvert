"""Root ASGI entrypoint for Vercel and other hosts that expect `app.py` at project root.

This file simply re-exports the FastAPI app instance defined in `server.app`.
"""
from server.app import app as app  # re-export for compatibility
