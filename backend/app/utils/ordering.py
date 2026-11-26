"""FLOAT ``order`` strategy shared by columns and cards (guideline DB-03).

The client sends the new ``order`` of the one item it moved (midpoint, half of the
first, or last + 1024). The server stores it and renumbers the whole list only
when two neighbours end up closer than ``MIN_GAP``.
"""

ORDER_STEP = 1024.0
MIN_GAP = 1e-6


def next_order(last_order: float | None) -> float:
    """Order for an item appended to a list whose current last order is ``last_order``."""
    return ORDER_STEP if last_order is None else last_order + ORDER_STEP


def needs_rebalance(orders: list[float]) -> bool:
    """True when two neighbours, or the first item and zero, are closer than ``MIN_GAP``."""
    previous = 0.0
    for order in sorted(orders):
        if order - previous < MIN_GAP:
            return True
        previous = order
    return False


def rebalance_if_needed(items: list) -> bool:
    """Renumber ``items`` to 1024, 2048, ... keeping their relative order, if they are too close.

    ``items`` must be every item of one list (all columns of a board, or all active
    cards of a column). Returns whether a renumbering happened. Does not commit.
    """
    if not needs_rebalance([item.order for item in items]):
        return False
    ranked = sorted(items, key=lambda item: (item.order, item.created_at, str(item.id)))
    for position, item in enumerate(ranked, start=1):
        item.order = position * ORDER_STEP
    return True
