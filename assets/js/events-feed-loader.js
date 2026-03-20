(function () {
  var cache = null;

  function localFeed() {
    return Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  function shouldUseLocalFeedOnly() {
    var host = window.location && window.location.hostname;
    var protocol = window.location && window.location.protocol;
    return protocol === "file:" || host === "localhost" || host === "127.0.0.1";
  }

  function normalizeStatus(value) {
    var status = String(value || "scheduled").toLowerCase();
    return status === "completed" ? "completed" : "scheduled";
  }

  function normalizeDate(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    var parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      var y = parsed.getFullYear();
      var m = String(parsed.getMonth() + 1).padStart(2, "0");
      var d = String(parsed.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    }

    return raw;
  }

  function toPublicPosterUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    // Convert common Drive share links to a thumbnail URL that is more reliable in <img>.
    var match = raw.match(/[?&]id=([^&]+)/i) || raw.match(/\/d\/([^/]+)/i);
    if (raw.indexOf("drive.google.com") >= 0 && match && match[1]) {
      return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w1600";
    }

    return raw;
  }

  function normalizeEvent(raw) {
    return {
      slug: String(raw.slug || ""),
      title: String(raw.title || ""),
      date: normalizeDate(raw.date),
      time: String(raw.time || ""),
      location: String(raw.location || ""),
      teaser: String(raw.teaser || ""),
      homepageMatter: String(raw.homepageMatter || ""),
      status: normalizeStatus(raw.status),
      poster: toPublicPosterUrl(raw.posterUrl || raw.poster || raw.image || "")
    };
  }

  function indexBySlug(items) {
    var map = {};
    items.forEach(function (item) {
      if (!item.slug) return;
      map[item.slug] = item;
    });
    return map;
  }

  function mergeWithFallback(remoteItems, fallbackMap) {
    return remoteItems.map(function (item) {
      var fallback = fallbackMap[item.slug];
      if (!fallback) return item;

      return {
        slug: item.slug || fallback.slug,
        title: item.title || fallback.title,
        date: item.date || fallback.date,
        time: item.time || fallback.time,
        location: item.location || fallback.location,
        teaser: item.teaser || fallback.teaser,
        homepageMatter: item.homepageMatter || fallback.homepageMatter,
        status: item.status || fallback.status,
        poster: fallback.poster || item.poster
      };
    });
  }

  function withTimeout(url, timeoutMs) {
    if (!window.AbortController) {
      return fetch(url, { method: "GET", cache: "no-store" });
    }

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    return fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    }).finally(function () {
      window.clearTimeout(timer);
    });
  }

  async function fetchRemoteFeed(endpoint, timeoutMs) {
    var separator = endpoint.indexOf("?") >= 0 ? "&" : "?";
    var url = endpoint + separator + "mode=feed";
    var response = await withTimeout(url, timeoutMs);
    if (!response.ok) {
      throw new Error("Feed request failed with " + response.status);
    }

    var payload = await response.json();
    var rows = Array.isArray(payload && payload.events) ? payload.events : [];
    return rows.map(normalizeEvent).filter(function (event) {
      return event.title && event.date;
    });
  }

  window.loadTactEventFeed = async function () {
    if (cache) return cache.slice();

    var base = localFeed().map(normalizeEvent);
    var fallbackMap = indexBySlug(base);
    var config = window.TACT_EVENTS_CONFIG || {};
    var endpoint = String(config.apiEndpoint || "").trim();
    var timeoutMs = Number(config.requestTimeoutMs || 10000);

    if (!endpoint || shouldUseLocalFeedOnly()) {
      cache = base;
      return cache.slice();
    }

    try {
      var remote = await fetchRemoteFeed(endpoint, timeoutMs);
      cache = remote.length ? mergeWithFallback(remote, fallbackMap) : base;
      return cache.slice();
    } catch (_error) {
      cache = base;
      return cache.slice();
    }
  };
})();
