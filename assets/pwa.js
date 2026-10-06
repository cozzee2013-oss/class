/* Installation and registration shared by all textbook pages. */
(function () {
  'use strict';
  var script = document.querySelector('script[src$="assets/pwa.js"]');
  var root = new URL('../', script.src);
  var button = document.getElementById('app-install-button');
  var pending = null;
  var standalone = window.matchMedia('(display-mode: standalone)');
  var installedThisSession = false;
  function isInstalled() { return installedThisSession || standalone.matches || navigator.standalone === true; }
  function refresh() {
    if (!button) return;
    button.textContent = isInstalled() ? '앱으로 사용 중' : '앱 설치';
    button.disabled = isInstalled();
  }
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault(); pending = event; refresh();
  });
  window.addEventListener('appinstalled', function () {
    pending = null; installedThisSession = true; refresh();
  });
  if (standalone.addEventListener) standalone.addEventListener('change', refresh);
  function showHelp(message) {
    var dialog = document.getElementById('install-help');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'install-help'; dialog.className = 'install-dialog';
      dialog.setAttribute('aria-labelledby', 'install-help-title');
      dialog.innerHTML = '<h2 id="install-help-title">홈 화면에 교재 추가하기</h2><p></p><form method="dialog"><button type="submit">확인</button></form>';
      document.body.appendChild(dialog);
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    }
    dialog.querySelector('p').textContent = message;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.alert(message);
  }
  if (button) button.addEventListener('click', async function () {
    if (pending) {
      var prompt = pending; pending = null;
      try { await prompt.prompt(); await prompt.userChoice; }
      catch (error) { showHelp('브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.'); }
      refresh(); return;
    }
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) showHelp('Safari에서 이 페이지를 연 뒤 공유 버튼 → ‘홈 화면에 추가’를 선택해 주세요. ‘웹 앱으로 열기’ 항목이 보이면 켜고 추가해 주세요.');
    else if (/Android/.test(navigator.userAgent)) showHelp('Chrome 또는 삼성 인터넷에서 이 페이지를 열고 브라우저 메뉴의 ‘앱 설치’, ‘홈 화면에 추가’ 또는 ‘페이지 추가 → 홈 화면’을 선택해 주세요. 설치 안내가 아직 준비되지 않았다면 잠시 후 다시 눌러 주세요.');
    else showHelp('Chrome 또는 Edge에서 주소창의 설치 아이콘이나 브라우저 메뉴의 ‘앱 설치’를 선택해 주세요. 이미 설치된 앱은 브라우저의 앱 메뉴에서 열 수 있습니다. 설치 항목이 보이지 않으면 즐겨찾기로 추가할 수 있어요.');
  });
  refresh();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(new URL('sw.js', root).href, {scope: root.pathname}).catch(function (error) {
        console.warn('교재의 오프라인 기능을 준비하지 못했습니다.', error);
      });
    });
  }
})();
