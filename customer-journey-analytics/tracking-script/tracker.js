(function () {
  'use strict';

  // =========================================================
  // CJA Tracker - Universal Vanilla JS Analytics SDK
  // Auto-initializes on DOM ready and works via <script> tag.
  // Requires window.CJA_CONFIG = { site_id, track_endpoint, ... }
  // =========================================================

  var GLOBAL_CONFIG = window.CJA_CONFIG || {};
  var SITE_ID = GLOBAL_CONFIG.site_id;
  var TRACK_ENDPOINT = GLOBAL_CONFIG.track_endpoint;
  var FUNNEL = Array.isArray(GLOBAL_CONFIG.funnel) ? GLOBAL_CONFIG.funnel : [];
  var DEBUG = !!GLOBAL_CONFIG.debug;

  var SESSION_KEY = 'cja_session_id';
  var MAX_BATCH_SIZE = 10;
  var BATCH_INTERVAL_MS = 3000;
  var SCROLL_THROTTLE_MS = 1000;
  var MOUSE_DEBOUNCE_MS = 200;

  var eventQueue = [];
  var flushTimer = null;
  var isTrackingEnabled = false;
  var lastScrollSentAt = 0;
  var mouseDebounceTimer = null;
  var lastPathname = '';

  // -------------------------
  // Helpers
  // -------------------------
  function safeLog() {
    if (!DEBUG) return;
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[CJA]');
      console.log.apply(console, args);
    } catch (_) {}
  }

  function safeError() {
    if (!DEBUG) return;
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[CJA]');
      console.error.apply(console, args);
    } catch (_) {}
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return '';
    }
  }

  function getPagePath() {
    try {
      return window.location.pathname || '/';
    } catch (_) {
      return '/';
    }
  }

  function getSessionId() {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;

      var created;
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        created = window.crypto.randomUUID();
      } else {
        created = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      sessionStorage.setItem(SESSION_KEY, created);
      return created;
    } catch (_) {
      // Fallback if sessionStorage is blocked
      return 'mem-' + Math.random().toString(36).slice(2) + Date.now();
    }
  }

  function getScrollDepthPercent() {
    try {
      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      var scrollHeight = Math.max(
        body.scrollHeight || 0,
        doc.scrollHeight || 0,
        body.offsetHeight || 0,
        doc.offsetHeight || 0,
        body.clientHeight || 0,
        doc.clientHeight || 0
      );
      var viewport = window.innerHeight || doc.clientHeight || 0;
      var scrollable = Math.max(scrollHeight - viewport, 0);
      if (scrollable <= 0) return 100;

      var pct = Math.round((scrollTop / scrollable) * 100);
      if (pct < 0) return 0;
      if (pct > 100) return 100;
      return pct;
    } catch (_) {
      return 0;
    }
  }

  function normalizeTagName(target) {
    try {
      if (!target || !target.tagName) return null;
      return String(target.tagName).toLowerCase();
    } catch (_) {
      return null;
    }
  }

  // -------------------------
  // Queue + Transport
  // -------------------------
  function buildEvent(eventType, data) {
    var payload = {
      site_id: SITE_ID,
      session_id: sessionId,
      event_type: eventType,
      page: getPagePath(),
      x: null,
      y: null,
      scroll_depth: null,
      funnel_stage: null,
      target_tag: null,
      timestamp: nowIso(),
      user_agent: navigator.userAgent || ''
    };

    if (data && typeof data === 'object') {
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) {
          payload[k] = data[k];
        }
      }
    }

    return payload;
  }

  function enqueueEvent(eventType, data) {
    if (!isTrackingEnabled) return;

    try {
      var eventPayload = buildEvent(eventType, data);
      eventQueue.push(eventPayload);
      safeLog('event queued', eventPayload);

      if (eventQueue.length >= MAX_BATCH_SIZE) {
        flushQueue('max_batch');
      }
    } catch (err) {
      safeError('enqueue failed', err);
    }
  }

  function flushQueue(reason) {
    if (!isTrackingEnabled) return;
    if (!eventQueue.length) return;

    var batch = eventQueue.splice(0, eventQueue.length);
    safeLog('flushing batch', { reason: reason || 'interval', size: batch.length });

    try {
      fetch(TRACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: SITE_ID,
          session_id: sessionId,
          events: batch
        }),
        keepalive: true
      }).catch(function (err) {
        safeError('batch send failed', err);
      });
    } catch (err) {
      safeError('flushQueue error', err);
    }
  }

  function flushOnUnload() {
    if (!isTrackingEnabled || !eventQueue.length) return;

    var batch = eventQueue.splice(0, eventQueue.length);

    try {
      var body = JSON.stringify({
        site_id: SITE_ID,
        session_id: sessionId,
        events: batch
      });

      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(TRACK_ENDPOINT, blob);
      } else {
        fetch(TRACK_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      }

      safeLog('final batch sent on unload', { size: batch.length });
    } catch (err) {
      safeError('flushOnUnload error', err);
    }
  }

  function startBatchTimer() {
    try {
      if (flushTimer) clearInterval(flushTimer);
      flushTimer = setInterval(function () {
        flushQueue('interval');
      }, BATCH_INTERVAL_MS);
    } catch (err) {
      safeError('startBatchTimer error', err);
    }
  }

  // -------------------------
  // Funnel tracking
  // -------------------------
  function getFunnelStage(pathname) {
    try {
      for (var i = 0; i < FUNNEL.length; i++) {
        if (FUNNEL[i] === pathname) return i;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function trackFunnelStageIfAny(pathname) {
    try {
      var stageIndex = getFunnelStage(pathname);
      if (stageIndex !== null) {
        enqueueEvent('funnel_stage', {
          funnel_stage: stageIndex,
          page: pathname
        });
      }
    } catch (err) {
      safeError('trackFunnelStageIfAny error', err);
    }
  }

  function trackPageView() {
    try {
      var pathname = getPagePath();
      enqueueEvent('page_view', {
        page: pathname,
        scroll_depth: getScrollDepthPercent()
      });
      trackFunnelStageIfAny(pathname);
      lastPathname = pathname;
    } catch (err) {
      safeError('trackPageView error', err);
    }
  }

  // -------------------------
  // Event listeners
  // -------------------------
  function setupClickTracking() {
    try {
      document.addEventListener('click', function (evt) {
        try {
          enqueueEvent('click', {
            x: typeof evt.clientX === 'number' ? evt.clientX : null,
            y: typeof evt.clientY === 'number' ? evt.clientY : null,
            target_tag: normalizeTagName(evt.target),
            page: getPagePath()
          });
        } catch (err) {
          safeError('click handler error', err);
        }
      }, { passive: true });
    } catch (err) {
      safeError('setupClickTracking error', err);
    }
  }

  function setupScrollTracking() {
    try {
      window.addEventListener('scroll', function () {
        try {
          var now = Date.now();
          if (now - lastScrollSentAt < SCROLL_THROTTLE_MS) return;
          lastScrollSentAt = now;

          enqueueEvent('scroll', {
            scroll_depth: getScrollDepthPercent(),
            page: getPagePath()
          });
        } catch (err) {
          safeError('scroll handler error', err);
        }
      }, { passive: true });
    } catch (err) {
      safeError('setupScrollTracking error', err);
    }
  }

  function setupMouseTracking() {
    try {
      document.addEventListener('mousemove', function (evt) {
        try {
          if (mouseDebounceTimer) clearTimeout(mouseDebounceTimer);
          var x = evt.clientX;
          var y = evt.clientY;

          mouseDebounceTimer = setTimeout(function () {
            enqueueEvent('mouse_move', {
              x: typeof x === 'number' ? x : null,
              y: typeof y === 'number' ? y : null,
              page: getPagePath()
            });
          }, MOUSE_DEBOUNCE_MS);
        } catch (err) {
          safeError('mousemove handler error', err);
        }
      }, { passive: true });
    } catch (err) {
      safeError('setupMouseTracking error', err);
    }
  }

  function setupSpaPageViewTracking() {
    try {
      var originalPushState = history.pushState;
      var originalReplaceState = history.replaceState;

      function onRouteChange() {
        try {
          var current = getPagePath();
          if (current !== lastPathname) {
            trackPageView();
          }
        } catch (err) {
          safeError('onRouteChange error', err);
        }
      }

      history.pushState = function () {
        try {
          var result = originalPushState.apply(history, arguments);
          setTimeout(onRouteChange, 0);
          return result;
        } catch (err) {
          safeError('pushState override error', err);
          return originalPushState.apply(history, arguments);
        }
      };

      history.replaceState = function () {
        try {
          var result = originalReplaceState.apply(history, arguments);
          setTimeout(onRouteChange, 0);
          return result;
        } catch (err) {
          safeError('replaceState override error', err);
          return originalReplaceState.apply(history, arguments);
        }
      };

      window.addEventListener('popstate', function () {
        onRouteChange();
      }, { passive: true });
    } catch (err) {
      safeError('setupSpaPageViewTracking error', err);
    }
  }

  function setupUnloadFlush() {
    try {
      window.addEventListener('beforeunload', flushOnUnload, { passive: true });
      window.addEventListener('pagehide', flushOnUnload, { passive: true });
      document.addEventListener('visibilitychange', function () {
        try {
          if (document.visibilityState === 'hidden') {
            flushOnUnload();
          }
        } catch (err) {
          safeError('visibilitychange handler error', err);
        }
      }, { passive: true });
    } catch (err) {
      safeError('setupUnloadFlush error', err);
    }
  }

  // -------------------------
  // Bootstrap
  // -------------------------
  var sessionId = getSessionId();

  function start() {
    try {
      if (!SITE_ID || !TRACK_ENDPOINT) {
        safeError('tracking disabled: missing site_id or track_endpoint in window.CJA_CONFIG');
        return;
      }

      isTrackingEnabled = true;

      setupClickTracking();
      setupScrollTracking();
      setupMouseTracking();
      setupSpaPageViewTracking();
      setupUnloadFlush();
      startBatchTimer();

      // initial page view
      trackPageView();

      safeLog('tracker started', {
        site_id: SITE_ID,
        endpoint: TRACK_ENDPOINT,
        session_id: sessionId,
        funnel: FUNNEL
      });
    } catch (err) {
      safeError('tracker start failed', err);
    }
  }

  function autoInit() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          try {
            start();
          } catch (err) {
            safeError('DOMContentLoaded start error', err);
          }
        }, { passive: true });
      } else {
        start();
      }
    } catch (err) {
      safeError('autoInit failed', err);
    }
  }

  autoInit();
})();
