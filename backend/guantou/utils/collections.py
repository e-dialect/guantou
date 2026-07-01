def order_by_id_list(items, ids):
    positions = {item_id: index for index, item_id in enumerate(ids)}
    result = [None] * len(ids)
    for item in items:
        if item.id in positions:
            result[positions[item.id]] = item
    return [item for item in result if item is not None]
