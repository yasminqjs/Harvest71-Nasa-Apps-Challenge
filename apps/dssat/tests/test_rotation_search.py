from datetime import date

from rotation_search import _candidate_orders


def test_search_uses_only_verified_adjacent_pairs_and_respects_budget():
    pairs = {frozenset(("MZ", "CP")), frozenset(("MZ", "SG"))}
    dates = (date(1992, 1, 15), date(1992, 6, 15), date(1993, 1, 15))
    orders, eligible, calendar_filtered, pair_filtered = _candidate_orders(
        ("CP", "MZ", "SG"), dates, 2, pairs
    )
    assert eligible == 6
    assert pair_filtered == 6
    assert calendar_filtered == 0
    assert len(orders) == 2
    assert tuple(map(len, orders)) == (3, 2)
    for order in orders:
        assert all(frozenset(pair) in pairs for pair in zip(order, order[1:]))
