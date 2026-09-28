# Tour prototype

A scripted, static prototype of the tour described in [docs/tour-design.md](../../docs/tour-design.md).
Nothing here talks to a server, an agent, or a forge: the chat, the quiz, and the sharing are
scripted from the data files so the flow and the look can be iterated on before anything is built.
It is deleted before the design is merged.

```bash
node prototype/tour/serve.mjs      # then open http://localhost:3011/?pr=67 or ?pr=68
```

- `index.html`, `tour.css`, `tour.js`: the page. It loads the app's real stylesheet for tokens,
  the header, and the skins, and adds the tour's own rules and the mood catalog.
- `data/pr-67.js`, `data/pr-68.js`: tours written by hand from two merged pull requests, in the
  shape `data/SCHEMA.md` describes.
