"""Project path resolution.

Everything the tools read (config) or write (data, out) is anchored to the
project root so the CLI behaves the same from any working directory.
"""

from __future__ import annotations

import os
from pathlib import Path

_MARKER = Path("config") / "business.yaml"


def project_root(start: Path | None = None) -> Path:
    """Nearest ancestor directory containing config/business.yaml.

    Overridable with LLM_SEO_ROOT, which is what the test suite uses to point
    the loaders at a fixture project.
    """
    override = os.environ.get("LLM_SEO_ROOT")
    if override:
        return Path(override).resolve()

    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / _MARKER).is_file():
            return candidate

    # Installed as a package: src/llm_seo/paths.py -> project root is two up from src.
    packaged = Path(__file__).resolve().parents[2]
    if (packaged / _MARKER).is_file():
        return packaged

    raise FileNotFoundError(
        f"Could not locate {_MARKER} above {here}. "
        "Run from inside the project, or set LLM_SEO_ROOT."
    )


def config_dir(start: Path | None = None) -> Path:
    return project_root(start) / "config"


def data_dir(start: Path | None = None) -> Path:
    d = project_root(start) / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


def out_dir(start: Path | None = None) -> Path:
    d = project_root(start) / "out"
    d.mkdir(parents=True, exist_ok=True)
    return d
