(function () {
  "use strict";

  const CHROMIUM_FILE_SHARE_LIMIT_BYTES = 50 * 1024 * 1024;
  const CLOUDINARY_DIRECT_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;
  const CLOUDINARY_CONFIG_STORAGE_KEY = "web-share-poc-cloudinary-config";
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
  const cloudinaryForm = document.querySelector("#cloudinary-form");
  const cloudinaryCloudNameInput = document.querySelector("#cloudinary-cloud-name");
  const cloudinaryUploadPresetInput = document.querySelector("#cloudinary-upload-preset");
  const cloudinaryFolderInput = document.querySelector("#cloudinary-folder");
  const cloudinaryTagsInput = document.querySelector("#cloudinary-tags");
  const makeWebhookUrlInput = document.querySelector("#make-webhook-url");
  const cloudinaryUploadButton = document.querySelector("#cloudinary-upload-button");
  const cloudinaryStatus = document.querySelector("#cloudinary-status");
  const cloudinaryResult = document.querySelector("#cloudinary-result");
  const cloudinaryResultResourceType = document.querySelector("#cloudinary-result-resource-type");
  const cloudinaryResultPublicId = document.querySelector("#cloudinary-result-public-id");
  const cloudinaryResultUrl = document.querySelector("#cloudinary-result-url");
  const makeResultStatus = document.querySelector("#make-result-status");
  const copyCloudinaryUrlButton = document.querySelector("#copy-cloudinary-url-button");

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
  let lastCloudinaryUrl = "";

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

  function setCloudinaryStatus(message, type) {
    cloudinaryStatus.textContent = message;
    cloudinaryStatus.className = "status-message";

    if (type) {
      cloudinaryStatus.classList.add(type);
    }

    logStep("Cloudinary status updated", { message, type: type || "default" });
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

  function isAboveCloudinaryDirectUploadLimit(file) {
    return file && file.size > CLOUDINARY_DIRECT_UPLOAD_LIMIT_BYTES;
  }

  function getCloudinaryConfig() {
    return {
      cloudName: cloudinaryCloudNameInput.value.trim(),
      uploadPreset: cloudinaryUploadPresetInput.value.trim(),
      folder: cloudinaryFolderInput.value.trim(),
      tags: cloudinaryTagsInput.value.trim(),
      makeWebhookUrl: makeWebhookUrlInput.value.trim(),
    };
  }

  function saveCloudinaryConfig() {
    const config = getCloudinaryConfig();
    localStorage.setItem(CLOUDINARY_CONFIG_STORAGE_KEY, JSON.stringify(config));
    logStep("Cloudinary config saved", {
      cloudName: config.cloudName,
      hasUploadPreset: Boolean(config.uploadPreset),
      folder: config.folder,
      tags: config.tags,
      hasMakeWebhookUrl: Boolean(config.makeWebhookUrl),
    });
  }

  function loadCloudinaryConfig() {
    try {
      const storedConfig = JSON.parse(localStorage.getItem(CLOUDINARY_CONFIG_STORAGE_KEY) || "{}");

      cloudinaryCloudNameInput.value = storedConfig.cloudName || "";
      cloudinaryUploadPresetInput.value = storedConfig.uploadPreset || "";
      cloudinaryFolderInput.value = storedConfig.folder || "auto-posting-tests";
      cloudinaryTagsInput.value = storedConfig.tags || "web-share-poc,make-test";
      makeWebhookUrlInput.value = storedConfig.makeWebhookUrl || "";

      logStep("Cloudinary config loaded", {
        cloudName: cloudinaryCloudNameInput.value,
        hasUploadPreset: Boolean(cloudinaryUploadPresetInput.value),
        hasMakeWebhookUrl: Boolean(makeWebhookUrlInput.value),
      });
    } catch (error) {
      logStep("Cloudinary config load failed", error);
      cloudinaryFolderInput.value = "auto-posting-tests";
      cloudinaryTagsInput.value = "web-share-poc,make-test";
      makeWebhookUrlInput.value = "";
    }
  }

  function escapeCloudinaryContextValue(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\|/g, "\\|")
      .replace(/=/g, "\\=")
      .replace(/\r?\n/g, "\\n");
  }

  function buildCloudinaryContext(file, caption) {
    const context = {
      caption,
      original_filename: file.name,
      source: "github_pages_media_poc",
      selected_mime_type: file.type || "unknown",
      selected_size_bytes: String(file.size),
    };

    return Object.entries(context)
      .map(([key, value]) => `${key}=${escapeCloudinaryContextValue(value)}`)
      .join("|");
  }

  function buildCloudinaryTags(tags) {
    const baseTags = ["web-share-poc", "auto-posting"];
    const userTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    return Array.from(new Set([...baseTags, ...userTags])).join(",");
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

  function showCloudinaryResult(result) {
    lastCloudinaryUrl = result.secure_url || result.url || "";
    cloudinaryResultResourceType.textContent = result.resource_type || "Unknown";
    cloudinaryResultPublicId.textContent = result.public_id || "Unknown";
    cloudinaryResultUrl.textContent = lastCloudinaryUrl || "No URL returned";
    makeResultStatus.textContent = "Not sent";
    cloudinaryResult.hidden = false;

    logStep("Cloudinary upload result displayed", {
      publicId: result.public_id,
      resourceType: result.resource_type,
      secureUrl: result.secure_url,
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

  async function copyCloudinaryUrl() {
    if (!lastCloudinaryUrl) {
      setCloudinaryStatus("No Cloudinary URL to copy yet.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(lastCloudinaryUrl);
      setCloudinaryStatus("Cloudinary URL copied.", "success");
      logStep("Cloudinary URL copied");
    } catch (error) {
      logStep("Cloudinary URL copy failed", error);
      setCloudinaryStatus("Could not copy the Cloudinary URL automatically.", "error");
    }
  }

  function buildMakePayload(cloudinaryResultData, caption, file) {
    return {
      source: "github_pages_media_poc",
      created_at: new Date().toISOString(),
      caption,
      selected_file: {
        name: file.name,
        type: file.type || "unknown",
        size: file.size,
      },
      cloudinary: {
        asset_id: cloudinaryResultData.asset_id,
        public_id: cloudinaryResultData.public_id,
        resource_type: cloudinaryResultData.resource_type,
        type: cloudinaryResultData.type,
        format: cloudinaryResultData.format,
        bytes: cloudinaryResultData.bytes,
        width: cloudinaryResultData.width,
        height: cloudinaryResultData.height,
        duration: cloudinaryResultData.duration,
        secure_url: cloudinaryResultData.secure_url,
        url: cloudinaryResultData.url,
        playback_url: cloudinaryResultData.playback_url,
        created_at: cloudinaryResultData.created_at,
      },
    };
  }

  async function triggerMakeWebhook(webhookUrl, payload) {
    if (!webhookUrl) {
      makeResultStatus.textContent = "Skipped. No webhook URL configured.";
      logStep("Make webhook skipped");
      return;
    }

    makeResultStatus.textContent = "Sending...";
    logStep("Make webhook request prepared", {
      webhookUrl,
      publicId: payload.cloudinary.public_id,
      captionLength: payload.caption.length,
    });

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Make webhook failed with HTTP ${response.status}: ${responseText}`);
    }

    makeResultStatus.textContent = `Sent. HTTP ${response.status}`;
    logStep("Make webhook completed", {
      status: response.status,
      responseText,
    });
  }

  async function handleCloudinaryUpload(event) {
    event.preventDefault();
    logStep("Cloudinary upload submitted");

    const config = getCloudinaryConfig();
    const caption = captionInput.value.trim();

    if (!selectedFile) {
      setCloudinaryStatus("Choose an image or video file first.", "error");
      return;
    }

    if (!isSupportedMedia(selectedFile)) {
      setCloudinaryStatus("This Cloudinary test supports JPG, PNG, MP4, MOV, WebM, MPEG, and OGG media.", "error");
      return;
    }

    if (!config.cloudName || !config.uploadPreset) {
      setCloudinaryStatus("Cloud name and unsigned upload preset are required.", "error");
      return;
    }

    if (isAboveCloudinaryDirectUploadLimit(selectedFile)) {
      setCloudinaryStatus(
        "This file is above 100 MiB. Direct browser upload can fail; use a signed backend or chunked upload for large videos.",
        "error"
      );
      return;
    }

    saveCloudinaryConfig();
    cloudinaryUploadButton.disabled = true;
    cloudinaryResult.hidden = true;
    setCloudinaryStatus("Uploading to Cloudinary...", undefined);

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/auto/upload`;
    const formData = new FormData();

    formData.append("file", selectedFile);
    formData.append("upload_preset", config.uploadPreset);
    formData.append("tags", buildCloudinaryTags(config.tags));
    formData.append("context", buildCloudinaryContext(selectedFile, caption));
    formData.append("filename_override", selectedFile.name);

    if (config.folder) {
      formData.append("folder", config.folder);
    }

    logStep("Cloudinary upload request prepared", {
      endpoint,
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      fileSize: selectedFile.size,
      folder: config.folder,
      tags: buildCloudinaryTags(config.tags),
      captionLength: caption.length,
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Cloudinary upload failed with HTTP ${response.status}`);
      }

      showCloudinaryResult(result);
      setCloudinaryStatus("Uploaded to Cloudinary. Make can continue from the uploaded resource.", "success");
      logStep("Cloudinary upload completed", result);

      try {
        await triggerMakeWebhook(config.makeWebhookUrl, buildMakePayload(result, caption, selectedFile));
        if (config.makeWebhookUrl) {
          setCloudinaryStatus("Uploaded to Cloudinary and sent to Make.", "success");
        }
      } catch (makeError) {
        logStep("Make webhook failed", makeError);
        makeResultStatus.textContent = makeError.message || "Failed";
        setCloudinaryStatus("Cloudinary upload succeeded, but Make webhook failed.", "error");
      }
    } catch (error) {
      logStep("Cloudinary upload failed", error);
      setCloudinaryStatus(error.message || "Cloudinary upload failed.", "error");
    } finally {
      cloudinaryUploadButton.disabled = false;
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

    if (isAboveCloudinaryDirectUploadLimit(selectedFile)) {
      setCloudinaryStatus("Selected file is above 100 MiB. Use signed backend or chunked upload for Cloudinary.", "error");
    } else {
      setCloudinaryStatus("Ready to upload to Cloudinary when cloud name and preset are set.");
    }

    hideFallback();
  }

  window.addEventListener("beforeunload", resetPreviewUrl);
  mediaInput.addEventListener("change", handleMediaSelection);
  shareForm.addEventListener("submit", handleShare);
  cloudinaryForm.addEventListener("submit", handleCloudinaryUpload);
  copyCaptionButton.addEventListener("click", copyCaption);
  copyCloudinaryUrlButton.addEventListener("click", copyCloudinaryUrl);

  loadCloudinaryConfig();
  updateDiagnostics(null);
  logStep("App initialized");
})();
