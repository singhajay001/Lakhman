"""Scheduled jobs.

Phase 1 runs two: ingest the inbox hourly, and send the weekly report on Monday
morning. Both are no-ops when their feature flag is off.
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from agent.config import settings
from agent.ingest.myfoodlink import ingest
from agent.notify import telegram
from agent.reporting import weekly

log = logging.getLogger(__name__)


def job_ingest() -> None:
    log.info("ingest: %s", ingest(settings.inbox_dir))


def job_weekly_report() -> None:
    telegram.send_message(weekly.build(window_days=7))


def build_scheduler() -> BackgroundScheduler | None:
    if not settings.enable_scheduler:
        log.info("scheduler disabled by config")
        return None
    scheduler = BackgroundScheduler(timezone="Australia/Sydney")
    scheduler.add_job(job_ingest, CronTrigger(minute=15), id="ingest",
                      replace_existing=True)
    scheduler.add_job(job_weekly_report, CronTrigger(day_of_week="mon", hour=7),
                      id="weekly_report", replace_existing=True)
    return scheduler
