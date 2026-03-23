(function () {
  var state = {
    items: [],
    itemsById: {},
    rendered: 0,
    batchSize: 12,
    observer: null,
    modalOpen: false
  };

  function flattenEntries(entries) {
    var output = [];
    entries.forEach(function (entry) {
      entry.images.forEach(function (image, index) {
        output.push({
          id: entry.slug + "-" + index,
          title: entry.title,
          date: entry.date,
          location: entry.location,
          description: image.description,
          url: image.url
        });
      });
    });

    output.sort(function (left, right) {
      return String(right.date || "").localeCompare(String(left.date || ""));
    });

    return output;
  }

  function formatDate(value) {
    var parsed = new Date(String(value || "") + "T00:00:00");
    if (isNaN(parsed.getTime())) return value || "";
    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function shortText(value, limit) {
    var text = String(value || "").trim();
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)).trimEnd() + "…";
  }

  function renderNextBatch() {
    var grid = document.getElementById("gallery-grid");
    var empty = document.getElementById("gallery-empty");
    if (!grid || !empty) return;

    if (!state.items.length) {
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    var next = state.items.slice(state.rendered, state.rendered + state.batchSize);
    next.forEach(function (item) {
      grid.appendChild(buildGalleryCard(item));
    });
    state.rendered += next.length;

    var sentinel = document.getElementById("gallery-sentinel");
    if (sentinel) {
      sentinel.hidden = state.rendered >= state.items.length;
    }
  }

  function buildGalleryCard(item) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-card";
    button.setAttribute("aria-label", item.title + " on " + formatDate(item.date));
    button.dataset.itemId = item.id;

    var image = document.createElement("img");
    image.className = "gallery-card-image";
    image.src = item.url;
    image.alt = item.title;
    image.loading = "lazy";
    image.decoding = "async";

    var overlay = document.createElement("span");
    overlay.className = "gallery-card-overlay";
    overlay.innerHTML =
      '<strong>' + escapeHtml(item.title) + "</strong>" +
      "<span>" + escapeHtml(formatDate(item.date)) + "</span>" +
      "<span>" + escapeHtml(item.location) + "</span>" +
      "<span>" + escapeHtml(shortText(item.description, 120)) + "</span>";

    button.appendChild(image);
    button.appendChild(overlay);
    return button;
  }

  function openModal(item) {
    var modal = document.getElementById("gallery-modal");
    var dialog = modal ? modal.querySelector(".gallery-modal-dialog") : null;
    var image = document.getElementById("gallery-modal-image");
    if (!modal) return;

    image.src = item.url;
    image.alt = item.title;
    document.getElementById("gallery-modal-title").textContent = item.title;
    document.getElementById("gallery-modal-date").textContent = formatDate(item.date);
    document.getElementById("gallery-modal-location").textContent = item.location;
    document.getElementById("gallery-modal-description").textContent = item.description;
    if (dialog) {
      dialog.style.setProperty("--gallery-modal-media-height", "90vh");
    }
    modal.hidden = false;
    document.body.classList.add("modal-open");
    state.modalOpen = true;
    syncModalHeight();
  }

  function closeModal() {
    var modal = document.getElementById("gallery-modal");
    var dialog = modal ? modal.querySelector(".gallery-modal-dialog") : null;
    if (!modal) return;
    modal.hidden = true;
    if (dialog) {
      dialog.style.removeProperty("--gallery-modal-media-height");
    }
    document.body.classList.remove("modal-open");
    state.modalOpen = false;
  }

  function syncModalHeight() {
    if (!state.modalOpen) return;

    var dialog = document.querySelector("#gallery-modal .gallery-modal-dialog");
    var image = document.getElementById("gallery-modal-image");
    if (!dialog || !image) return;

    var apply = function () {
      var rect = image.getBoundingClientRect();
      var nextHeight = Math.max(240, Math.round(rect.height || 0));
      if (nextHeight) {
        dialog.style.setProperty("--gallery-modal-media-height", nextHeight + "px");
      }
    };

    if (image.complete) {
      window.requestAnimationFrame(apply);
    } else {
      image.onload = function () {
        apply();
      };
    }
  }

  function setupObserver() {
    var sentinel = document.getElementById("gallery-sentinel");
    if (!sentinel) return;

    if (state.observer) {
      state.observer.disconnect();
    }

    if (!window.IntersectionObserver) {
      renderNextBatch();
      return;
    }

    state.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          renderNextBatch();
        }
      });
    }, { rootMargin: "320px 0px" });

    state.observer.observe(sentinel);
  }

  async function initGalleryPage() {
    if (window.TACT_CHROME) {
      if (typeof window.TACT_CHROME.ensureHeader === "function") {
        window.TACT_CHROME.ensureHeader();
      } else {
        window.TACT_CHROME.renderHeader();
      }
      window.TACT_CHROME.initDropdowns();
    }

    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    var entries = await window.loadTactGalleryData();
    state.items = flattenEntries(entries);
    state.itemsById = {};
    state.items.forEach(function (item) {
      state.itemsById[item.id] = item;
    });
    state.rendered = 0;

    var grid = document.getElementById("gallery-grid");
    if (grid) {
      grid.innerHTML = "";
      if (!grid.dataset.bound) {
        grid.dataset.bound = "true";
        grid.addEventListener("click", function (event) {
          var card = event.target.closest(".gallery-card");
          if (!card) return;
          var item = state.itemsById[String(card.dataset.itemId || "")];
          if (item) {
            openModal(item);
          }
        });
      }
    }

    renderNextBatch();
    setupObserver();

    var closeButton = document.getElementById("gallery-modal-close");
    if (closeButton && !closeButton.dataset.bound) {
      closeButton.dataset.bound = "true";
      closeButton.addEventListener("click", closeModal);
    }

    var modal = document.getElementById("gallery-modal");
    if (modal && !modal.dataset.bound) {
      modal.dataset.bound = "true";
      modal.addEventListener("click", function (event) {
        if (event.target === modal || event.target.hasAttribute("data-modal-dismiss")) {
          closeModal();
        }
      });
    }
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.modalOpen) {
      closeModal();
    }
  });

  window.addEventListener("resize", syncModalHeight);

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.TACT_PAGE_RUNTIME = window.TACT_PAGE_RUNTIME || {};
  window.TACT_PAGE_RUNTIME.initGalleryPage = initGalleryPage;

  window.initGalleryPage = initGalleryPage;

  if (document.body && document.body.dataset.page === "gallery") {
    initGalleryPage();
  }
})();
