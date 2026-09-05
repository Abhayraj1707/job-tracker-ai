"""
Job Search MCP Server
======================
Exposes job-search tools over the Model Context Protocol so any MCP-compatible
client (Claude Desktop, Claude Code, or your own backend) can call:

  - search_jobs(keywords, location, hours_old, sources)
  - score_job_fit(job_description, cv_profile)

Run standalone for testing:
    python server.py

Register in Claude Desktop's config (claude_desktop_config.json):
{
  "mcpServers": {
    "job-search": {
      "command": "python",
      "args": ["/absolute/path/to/mcp-servers/job_search_server/server.py"]
    }
  }
}
"""
import asyncio
import json
import os
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from sources.adzuna import search_adzuna
from sources.jsearch import search_jsearch
from sources.greenhouse import search_greenhouse

app = Server("job-search-mcp")


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_jobs",
            description=(
                "Search multiple job sources (Adzuna, JSearch/Google-for-Jobs, Greenhouse) "
                "for postings matching keywords, optionally filtered to a location and to "
                "postings from the last N hours. Returns a normalized, deduplicated list."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "keywords": {"type": "string", "description": "e.g. 'backend engineer python'"},
                    "location": {"type": "string", "description": "e.g. 'Bengaluru' or 'Remote'"},
                    "hours_old": {"type": "integer", "description": "Max age of posting in hours", "default": 24},
                    "sources": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["adzuna", "jsearch", "greenhouse"]},
                        "description": "Which sources to query. Defaults to all.",
                    },
                },
                "required": ["keywords"],
            },
        ),
        Tool(
            name="score_job_fit",
            description=(
                "Score how well a job description matches a candidate's CV profile, "
                "0-100, using an LLM. Returns score and a one-line reason."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "job_description": {"type": "string"},
                    "cv_profile": {"type": "string", "description": "Structured CV JSON or summary text"},
                },
                "required": ["job_description", "cv_profile"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    if name == "search_jobs":
        keywords = arguments["keywords"]
        location = arguments.get("location", "")
        hours_old = arguments.get("hours_old", 24)
        sources = arguments.get("sources") or ["adzuna", "jsearch", "greenhouse"]

        tasks = []
        if "adzuna" in sources:
            tasks.append(search_adzuna(keywords, location, max_days_old=max(1, hours_old // 24 or 1)))
        if "jsearch" in sources:
            tasks.append(search_jsearch(keywords, location, hours_old=hours_old))
        if "greenhouse" in sources:
            tasks.append(search_greenhouse(hours_old=hours_old))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_jobs = []
        for r in results:
            if isinstance(r, Exception):
                all_jobs.append({"error": str(r)})
            else:
                all_jobs.extend(r)

        # Simple dedup by (title, company)
        seen = set()
        deduped = []
        for job in all_jobs:
            key = (job.get("title", "").lower(), job.get("company", "").lower())
            if key not in seen:
                seen.add(key)
                deduped.append(job)

        return [TextContent(type="text", text=json.dumps(deduped, indent=2))]

    elif name == "score_job_fit":
        # Delegates to the shared scoring module (calls Claude API).
        from ai_scoring import score_fit  # local import to keep server startup light
        result = await score_fit(arguments["job_description"], arguments["cv_profile"])
        return [TextContent(type="text", text=json.dumps(result))]

    raise ValueError(f"Unknown tool: {name}")


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
