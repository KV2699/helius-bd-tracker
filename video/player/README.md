# VERBATIM — the browser player

A standalone copy of the film that **plays in real time**, built from the same
scene files the renderer uses. For screen-recording with narration.

```
open video/player/index.html     (or serve the repo and visit /video/player/)
```

Click once to start. It fits 1920×1080 to whatever window you record in.

**The audio owns the clock.** When `assets/voice/narration.wav` is present and
longer than a second, the picture is driven by the audio element's own
`currentTime`, so voice and picture cannot drift. With no audio it falls back to
a wall clock and plays silently.

Driven by `requestAnimationFrame` **and** a 60 Hz timer: rAF does not fire in a
background or hidden tab, which would freeze the picture while the audio kept
playing. The timer keeps it honest if the window loses focus mid-recording.

To change the narration, replace `assets/voice/narration.wav` and reload.
