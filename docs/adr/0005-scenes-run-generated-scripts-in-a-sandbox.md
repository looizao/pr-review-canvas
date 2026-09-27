# Scenes run the generator's scripts in a frame with no origin

A decision card's scenes are generated HTML, first drawn from a kit of CSS classes in a frame that
ran no script. That kept them safe but narrow: every scene the generators wrote came out as the same
box, arrow, and banner. Scenes may now carry their own styles and scripts, so the generator can draw
where a consequence lands (a screen, a terminal, a chart, an animated flow), guided by the skill's
scene guide.

The frame is the boundary. It runs under `sandbox allow-scripts` with no origin, so a script cannot
read the deck page, the API, or this server's storage; its policy allows inline code only and no
network, forms, popups, or navigation of the deck page; it loads nothing, since the kit and a small
runtime are inlined by the server. The frame is `inert`, and the deck page takes back any focus a
script grabs, so the deck's keys keep working. The deck page and the frame talk by message: the
runtime reports the scene's size and hears when its side is picked. Validation also names the
network, storage, eval, and worker calls a script would find blocked, but it is a lint, not the
boundary.

## Considered options

- **Keep the no-script kit and grow it.** No generated code ever runs, but every new kind of picture
  waits on a kit change, and the scenes stay templated.
- **A p5 sketch per side**, tried earlier on this branch. Scripts ran sandboxed too, but the
  generator drew text by coordinates without seeing the result, and labels collided. Scenes keep
  words in HTML, laid out by the browser, and use scripts for shapes and motion.

## Consequences

- A content security policy does not govern WebRTC, so a script could still open a peer
  connection and send out what the scene contains. A scene contains what the generator wrote into
  it, and the generator already reads the repository, so this adds no reach over the code; it
  does mean a prompt-injected generator could leak through a scene the author merely opens.
- A script that loops forever hangs the frame, and in browsers that do not isolate sandboxed
  frames in their own process, the deck page with it. Reloading the page recovers.
