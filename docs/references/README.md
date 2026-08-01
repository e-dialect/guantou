# Historical Product References

This folder keeps older discussion artifacts that are useful for UI and issue writing.

These files are references, not the source of truth. When they conflict with the current product model, follow [PRODUCT_DESIGN.md](../PRODUCT_DESIGN.md).

## Files

- [visual-dictionary-v1.md](visual-dictionary-v1.md): early written interaction notes for the original "方言罐头" framing.
- [frontend-interaction-v2.html](frontend-interaction-v2.html): mobile wireframe preview with v1/v2 tabs. Open it in a browser when an issue needs more visual detail.

## Translation Rules

- "方言罐头" in old materials now maps to the current brand "乡声集盒".
- "货架" in old materials maps to user-facing "集盒"; code still uses `Shelf`.
- "风味" in old materials maps to user-facing "义项"; code uses `Flavor`.
- Old "词条详情" wireframes are split across current `Flavor` detail, `Package` detail, and `Can` detail pages.
- Old "采集表" ideas should be interpreted as either "为已有义项补录音" for v1 scope, or a later batch-collection workflow.
