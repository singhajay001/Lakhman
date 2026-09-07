"""Settings. Every secret comes from the environment; nothing is defaulted to a real value."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent


class LicensedHours(BaseSettings):
    """NSW packaged liquor trading hours for LIQP700301260.

    Monday is 0 and Sunday is 6, matching ``datetime.weekday()``. Windows are
    ``("HH:MM", "HH:MM")`` half-open on the right; ``"24:00"`` means midnight at
    the end of that day. ``None`` means no trading permitted.

    These are *supply* hours. Checkout time is only a proxy for supply, so the
    compliance check reports a straddle rather than a breach where the two could
    differ - see ``agent.analytics.compliance``.
    """

    windows: dict[int, tuple[str, str] | None] = {
        0: ("05:00", "24:00"),
        1: ("05:00", "24:00"),
        2: ("05:00", "24:00"),
        3: ("05:00", "24:00"),
        4: ("05:00", "24:00"),
        5: ("05:00", "24:00"),
        6: ("10:00", "22:00"),
    }


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- store identity -------------------------------------------------
    store_name: str = "Trafalgar Supermarket And Cellars"
    liquor_brand: str = "Local Liquor Marsfield"
    liquor_licence_name: str = "Trafalgar Cellars of Marsfield"
    liquor_licence_number: str = "LIQP700301260"

    # --- commercial assumptions ----------------------------------------
    # Charged on the marked-up price, so holding in-store margin needs an
    # uplift of commission/(1-commission), not commission. See README.
    uber_commission_rate: float = Field(0.30, ge=0.0, lt=1.0)
    gst_divisor: int = 11  # GST-inclusive prices: gst = taxable / 11

    # --- storage --------------------------------------------------------
    database_url: str = f"sqlite:///{REPO_ROOT / 'data' / 'agent.db'}"
    inbox_dir: Path = REPO_ROOT / "data" / "inbox"

    # --- integrations ---------------------------------------------------
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5"
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None

    # --- feature flags: every feature must be switchable off ------------
    enable_scheduler: bool = True
    enable_telegram: bool = True
    enable_llm_narrative: bool = True

    licensed_hours: LicensedHours = LicensedHours()


settings = Settings()
