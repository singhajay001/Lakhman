"""Command line entry point.

Phase 1 ships the config loader and the compliance gate. Every later command is
registered now - so `llm-seo --help` shows the whole surface - and exits with a
clear "not built yet" rather than a stack trace.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

import typer
from pydantic import ValidationError

from . import __version__
from .business import load_blocklist, load_business

app = typer.Typer(
    name="llm-seo",
    help="Local search toolkit for one bottle shop: Google Business Profile "
    "content engine (Part A) and geo-grid rank tracking (Part B). Every business "
    "fact comes from config/business.yaml.",
    no_args_is_help=True,
    add_completion=False,
)

config_app = typer.Typer(help="Inspect and validate config/.", no_args_is_help=True)
compliance_app = typer.Typer(help="Run the compliance gate over copy.", no_args_is_help=True)
calendar_app = typer.Typer(help="90-day content calendar (Phase 2).", no_args_is_help=True)
posts_app = typer.Typer(help="GBP post generation (Phase 2).", no_args_is_help=True)
products_app = typer.Typer(help="GBP product tiles (Phase 2).", no_args_is_help=True)
qanda_app = typer.Typer(help="Seeded GBP questions and answers (Phase 2).", no_args_is_help=True)
reviews_app = typer.Typer(help="Review reply drafting (Phase 4).", no_args_is_help=True)
photos_app = typer.Typer(help="Photo program (Phase 4).", no_args_is_help=True)
rank_app = typer.Typer(help="Geo-grid rank tracking (Phase 3).", no_args_is_help=True)
audit_app = typer.Typer(help="Profile, site and competitor audits (Phase 4).", no_args_is_help=True)
report_app = typer.Typer(help="Reporting (Phase 4).", no_args_is_help=True)

for name, sub in (
    ("config", config_app),
    ("compliance", compliance_app),
    ("calendar", calendar_app),
    ("posts", posts_app),
    ("products", products_app),
    ("qanda", qanda_app),
    ("reviews", reviews_app),
    ("photos", photos_app),
    ("rank", rank_app),
    ("audit", audit_app),
    ("report", report_app),
):
    app.add_typer(sub, name=name)


def _command_name(command) -> str:
    if command.name:
        return command.name
    return command.callback.__name__.replace("_", "-") if command.callback else "?"


def _command_help(command) -> str:
    doc = (command.callback.__doc__ or "") if command.callback else ""
    return (doc.strip().splitlines() or [""])[0]


def _not_built(phase: int, what: str) -> None:
    typer.secho(
        f"{what} lands in Phase {phase}. Phase 1 (config + compliance gate) is the "
        "only thing wired up so far - see README 'Build order'.",
        fg=typer.colors.YELLOW,
        err=True,
    )
    raise typer.Exit(2)


# --------------------------------------------------------------------------
# top level
# --------------------------------------------------------------------------


@app.command()
def version() -> None:
    """Print the toolkit version."""
    typer.echo(__version__)


@app.command()
def commands() -> None:
    """List every command in the tool, flat."""
    rows: list[tuple[str, str]] = []
    for group, sub in _GROUPS.items():
        for command in sub.registered_commands:
            rows.append((f"{group} {_command_name(command)}", _command_help(command)))
    for command in app.registered_commands:
        rows.append((_command_name(command), _command_help(command)))
    width = max(len(name) for name, _ in rows)
    for name, doc in rows:
        typer.echo(f"  llm-seo {name:<{width}}  {doc}")


# --------------------------------------------------------------------------
# config
# --------------------------------------------------------------------------


@config_app.command("show")
def config_show() -> None:
    """Print the resolved business config and its open gaps."""
    try:
        business = load_business()
    except (ValidationError, FileNotFoundError) as exc:
        typer.secho(f"config/business.yaml is invalid:\n{exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(1) from exc

    typer.secho(business.name, bold=True)
    typer.echo(f"  address   {business.address.formatted}")
    typer.echo(f"  phone     {business.contact.phone_display}")
    typer.echo(f"  website   {business.website.canonical_url}")
    typer.echo(f"  licence   {business.licence.number} ({business.licence.licensee_name})")
    typer.echo("  hours     " + "; ".join(f"{label} {window}" for label, window in business.hours.display()))
    typer.echo(f"  paths     {', '.join(business.website.site_paths)}")
    gaps = business.warnings()
    if gaps:
        typer.secho("\nOpen gaps (fill these in config/business.yaml):", fg=typer.colors.YELLOW)
        for gap in gaps:
            typer.echo(f"  - {gap}")


@config_app.command("validate")
def config_validate(
    strict: bool = typer.Option(False, "--strict", help="Exit non-zero if any gap is open."),
) -> None:
    """Validate every config file. Exits non-zero on a schema error."""
    try:
        business = load_business()
        blocklist = load_blocklist()
    except (ValidationError, FileNotFoundError, ValueError) as exc:
        typer.secho(f"invalid config: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(1) from exc

    terms = sum(len(v) for k, v in blocklist.items() if k != "allow_phrases")
    typer.secho(f"config OK - {terms} blocked terms across {len(blocklist) - 1} lists", fg=typer.colors.GREEN)
    gaps = business.warnings()
    for gap in gaps:
        typer.secho(f"  gap: {gap}", fg=typer.colors.YELLOW)
    if gaps and strict:
        raise typer.Exit(1)


# --------------------------------------------------------------------------
# compliance
# --------------------------------------------------------------------------


@compliance_app.command("check")
def compliance_check_cmd(
    text: Optional[str] = typer.Argument(None, help="Copy to check. Omit to read stdin."),
    file: Optional[Path] = typer.Option(None, "--file", "-f", exists=True, help="Check a file instead."),
    kind: str = typer.Option("alcohol", "--kind", help="alcohol | zero_alcohol | non_alcohol"),
    surface: str = typer.Option("post", "--surface", help="post | product | qanda | review_reply | photo_caption | profile"),
    link: list[str] = typer.Option([], "--link", help="CTA destination not present in the text. Repeatable."),
) -> None:
    """Check one piece of copy against every compliance rule."""
    from .compliance import compliance_check

    if file is not None:
        body = file.read_text(encoding="utf-8")
    elif text is not None:
        body = text
    else:
        body = sys.stdin.read()

    try:
        result = compliance_check(body, kind=kind, surface=surface, links=link)
    except ValueError as exc:
        typer.secho(str(exc), fg=typer.colors.RED, err=True)
        raise typer.Exit(2) from exc

    colour = typer.colors.GREEN if result.ok else typer.colors.RED
    typer.secho(result.report(), fg=colour)
    raise typer.Exit(0 if result.ok else 1)


@compliance_app.command("footer")
def compliance_footer() -> None:
    """Print the mandated licence footer for alcohol copy."""
    from .compliance import footer

    typer.echo(footer())


@compliance_app.command("scan")
def compliance_scan(
    directory: Path = typer.Argument(..., exists=True, file_okay=False, help="Folder of generated copy."),
) -> None:
    """Re-check every generated caption on disk. Exits non-zero on any violation."""
    _not_built(2, "compliance scan (it checks out/posts, which Phase 2 produces)")


# --------------------------------------------------------------------------
# Part A - content engine (Phase 2 / 4)
# --------------------------------------------------------------------------


@calendar_app.command("build")
def calendar_build(days: int = typer.Option(90, help="Calendar length in days.")) -> None:
    """Build the rolling 90-day content calendar."""
    _not_built(2, "calendar build")


@posts_app.command("generate")
def posts_generate(weeks: int = typer.Option(4, "--weeks", help="Weeks of posts to write.")) -> None:
    """Generate GBP posts as markdown captions plus posts.csv."""
    _not_built(2, "posts generate")


@products_app.command("build")
def products_build(input: Path = typer.Option(Path("data/products.csv"), "--input")) -> None:
    """Turn data/products.csv into GBP product tiles."""
    _not_built(2, "products build")


@qanda_app.command("build")
def qanda_build(count: int = typer.Option(25, "--count")) -> None:
    """Seed GBP questions and answers."""
    _not_built(2, "qanda build")


@reviews_app.command("draft")
def reviews_draft(input: Path = typer.Option(Path("data/reviews.csv"), "--input")) -> None:
    """Draft a reply for every review, escalating the ones I must handle myself."""
    _not_built(4, "reviews draft")


@photos_app.command("plan")
def photos_plan() -> None:
    """Write the photo shoot plan, naming convention and upload cadence."""
    _not_built(4, "photos plan")


# --------------------------------------------------------------------------
# Part B - rank + audit (Phase 3 / 4)
# --------------------------------------------------------------------------


@rank_app.command("grid")
def rank_grid(size: Optional[int] = typer.Option(None, "--size"), spacing: Optional[float] = typer.Option(None, "--spacing-km")) -> None:
    """Print the geo-grid that a scan would query."""
    _not_built(3, "rank grid")


@rank_app.command("scan")
def rank_scan(
    keywords: Path = typer.Option(Path("config/keywords.yaml"), "--keywords"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Fixture provider, zero API calls."),
) -> None:
    """Run a geo-grid rank scan and store the results."""
    _not_built(3, "rank scan")


@rank_app.command("score")
def rank_score(scan_id: Optional[str] = typer.Option(None, "--scan-id")) -> None:
    """Print ATRP, ARP and SoLV for a scan, with deltas against the previous one."""
    _not_built(3, "rank score")


@rank_app.command("heatmap")
def rank_heatmap(scan_id: Optional[str] = typer.Option(None, "--scan-id")) -> None:
    """Render the self-contained Leaflet heatmap for a scan."""
    _not_built(3, "rank heatmap")


@audit_app.command("profile")
def audit_profile() -> None:
    """Score our own GBP out of 100 and list the fixes by impact x effort."""
    _not_built(4, "audit profile")


@audit_app.command("site")
def audit_site(
    refresh_paths: bool = typer.Option(False, "--refresh-paths", help="Re-crawl sitemap.xml into site_paths."),
) -> None:
    """Check the live site: reachability, NAP match, hours, licence, JSON-LD, sitemap."""
    _not_built(4, "audit site")


@audit_app.command("competitors")
def audit_competitors(resolve: bool = typer.Option(False, "--resolve", help="Resolve place_ids first.")) -> None:
    """Pull nearby competitors and produce the gap list."""
    _not_built(4, "audit competitors")


@report_app.command("weekly")
def report_weekly() -> None:
    """Combine rank, reviews, posts and competitors into one weekly HTML report."""
    _not_built(4, "report weekly")


_GROUPS = {
    "config": config_app,
    "compliance": compliance_app,
    "calendar": calendar_app,
    "posts": posts_app,
    "products": products_app,
    "qanda": qanda_app,
    "reviews": reviews_app,
    "photos": photos_app,
    "rank": rank_app,
    "audit": audit_app,
    "report": report_app,
}


if __name__ == "__main__":  # pragma: no cover
    app()
