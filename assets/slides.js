/* 슬라이드 보기 — 넘기기·확대·전체화면 */
(function () {
  'use strict';
  var deck = document.querySelector('.deck');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var count = document.getElementById('count');
  var viewer = document.querySelector('.viewer');
  var i = 0;

  slides.forEach(function (s, n) {
    var pg = s.querySelector('.pg');
    if (pg && !pg.textContent) pg.textContent = String(n + 1);
  });

  function fit() {
    var w = viewer.clientWidth, h = viewer.clientHeight;
    var k = Math.min((w - 16) / 1024, (h - 16) / 768);
    deck.style.transform = 'translate(-50%, -50%) scale(' + Math.max(k, 0.1) + ')';
  }
  function show(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    count.textContent = (i + 1) + ' / ' + slides.length;
    try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
  }
  function go(d) { show(i + d); }

  document.getElementById('prev').addEventListener('click', function () { go(-1); });
  document.getElementById('next').addEventListener('click', function () { go(1); });
  document.getElementById('first').addEventListener('click', function () { show(0); });
  var fs = document.getElementById('fs');
  if (fs) fs.addEventListener('click', function () {
    var el = document.documentElement;
    if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); }
    else if (el.requestFullscreen) { el.requestFullscreen().catch(function () {}); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].indexOf(e.key) > -1) { e.preventDefault(); go(1); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) > -1) { e.preventDefault(); go(-1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
  });
  var swiped = false;
  viewer.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('a')) return;
    var r = viewer.getBoundingClientRect();
    go(e.clientX - r.left < r.width / 3 ? -1 : 1);
  });
  var sx = null;
  viewer.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40) { swiped = true; go(dx < 0 ? 1 : -1); }
  });

  window.addEventListener('hashchange', function () {
    var n = parseInt((location.hash || '').slice(1), 10);
    if (!isNaN(n) && n - 1 !== i) show(n - 1);
  });
  window.addEventListener('resize', fit);
  fit();
  var start = parseInt((location.hash || '').slice(1), 10);
  show(isNaN(start) ? 0 : start - 1);
})();
