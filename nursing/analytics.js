/**
 * anycalculator.site/nursing — GA4 analytics + event tracking
 * GA4 Measurement ID: G-JL08H6FMN6
 * 
 * Auto-tracks: page views, tool usage, quiz interactions, CTA clicks
 * To add custom events: gtag('event', 'event_name', { param: 'value' })
 */
(function() {
  'use strict';

  // ── GA4 base ──
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-JL08H6FMN6';
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', 'G-JL08H6FMN6', {
    page_title: document.title,
    page_location: location.href
  });

  // ── Auto-detect tool usage ──
  // For calculator pages: track when user clicks "計算" or submit buttons
  document.addEventListener('DOMContentLoaded', function() {
    var page = location.pathname.replace('/nursing/', '').replace('.html', '') || 'hub';
    gtag('event', 'page_view_nursing', { page: page });

    // Track tool calculation buttons — look for common patterns
    var calcBtns = document.querySelectorAll('[data-calc], button[type="submit"], .calc-btn, .btn-calc');
    calcBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var label = btn.textContent.trim() || btn.dataset.calc || 'unknown';
        gtag('event', 'tool_calculate', {
          tool: page,
          label: label.substring(0, 30)
        });
      });
    });

    // Track quiz interactions
    if (page === 'quiz') {
      trackQuiz();
    }

    // Track CTA clicks (LINE Bot, external links)
    var ctaLinks = document.querySelectorAll('a[href*="line.me"], a[href*="lin.ee"]');
    ctaLinks.forEach(function(a) {
      a.addEventListener('click', function() {
        gtag('event', 'cta_line_click', { page: page });
      });
    });

    // Track external link clicks
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (!link || !link.href) return;
      var href = link.href;
      if (href.startsWith('http') && !href.includes('anycalculator.site')) {
        gtag('event', 'external_link_click', {
          from: page,
          to: new URL(href).hostname
        });
      }
    });
  });

  // ── Quiz-specific tracking ──
  function trackQuiz() {
    // Track when quiz subject is selected
    document.addEventListener('click', function(e) {
      var card = e.target.closest('.subject-card');
      if (card) {
        var subject = card.dataset.subject || card.textContent.trim().substring(0, 30);
        gtag('event', 'quiz_subject_select', { subject: subject });
      }
    });

    // Track when quiz answers are submitted (listen for answer clicks)
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.answer-btn, .option-btn, [data-answer]');
      if (btn && document.querySelector('.quiz-container, #quiz, .quiz-area')) {
        var qNum = getCurrentQuestion();
        var isCorrect = btn.dataset.correct === 'true' || btn.classList.contains('correct');
        gtag('event', 'quiz_answer', {
          question: qNum,
          correct: isCorrect
        });
      }
    });

    // Track quiz completion
    var origXHR = window.XMLHttpRequest;
    // Monitor for quiz result display
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1 && (node.matches('.quiz-result, .quiz-score, .result-container') || 
              node.querySelector('.quiz-result, .quiz-score, .result-container'))) {
            gtag('event', 'quiz_complete', { page: 'quiz' });
            observer.disconnect();
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function getCurrentQuestion() {
    var el = document.querySelector('.question-number, .q-number, [data-question]');
    return el ? (el.dataset.question || el.textContent.trim()) : 'unknown';
  }

  // ── Expose for direct use in page scripts ──
  window.trackEvent = function(eventName, params) {
    gtag('event', eventName, params);
  };

  window.trackToolUse = function(toolName, action) {
    gtag('event', 'tool_use', { tool: toolName, action: action || 'calculate' });
  };

})();
