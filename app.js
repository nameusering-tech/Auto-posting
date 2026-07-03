(function () {
  "use strict";

  const shareForm = document.querySelector("#share-form");
  const imageInput = document.querySelector("#image-input");
  const captionInput = document.querySelector("#caption-input");
  const statusMessage = document.querySelector("#status-message");
  const fallbackPanel = document.querySelector("#fallback-panel");
  const imagePreview = document.querySelector("#image-preview");
  const copyCaptionButton = document.querySelector("#copy-caption-button");
  const downloadImageLink = document.querySelector("#download-image-link");

  const diagnostics = {
    share: document.querySelector("#diag-share"),
    canShare: document.querySelector("#diag-can-share"),
    fileShare: document.querySelector("#diag-file-share"),
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

  function isSupportedImage(file) {
    return file && (file.type === "image/jpeg" || file.type === "image/png");
  }

  function canShareSelectedFile(file) {
    if (!navigator.canShare || !isSupportedImage(file)) {
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
    diagnostics.fileShare.textContent = file ? yesNo(fileSharingSupported) : "Select an image";
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

    imagePreview.src = previewUrl;
    downloadImageLink.href = previewUrl;
    downloadImageLink.download = file.name || "shared-image";
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
    downloadImageLink.href = "#";
    downloadImageLink.removeAttribute("download");
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
      setStatus("Choose a JPG or PNG image first.", "error");
      hideFallback();
      return;
    }

    if (!isSupportedImage(selectedFile)) {
      setStatus("Only JPG and PNG files are supported in this test.", "error");
      showFallback(selectedFile);
      return;
    }

    const nativeShareSupported = typeof navigator.share === "function";
    const fileShareSupported = canShareSelectedFile(selectedFile);

    logStep("Share support evaluated", {
      nativeShareSupported,
      fileShareSupported,
      captionLength: caption.length,
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

  function handleImageSelection() {
    const [file] = imageInput.files;
    selectedFile = file || null;

    logStep("Image selection changed", selectedFile
      ? {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
        }
      : null);

    updateDiagnostics(selectedFile);

    if (!selectedFile) {
      setStatus("Waiting for an image.");
      hideFallback();
      return;
    }

    if (!isSupportedImage(selectedFile)) {
      setStatus("This file is not a JPG or PNG. The fallback preview may still try to load it.", "error");
      showFallback(selectedFile);
      return;
    }

    setStatus("Image selected. Press Share to test native sharing.");
    hideFallback();
  }

  window.addEventListener("beforeunload", resetPreviewUrl);
  imageInput.addEventListener("change", handleImageSelection);
  shareForm.addEventListener("submit", handleShare);
  copyCaptionButton.addEventListener("click", copyCaption);

  updateDiagnostics(null);
  logStep("App initialized");
})();
