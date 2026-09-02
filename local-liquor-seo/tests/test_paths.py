"""Path resolution has to work from any working directory - the CLI is run from
wherever the operator happens to be."""

from __future__ import annotations

import pytest

from llm_seo import paths


@pytest.fixture()
def unpinned(monkeypatch):
    monkeypatch.delenv("LLM_SEO_ROOT", raising=False)


def test_root_is_found_by_walking_up(unpinned, monkeypatch):
    root = paths.project_root(start=paths.Path(__file__).parent)
    assert (root / "config" / "business.yaml").is_file()


def test_root_is_found_from_a_nested_directory(unpinned):
    nested = paths.Path(__file__).parent / "fixtures"
    assert paths.project_root(start=nested) == paths.project_root(start=nested.parent)


def test_root_override_wins(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_SEO_ROOT", str(tmp_path))
    assert paths.project_root() == tmp_path.resolve()


def test_an_unrelated_directory_falls_back_to_the_installed_package(unpinned, tmp_path):
    """Running from /tmp still finds the config that ships beside the package."""
    assert (paths.project_root(start=tmp_path) / "config" / "business.yaml").is_file()


def test_a_genuinely_missing_config_raises(unpinned, tmp_path, monkeypatch):
    monkeypatch.setattr(paths, "_MARKER", paths.Path("config") / "nope.yaml")
    with pytest.raises(FileNotFoundError, match="nope.yaml"):
        paths.project_root(start=tmp_path)


def test_data_and_out_directories_are_created(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_SEO_ROOT", str(tmp_path))
    assert paths.data_dir().is_dir()
    assert paths.out_dir().is_dir()
    assert paths.config_dir() == tmp_path.resolve() / "config"
