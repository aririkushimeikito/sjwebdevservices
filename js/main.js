/* ============================================================
   SJ WEBDEV SERVICES — main.js
   Vanilla JavaScript. No frameworks, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Theme toggle (initial theme is set inline in <head> to avoid FOUC) ---------- */
  var root = document.documentElement;
  var toggle = document.querySelector(".theme-toggle");

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("sj-theme", theme); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F3F4F8" : "#0A0C11");
    if (toggle) {
      toggle.setAttribute("aria-label", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      setTheme(next);
    });
    setTheme(root.getAttribute("data-theme") || "dark");
  }

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveals ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          ro.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Animated counters ---------- */
  var counters = document.querySelectorAll("[data-count]");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function runCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (reduced || !target) { el.textContent = target; return; }
    var dur = 1400, start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window && counters.length) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runCounter(entry.target);
          co.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
  }

  /* ---------- Portfolio filters ---------- */
  var filterBtns = document.querySelectorAll(".filter-btn");
  var works = document.querySelectorAll(".work");
  if (filterBtns.length && works.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filterBtns.forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        var f = btn.getAttribute("data-filter");
        works.forEach(function (w) {
          var show = f === "all" || w.getAttribute("data-cat") === f;
          w.classList.toggle("is-hidden", !show);
        });
      });
    });
  }

  /* ---------- Contact form (direct submit via FormSubmit — no email app) ---------- */
  var form = document.getElementById("contact-form");
  if (form) {
    /* Endpoint is only assembled at runtime, never present in the HTML. */
    var ENDPOINT = "https://formsubmit.co/ajax/" + ["sjwebdevservices", "gmail.com"].join("@");
    var loadedAt = Date.now();
    var firstTouch = 0;
    var touches = 0;
    var markTouch = function () { touches += 1; if (!firstTouch) firstTouch = Date.now(); };
    form.addEventListener("keydown", markTouch);
    form.addEventListener("pointerdown", markTouch);
    form.addEventListener("input", markTouch);

    /* Known bot templates ("I would like more information. Please contact me by email…"). */
    var SPAM_PATTERNS = [
      /would like (?:some )?more information/i,
      /(?:please )?contact me (?:by|via) e-?mail/i,
      /(?:i am|we are) interested in your (?:services|offer)/i,
      /increase your (?:sales|traffic|ranking)/i,
      /(?:seo|backlink|guest post) (?:service|package|offer)/i,
      /\b(?:crypto|bitcoin|casino|loan|viagra)\b/i
    ];
    var looksLikeSpam = function (f) {
      var msg = f.message.replace(/\s+/g, " ");
      var words = msg.split(" ").filter(Boolean).length;
      if (document.getElementById("cf-honey").value || document.getElementById("cf-website").value) return "honeypot";
      if (Date.now() - loadedAt < 6000) return "too-fast";          /* filled a 6-field form in under 6 s */
      if (touches < 5 || !firstTouch) return "no-interaction";       /* no typing or clicks inside the form */
      if (words < 4) return "too-short";
      if (/(https?:\/\/|www\.)\S+/i.test(msg) && words < 12) return "link-only";
      for (var i = 0; i < SPAM_PATTERNS.length; i++) if (SPAM_PATTERNS[i].test(msg)) return "template";
      if (f.name.toLowerCase() === f.email.split("@")[0].toLowerCase() && words < 12) return "name-is-email";
      return "";
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("form-status");
      var submitBtn = form.querySelector('button[type="submit"]');
      var get = function (id) { return (document.getElementById(id) || {}).value || ""; };

      var name = get("cf-name").trim();
      var email = get("cf-email").trim();
      var message = get("cf-message").trim();
      if (!name || !email || !message) {
        if (status) status.textContent = "/ please fill in your name, email and message.";
        return;
      }

      /* Bot check — spam is silently discarded but shown the normal success message. */
      var spam = looksLikeSpam({ name: name, email: email, message: message });
      if (spam) {
        if (status) status.textContent = "/ message sent — we'll reply within one business day. thank you!";
        form.reset();
        return;
      }

      var company = get("cf-company").trim();
      var payload = {
        _honey: "",
        name: name,
        email: email,
        phone: get("cf-phone").trim() || "—",
        company: company || "—",
        service: get("cf-service") || "—",
        budget: get("cf-budget") || "—",
        message: message,
        _subject: "Project enquiry — " + name + (company ? " (" + company + ")" : ""),
        _bcc: "sherwingalindo18@gmail.com",
        _template: "table",
        _captcha: "false"
      };

      if (status) status.textContent = "/ sending your message…";
      if (submitBtn) submitBtn.disabled = true;

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function () {
          if (status) status.textContent = "/ message sent — we'll reply within one business day. thank you!";
          form.reset();
        })
        .catch(function () {
          if (status) status.textContent = "/ couldn't send right now — please email us directly at sjwebdevservices@gmail.com";
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
