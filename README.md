# Web Share API Proof of Concept

Static HTML, CSS, and JavaScript test page for checking Web Share API file sharing behavior on:

- iPhone Safari
- Android Chrome
- macOS Safari
- macOS Chrome

## What it does

1. Select a JPG or PNG image.
2. Enter a caption.
3. Click **Share**.
4. If `navigator.share` and file sharing are supported, the app calls:

```js
navigator.share({
  files: [image],
  text: caption,
  title: "Share Test",
});
```

If native file sharing is not supported or sharing fails, the fallback shows:

- image preview
- copy caption button
- download image button

The diagnostics panel shows browser support flags, platform, and user agent.

## GitHub Pages

This project works from the repository root on GitHub Pages. No build step is required.
