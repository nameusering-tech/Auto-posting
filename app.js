(function () {
  "use strict";

  const CHROMIUM_FILE_SHARE_LIMIT_BYTES = 50 * 1024 * 1024;
  const SUPPORTED_MEDIA_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/mpeg",
    "video/ogg",
  ]);

  const shareForm = document.querySelector("#share-form");
  const mediaInput = document.querySelector("#media-input");
  const captionInput = document.querySelector("#caption-input");
  const statusMessage = document.querySelector("#status-message");
  const fallbackPanel = document.querySelector("#fallback-panel");
  const imagePreview = document.querySelector("#image-preview");
  const videoPreview = document.querySelector("#video-preview");
  const copyCaptionButton = document.querySelector("#copy-caption-button");
  const downloadMediaLink = document.querySelector("#download-media-link");

  const diagnostics = {
    share: document.querySelector("#diag-share"),
    canShare: document.querySelector("#diag-can-share"),
    fileShare: document.querySelector("#diag-file-share"),
    fileType: document.querySelector("#diag-file-type"),
    fileSize: document.querySelector("#diag-file-size"),
    chromiumLimit: document.querySelector("#diag-chromium-limit"),
    platform: document.querySelector("#diag-platform"),
    userAgent: document.querySelector("#diag-user-agent"),
  };

  let selectedFile = null;
  let previewUrl = "";

  function logStep(message, details) {
    if (details === undefined) {
      console.log(`[Web Share PoC] ${message}`);
      return;
    }

    console.log(`[Web Share PoC] ${message}`, details);
  }

  function setStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = "status-message";

    if (type) {
      statusMessage.classList.add(type);
    }

    logStep("Status updated", { message, type: type || "default" });
  }

  function yesNo(value) {
    return value ? "Yes" : "No";
  }

  function isSupportedMedia(file) {
    return file && SUPPORTED_MEDIA_TYPES.has(file.type);
  }

  function isImage(file) {
    return file && file.type.startsWith("image/");
  }

  function isVideo(file) {
    return file && file.type.startsWith("video/");
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) {
      return "Unknown";
    }

    const mib = bytes / (1024 * 1024);
    const mb = bytes / 1000 / 1000;
    return `${mib.toFixed(2)} MiB (${mb.toFixed(2)} MB)`;
  }

  function getChromiumLimitStatus(file) {
    if (!file) {
      return "Select a media file";
    }

    if (isAboveChromiumLimit(file)) {
      return "Above 50 MiB. Chrome/Edge may reject before opening share sheet.";
    }

    return "At or below 50 MiB.";
  }

  function isAboveChromiumLimit(file) {
    return file && file.size > CHROMIUM_FILE_SHARE_LIMIT_BYTES;
  }

  function canShareSelectedFile(file) {
    if (!navigator.canShare || !isSupportedMedia(file)) {
      return false;
    }

    try {
      return navigator.canShare({ files: [file] });
    } catch (error) {
      logStep("navigator.canShare threw an error", error);
      return false;
    }
  }

  function updateDiagnostics(file) {
    const shareSupported = typeof navigator.share === "function";
    const canShareSupported = typeof navigator.canShare === "function";
    const fileSharingSupported = canShareSelectedFile(file);
    const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown";
    const userAgent = navigator.userAgent || "Unknown";

    diagnostics.share.textContent = yesNo(shareSupported);
    diagnostics.canShare.textContent = yesNo(canShareSupported);
    diagnostics.fileShare.textContent = file ? yesNo(fileSharingSupported) : "Select a media file";
    diagnostics.fileType.textContent = file ? file.type || "Unknown" : "Select a media file";
    diagnostics.fileSize.textContent = file ? formatBytes(file.size) : "Select a media file";
    diagnostics.chromiumLimit.textContent = getChromiumLimitStatus(file);
    diagnostics.platform.textContent = platform;
    diagnostics.userAgent.textContent = userAgent;

    logStep("Diagnostics updated", {
      shareSupported,
      canShareSupported,
      fileSharingSupported,
      platform,
      userAgent,
      file: file
        ? {
            name: file.name,
            type: file.type,
            size: file.size,
          }
        : null,
    });
  }

  function resetPreviewUrl() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      logStep("Previous preview URL revoked");
    }

    previewUrl = "";
  }

  function showFallback(file) {
    if (!file) {
      logStep("Fallback requested without a file");
      return;
    }

    resetPreviewUrl();
    previewUrl = URL.createObjectURL(file);

    imagePreview.hidden = true;
    videoPreview.hidden = true;
    imagePreview.removeAttribute("src");
    videoPreview.removeAttribute("src");

    if (isVideo(file)) {
      videoPreview.src = previewUrl;
      videoPreview.hidden = false;
      logStep("Video preview prepared");
    } else {
      imagePreview.src = previewUrl;
      imagePreview.hidden = false;
      logStep("Image preview prepared");
    }

    downloadMediaLink.href = previewUrl;
    downloadMediaLink.download = file.name || "shared-media";
    fallbackPanel.hidden = false;

    logStep("Fallback displayed", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  }

  function hideFallback() {
    fallbackPanel.hidden = true;
    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;
    videoPreview.pause();
    videoPreview.removeAttribute("src");
    videoPreview.hidden = true;
    downloadMediaLink.href = "#";
    downloadMediaLink.removeAttribute("download");
    resetPreviewUrl();
    logStep("Fallback hidden");
  }

  async function copyCaption() {
    const caption = captionInput.value.trim();

    logStep("Copy caption clicked", { captionLength: caption.length });

    if (!caption) {
      setStatus("Caption is empty. Nothing to copy.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(caption);
      setStatus("Caption copied to clipboard.", "success");
      logStep("Caption copied with Clipboard API");
    } catch (error) {
      logStep("Clipboard API failed", error);
      setStatus("Could not copy automatically. Select the caption and copy it manually.", "error");
    }
  }

  async function handleShare(event) {
    event.preventDefault();
    logStep("Share form submitted");

    const caption = captionInput.value.trim();

    if (!selectedFile) {
      setStatus("Choose an image or video file first.", "error");
      hideFallback();
      return;
    }

    if (!isSupportedMedia(selectedFile)) {
      setStatus("This test supports JPG, PNG, MP4, MOV, WebM, MPEG, and OGG media.", "error");
      showFallback(selectedFile);
      return;
    }

    const nativeShareSupported = typeof navigator.share === "function";
    const fileShareSupported = canShareSelectedFile(selectedFile);

    logStep("Share support evaluated", {
      nativeShareSupported,
      fileShareSupported,
      captionLength: caption.length,
      fileSize: selectedFile.size,
      fileType: selectedFile.type,
      chromiumLimitBytes: CHROMIUM_FILE_SHARE_LIMIT_BYTES,
    });

    if (nativeShareSupported && fileShareSupported) {
      try {
        await navigator.share({
          files: [selectedFile],
          text: caption,
          title: "Share Test",
        });

        setStatus("Native share completed or handed off successfully.", "success");
        hideFallback();
        logStep("navigator.share completed");
        return;
      } catch (error) {
        logStep("navigator.share failed or was cancelled", error);

        if (error.name === "AbortError") {
          setStatus("Native share was cancelled. Fallback is available below.", "error");
        } else {
          setStatus("Native share failed. Fallback is available below.", "error");
        }

        showFallback(selectedFile);
        return;
      }
    }

    setStatus("Native file sharing is not supported here. Use the fallback below.", "error");
    showFallback(selectedFile);
  }

  function handleMediaSelection() {
    const [file] = mediaInput.files;
    selectedFile = file || null;

    logStep("Media selection changed", selectedFile
      ? {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
        }
      : null);

    updateDiagnostics(selectedFile);

    if (!selectedFile) {
      setStatus("Waiting for a media file.");
      hideFallback();
      return;
    }

    if (!isSupportedMedia(selectedFile)) {
      setStatus("Unsupported MIME type. The fallback preview may still try to load it.", "error");
      showFallback(selectedFile);
      return;
    }

    if (isAboveChromiumLimit(selectedFile)) {
      setStatus(
        `${isVideo(selectedFile) ? "Video" : "Image"} selected, but it is above Chromium's 50 MiB threshold. Press Share to test real behavior.`
      );
    } else {
      setStatus(`${isVideo(selectedFile) ? "Video" : "Image"} selected. Press Share to test native sharing.`);
    }

    hideFallback();
  }

  window.addEventListener("beforeunload", resetPreviewUrl);
  mediaInput.addEventListener("change", handleMediaSelection);
  shareForm.addEventListener("submit", handleShare);
  copyCaptionButton.addEventListener("click", copyCaption);

  updateDiagnostics(null);
  logStep("App initialized");
})();
