/* Sukh Shanti Bhawan — progressive enhancement only.
   Every page works without this file; it adds the drawer, reveals, the FAQ
   accordion and the gallery lightbox. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------- header shadow --- */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------- mobile drawer --- */
  var drawer = document.querySelector('[data-drawer]');
  var toggle = document.querySelector('[data-drawer-toggle]');

  if (drawer && toggle) {
    var lastFocused = null;

    var setDrawer = function (open) {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', String(!open));
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
      if (open) {
        lastFocused = document.activeElement;
        var first = drawer.querySelector('a, button');
        if (first) first.focus();
      } else if (lastFocused) {
        lastFocused.focus();
      }
    };

    toggle.addEventListener('click', function () {
      setDrawer(!drawer.classList.contains('is-open'));
    });

    drawer.addEventListener('click', function (e) {
      if (e.target.closest('[data-drawer-close]') || e.target.closest('a')) setDrawer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) setDrawer(false);
    });

    // Keep tab focus inside the open drawer.
    drawer.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var items = drawer.querySelectorAll('a[href], button:not([disabled])');
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* ----------------------------------------------------- reveal ------ */
  var revealables = document.querySelectorAll('[data-reveal]');
  if (!revealables.length) {
    /* nothing to do */
  } else if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealables.forEach(function (el) { observer.observe(el); });
  }

  /* -------------------------------------------------- accordion ------ */
  document.querySelectorAll('[data-accordion-btn]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      if (panel) panel.setAttribute('data-open', String(!open));
    });
  });

  /* -------------------------------------------------- lightbox ------- */
  var lightbox = document.querySelector('[data-lightbox]');
  if (lightbox) {
    var lbImage = lightbox.querySelector('img');
    var lbCaption = lightbox.querySelector('[data-lightbox-caption]');
    var opener = null;

    var closeLightbox = function () {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-locked');
      if (opener) opener.focus();
    };

    document.querySelectorAll('[data-lightbox-open]').forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        if (!img) return;
        opener = item;
        lbImage.src = img.getAttribute('src');
        lbImage.alt = img.getAttribute('alt') || '';
        if (lbCaption) lbCaption.textContent = img.getAttribute('alt') || '';
        lightbox.classList.add('is-open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.classList.add('is-locked');
        var close = lightbox.querySelector('button');
        if (close) close.focus();
      });
    });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.closest('[data-lightbox-close]')) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
    });
  }

  /* ---------------------------------------------------- footer year -- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ------------------------------------------------ contact form ----- */
  /* The form posts nowhere by default. Until an endpoint is configured in
     src/partials/contact-form.html, hand the enquiry to the visitor's own
     mail client so no message is silently lost. */
  var form = document.querySelector('[data-contact-form]');
  if (form && !form.getAttribute('action')) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var body = [];
      data.forEach(function (value, key) {
        if (String(value).trim()) body.push(key + ': ' + value);
      });
      var to = form.getAttribute('data-mailto');
      window.location.href =
        'mailto:' + to +
        '?subject=' + encodeURIComponent('Website enquiry — ' + (data.get('subject') || 'General')) +
        '&body=' + encodeURIComponent(body.join('\n'));
    });
  }
})();
