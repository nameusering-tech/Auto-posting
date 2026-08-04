# Web Share API Proof of Concept

Static HTML, CSS, and JavaScript test page for checking Web Share API media sharing behavior on:

- iPhone Safari
- Android Chrome
- macOS Safari
- macOS Chrome

## What it does

1. Select a JPG, PNG, MP4, MOV, WebM, MPEG, or OGG media file.
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

- image or video preview
- copy caption button
- download media button

The diagnostics panel shows browser support flags, selected MIME type, file size, the Chromium 50 MiB threshold, platform, and user agent.

## Cloudinary + Make automation

The page also supports direct browser upload to Cloudinary with an unsigned upload preset. This is useful when a Make scenario starts with Cloudinary **Watch Uploaded Resources**.

Required Cloudinary values:

- Cloud name
- Unsigned upload preset
- Optional folder
- Optional tags

The upload uses:

```text
POST https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload
```

The selected file is sent as `file`, the preset as `upload_preset`, and the caption is stored in Cloudinary `context` under `caption`.

The page can also call a Make Custom Webhook after the Cloudinary upload succeeds. Paste the webhook URL into **Make webhook URL** and the page sends JSON containing:

- caption
- selected file name, MIME type, and size
- Cloudinary public ID
- Cloudinary secure URL
- video metadata when Cloudinary returns it

This avoids opening Make for manual `Run once` testing once the scenario is enabled.

Important: never expose a Cloudinary API secret in GitHub Pages or any public frontend. Use unsigned presets for this proof of concept, or move to signed uploads through a backend for production.

## Size notes

The Web Share API specification does not define one universal maximum file size. Chromium currently uses a 10-file and 50 MiB total file threshold for Web Share file payloads. Other browsers and share targets can apply their own limits.

`navigator.canShare({ files })` can still return `true` for a file above that threshold in some environments, so this PoC shows both the browser result and the explicit 50 MiB diagnostic.

For practical video testing, use MP4 with H.264 video and AAC audio, then test files around 5 MiB, 25 MiB, 50 MiB, and 75 MiB on the real target devices.

For direct Cloudinary browser uploads, keep proof-of-concept videos below 100 MiB. Larger uploads should use signed backend uploads or chunked upload support.

## GitHub Pages

This project works from the repository root on GitHub Pages. No build step is required.
