from collections import defaultdict, deque
from typing import Callable, Dict, Tuple, Any

ConverterFunc = Callable[[bytes, str], Tuple[bytes, str]]


class ConversionRegistry:
    def __init__(self) -> None:
        self._converters: Dict[Tuple[str, str], ConverterFunc] = {}
        self._notes: Dict[Tuple[str, str], str] = {}
        self._sources: Dict[str, set[str]] = defaultdict(set)

    def register(self, source: str, target: str, func: ConverterFunc, note: str | None = None) -> None:
        key = (source.lower(), target.lower())
        self._converters[key] = func
        if note:
            self._notes[key] = note
        self._sources[key[0]].add(key[1])

    def resolve(self, source: str, target: str) -> ConverterFunc:
        key = (source.lower(), target.lower())
        if key not in self._converters:
            raise KeyError(f"Conversion {source}->{target} not registered")
        return self._converters[key]

    def find_chain(self, source: str, target: str, exclude: set[tuple[str, str]] | None = None) -> list[Tuple[ConverterFunc, str]]:
        """Find a chain of converter functions from source to target.

        Returns a list of (converter_func, next_ext) where each converter_func converts to next_ext.
        Raises KeyError if no chain exists.
        """
        source = source.lower()
        target = target.lower()
        exclude = exclude or set()
        if source == target:
            return []
        from collections import deque

        queue = deque([[source]])
        visited = {source}
        while queue:
            path = queue.popleft()
            last = path[-1]
            for nxt in sorted(self._sources.get(last, [])):
                if (last, nxt) in exclude:
                    # Skip explicitly excluded directed edge
                    continue
                if nxt in visited:
                    continue
                new_path = path + [nxt]
                visited.add(nxt)
                if nxt == target:
                    # Build converter chain
                    funcs = []
                    for i in range(len(new_path) - 1):
                        converter_func = self._converters[(new_path[i], new_path[i + 1])]
                        funcs.append((converter_func, new_path[i + 1]))
                    return funcs
                queue.append(new_path)
        raise KeyError(f"Conversion path {source}->{target} not registered")

    def describe(self) -> list[dict[str, Any]]:
        data: list[dict[str, Any]] = []
        for source, targets in sorted(self._sources.items()):
            targets_list = []
            for target in sorted(targets):
                targets_list.append({"ext": target, "note": self._notes.get((source, target))})
            data.append({
                "source": source,
                "targets": targets_list,
            })
        return data

    def _bfs_paths(self, source: str) -> dict[str, list[str]]:
        paths: dict[str, list[str]] = {}
        queue: deque[list[str]] = deque([[source]])
        visited = {source}
        while queue:
            path = queue.popleft()
            last = path[-1]
            for nxt in sorted(self._sources.get(last, [])):
                if nxt in visited:
                    continue
                visited.add(nxt)
                new_path = path + [nxt]
                paths[nxt] = new_path
                queue.append(new_path)
        return paths

    def describe_reachable(self) -> list[dict[str, Any]]:
        data: list[dict[str, Any]] = []
        for source in sorted(self._sources.keys()):
            paths = self._bfs_paths(source)
            targets: list[dict[str, Any]] = []
            for target, path in sorted(paths.items()):
                chain_len = max(len(path) - 1, 1)
                key = (source, target)
                targets.append({
                    "ext": target,
                    "direct": key in self._converters,
                    "via_chain": chain_len > 1,
                    "chain_len": chain_len,
                    "path": path,
                    "note": self._notes.get(key),
                })
            data.append({"source": source, "targets": targets})
        return data


registry = ConversionRegistry()
