# Dock icons

Drop PNGs here. They are served from the site root, so `gmail.png` in this
folder is referenced as `/icons/gmail.png`.

Wire each one up in [`src/data/seed/bookmarks.json`](../../src/data/seed/bookmarks.json):

```json
{ "id": "gmail", "label": "Gmail", "url": "https://mail.google.com", "icon": "/icons/gmail.png" }
```

Guidelines:

- **Square**, 256×256 or larger — the dock renders them up to ~75px when magnified.
- **Transparent background** unless you want a visible tile edge.
- Any bookmark whose icon is missing or fails to load falls back to a lettered
  tile automatically, so a broken path never leaves a blank gap.
