"""The CLI surface is part of the contract: every command is discoverable from
`--help` even while its implementation is still on the build plan."""

from __future__ import annotations

import pytest
from typer.testing import CliRunner

from llm_seo.cli import app
from llm_seo.compliance import footer
from llm_seo.paths import project_root

ROOT = project_root()

runner = CliRunner()

GROUPS = [
    "config", "compliance", "calendar", "posts", "products", "qanda",
    "reviews", "photos", "rank", "audit", "report",
]


def test_help_lists_every_command_group():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for group in GROUPS:
        assert group in result.stdout


@pytest.mark.parametrize("group", GROUPS)
def test_each_group_has_at_least_one_command(group):
    result = runner.invoke(app, [group, "--help"])
    assert result.exit_code == 0


def test_commands_prints_the_flat_tree():
    result = runner.invoke(app, ["commands"])
    assert result.exit_code == 0
    for expected in ("rank scan", "audit site", "posts generate", "report weekly",
                     "reviews draft", "photos plan", "qanda build", "products build",
                     "calendar build", "compliance check", "config validate"):
        assert expected in result.stdout


def test_version():
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0 and result.stdout.strip()


def test_config_validate_passes_on_the_shipped_config():
    result = runner.invoke(app, ["config", "validate"])
    assert result.exit_code == 0
    assert "config OK" in result.stdout


def test_config_validate_strict_fails_while_gaps_remain():
    result = runner.invoke(app, ["config", "validate", "--strict"])
    assert result.exit_code == 1


def test_config_show_reports_the_open_gaps():
    result = runner.invoke(app, ["config", "show"])
    assert result.exit_code == 0
    assert "Open gaps" in result.stdout


def test_compliance_check_exits_zero_on_clean_copy(biz):
    text = f"Cold beer in the fridge today.\n\n{footer(biz)}"
    result = runner.invoke(app, ["compliance", "check", text])
    assert result.exit_code == 0
    assert "PASS" in result.stdout


def test_compliance_check_exits_one_on_a_violation():
    result = runner.invoke(app, ["compliance", "check", "Get smashed tonight."])
    assert result.exit_code == 1
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in result.stdout


def test_compliance_check_reads_stdin():
    result = runner.invoke(app, ["compliance", "check"], input="Get smashed tonight.")
    assert result.exit_code == 1


def test_compliance_check_reads_a_file(tmp_path, biz):
    path = tmp_path / "caption.md"
    path.write_text(f"Cold beer today.\n\n{footer(biz)}", encoding="utf-8")
    result = runner.invoke(app, ["compliance", "check", "--file", str(path)])
    assert result.exit_code == 0


def test_compliance_check_rejects_an_unknown_surface():
    result = runner.invoke(app, ["compliance", "check", "hi", "--surface", "billboard"])
    assert result.exit_code == 2


def test_compliance_footer_prints_the_licence_block(biz):
    result = runner.invoke(app, ["compliance", "footer"])
    assert result.exit_code == 0
    assert biz.licence.number in result.stdout


@pytest.mark.parametrize(
    "argv",
    [
        ["products", "build"], ["reviews", "draft"], ["photos", "plan"],
        ["rank", "grid"], ["rank", "scan"], ["rank", "score"], ["rank", "heatmap"],
        ["audit", "profile"], ["audit", "site"], ["audit", "competitors"],
        ["report", "weekly"],
    ],
)
def test_unbuilt_commands_say_which_phase_they_land_in(argv):
    result = runner.invoke(app, argv)
    assert result.exit_code == 2
    assert "Phase" in result.stderr


# --------------------------------------------------------------------------
# Phase 2 commands
# --------------------------------------------------------------------------


def test_calendar_build_writes_a_plan(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("LLM_SEO_ROOT", str(ROOT))
    result = runner.invoke(app, ["calendar", "build", "--days", "30", "--start", "2026-09-07"])
    assert result.exit_code == 0
    assert "posts planned" in result.stdout
    assert (ROOT / "out" / "calendar.csv").is_file()


def test_calendar_build_surfaces_the_rotation_shortfall():
    result = runner.invoke(app, ["calendar", "build", "--days", "90", "--start", "2026-09-07"])
    assert result.exit_code == 0
    assert "warning" in result.stdout


def test_posts_generate_writes_twelve_ready_posts():
    result = runner.invoke(app, ["posts", "generate", "--weeks", "4", "--start", "2026-09-07"])
    assert result.exit_code == 0
    assert "12 posts written" in result.stdout
    assert "12 ready to paste" in result.stdout


def test_posts_lint_passes_on_the_shipped_copy_bank():
    result = runner.invoke(app, ["posts", "lint"])
    assert result.exit_code == 0
    assert "inside the limits" in result.stdout


def test_qanda_build_writes_answers_and_a_checklist():
    result = runner.invoke(app, ["qanda", "build"])
    assert result.exit_code == 0
    assert "answers written" in result.stdout
    assert "need a decision from you" in result.stdout


def test_compliance_scan_passes_over_the_generated_posts():
    runner.invoke(app, ["posts", "generate", "--weeks", "4", "--start", "2026-09-07"])
    result = runner.invoke(app, ["compliance", "scan"])
    assert result.exit_code == 0
    assert "pass every rule" in result.stdout


def test_compliance_scan_reports_a_bad_caption(tmp_path):
    (tmp_path / "2026-01-01_bad.md").write_text(
        "---\ntheme: occasion\n---\n\nGet smashed this weekend.\n", encoding="utf-8"
    )
    result = runner.invoke(app, ["compliance", "scan", str(tmp_path)])
    assert result.exit_code == 1
    assert "R3_IRRESPONSIBLE_CONSUMPTION" in result.stderr


def test_compliance_scan_explains_an_empty_folder(tmp_path):
    result = runner.invoke(app, ["compliance", "scan", str(tmp_path / "nope")])
    assert result.exit_code == 2
