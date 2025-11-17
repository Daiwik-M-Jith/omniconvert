from __future__ import annotations

from typing import Callable

from ..services.registry import registry, ConverterFunc


def register_converter(source: str, target: str, note: str | None = None) -> Callable[[ConverterFunc], ConverterFunc]:
    def decorator(func: ConverterFunc) -> ConverterFunc:
        registry.register(source, target, func, note)
        return func

    return decorator
