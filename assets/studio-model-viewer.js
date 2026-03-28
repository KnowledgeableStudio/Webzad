const studioSelector = ".studio-visual";
const modelClass = "studio-visual-model";
const studioHighlights = [
  {
    title: "Brand story with substance",
    body: "The studio approach starts with who the business is, what it needs to communicate, and why the current experience is not carrying enough authority.",
  },
  {
    title: "Design that supports trust",
    body: "Every section is built to feel clean, premium, and deliberate so potential clients can focus on value.",
  },
];
const swayMap = new WeakMap();
let ensureScheduled = false;
let modelViewerPromise = null;

function isStudioRoute() {
  return window.location.hash.startsWith("#/studio");
}

async function ensureModelViewerLoaded() {
  if (customElements.get("model-viewer")) {
    return true;
  }

  if (!modelViewerPromise) {
    modelViewerPromise = import("./model-viewer.min.js");
  }

  try {
    await modelViewerPromise;
    return !!customElements.get("model-viewer");
  } catch (error) {
    console.error("Failed to load model-viewer.", error);
    modelViewerPromise = null;
    return false;
  }
}

function attachStudioSway(model) {
  if (swayMap.has(model)) {
    return;
  }

  let frameId = 0;
  const startTime = performance.now();

  const animate = (now) => {
    if (!model.isConnected) {
      swayMap.delete(model);
      return;
    }

    const yaw = Math.sin((now - startTime) / 1800) * 12;
    model.cameraOrbit = `${yaw.toFixed(2)}deg 75deg auto`;
    frameId = window.requestAnimationFrame(animate);
  };

  const start = () => {
    if (!frameId) {
      frameId = window.requestAnimationFrame(animate);
    }
  };

  if (model.loaded) {
    start();
  } else {
    model.addEventListener("load", start, { once: true });
  }

  swayMap.set(model, () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
    }
  });
}

function syncStudioHighlights(overlay) {
  const list = overlay?.querySelector(".studio-highlight-list");
  if (!list) {
    return null;
  }

  const articles = [...list.querySelectorAll("article")];
  articles.forEach((article, index) => {
    if (index < studioHighlights.length) {
      const title = article.querySelector("h3");
      const body = article.querySelector("p");
      if (title) {
        title.textContent = studioHighlights[index].title;
      }
      if (body) {
        body.textContent = studioHighlights[index].body;
      }
      article.style.display = "grid";
    } else {
      article.style.display = "none";
    }
  });

  return list;
}

async function ensureStudioModel() {
  const visual = document.querySelector(studioSelector);
  if (!visual || !isStudioRoute()) {
    return;
  }

  const modelViewerLoaded = await ensureModelViewerLoaded();
  if (!modelViewerLoaded) {
    return;
  }

  const image = visual.querySelector(".studio-visual-image");
  const overlay = visual.querySelector(".studio-visual-overlay");
  const list = syncStudioHighlights(overlay);
  let model = visual.querySelector(`.${modelClass}`);

  if (image) {
    image.remove();
  }

  if (!model) {
    model = document.createElement("model-viewer");
    model.className = modelClass;
    model.src = "./soulless.glb";
    model.alt = "Soulless 3D model";
    model.setAttribute("camera-controls", "");
    model.setAttribute("disable-zoom", "");
    model.setAttribute("disable-pan", "");
    model.setAttribute("interaction-prompt", "none");
    model.setAttribute("reveal", "auto");
    model.setAttribute("loading", "eager");
    model.setAttribute("environment-image", "neutral");
    model.setAttribute("shadow-intensity", "0");
    model.setAttribute("exposure", "1");
    model.setAttribute("camera-orbit", "0deg 75deg auto");
    model.setAttribute("field-of-view", "30deg");
  }

  if (overlay) {
    if (list) {
      if (model.parentElement !== overlay || model.nextElementSibling !== list) {
        overlay.insertBefore(model, list);
      }
    } else if (model.parentElement !== overlay) {
      overlay.appendChild(model);
    }
  } else if (model.parentElement !== visual) {
    visual.appendChild(model);
  }

  attachStudioSway(model);
}

function scheduleEnsureStudioModel() {
  if (ensureScheduled) {
    return;
  }

  ensureScheduled = true;
  window.requestAnimationFrame(() => {
    ensureScheduled = false;
    void ensureStudioModel();
  });
}

const root = document.getElementById("root") || document.body;
const observer = new MutationObserver(() => {
  scheduleEnsureStudioModel();
});
observer.observe(root, { childList: true, subtree: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void ensureStudioModel();
  }, { once: true });
} else {
  void ensureStudioModel();
}

window.addEventListener("hashchange", () => {
  scheduleEnsureStudioModel();
});
