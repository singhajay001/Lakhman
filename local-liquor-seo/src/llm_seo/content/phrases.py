"""Local-intent search phrases used in generated copy.

A phrase carries the article that reads correctly in front of it and whether it
names the shop or something you drink. Without those two facts the copy comes
out as "Looking for bottle shop in Marsfield" and "Buying a bottle shop near
Eastwood to go with dinner" - grammatically wrong in the first case and
nonsense in the second.
"""

from __future__ import annotations

import functools
from typing import Literal

from pydantic import BaseModel, ConfigDict

from ..business import load_keywords

PhraseKind = Literal["place", "product"]


class Phrase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    text: str
    article: str = ""
    kind: PhraseKind = "place"

    @property
    def with_article(self) -> str:
        return f"{self.article} {self.text}".strip()

    @property
    def sentence_case(self) -> str:
        phrase = self.with_article
        return phrase[:1].upper() + phrase[1:]


@functools.lru_cache(maxsize=1)
def load_phrases() -> tuple[Phrase, ...]:
    raw = load_keywords()["content_phrases"]
    return tuple(Phrase.model_validate(entry) for entry in raw)


def phrases_for(kinds: list[str] | tuple[str, ...] | None = None) -> tuple[Phrase, ...]:
    if not kinds:
        return load_phrases()
    wanted = set(kinds)
    return tuple(phrase for phrase in load_phrases() if phrase.kind in wanted)


def lookup(text: str) -> Phrase:
    for phrase in load_phrases():
        if phrase.text == text:
            return phrase
    # A calendar built from an edited CSV can name a phrase we no longer carry;
    # fall back to the bare text rather than failing the whole run.
    return Phrase(text=text, article="", kind="place")


def reset_cache() -> None:
    load_phrases.cache_clear()
