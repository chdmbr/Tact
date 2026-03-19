(function () {
  var cache = null;

  function localFeed() {
    return Array.isArray(window.TACT_EVENT_FEED) ? window.TACT_EVENT_FEED.slice() : [];
  }

  function normalizeStatus(value) {
    var status = String(value || "scheduled").toLowerCase();
    return status === "completed" ? "completed" : "scheduled";
  }

  function normalizeEvent(raw) {
    return {
      slug: String(raw.slug || ""),
      title: String(raw.title || ""),
      date: String(raw.date || ""),
      time: String(raw.time || ""),
      location: String(raw.location || ""),
      teaser: String(raw.teaser || ""),
      homepageMatter: String(raw.homepageMatter || ""),
      status: normalizeStatus(raw.status),
      poster: String(raw.posterUrl || raw.poster || raw.image || "")
    };
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
    var config = window.TACT_EVENTS_CONFIG || {};
    var endpoint = String(config.apiEndpoint || "").trim();
    var timeoutMs = Number(config.requestTimeoutMs || 10000);

    if (!endpoint) {
      cache = base;
      return cache.slice();
    }

    try {
      var remote = await fetchRemoteFeed(endpoint, timeoutMs);
      cache = remote.length ? remote : base;
      return cache.slice();
    } catch (_error) {
      cache = base;
      return cache.slice();
    }
  };
})();
