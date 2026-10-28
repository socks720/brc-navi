/*
 * BRC Safari 코스 가져오기 · Add-on v1.0
 * 별도 JS로 기존 index.html의 저장/폴더/카카오내비 구현을 수정하지 않음.
 * 지원: ?t=...&p=... (BRC v4.1), ?t=...&v=...&d=... (legacy), #brc=... (internal share)
 * 실제 저장은 원래 BRC 화면에서 사용자가 수행함.
 */
(function () {
  'use strict';

  var BASE = 'https://socks720.github.io/brc-navi/';
  var MAX_CHARS = 50000;
  var MAX_POINTS = 60;

  function cleanInput(raw) {
    var s = String(raw || '').trim();
    if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim();
    return s;
  }

  function parseImportLink(raw) {
    var input = cleanInput(raw);
    if (!input) throw new Error('BRC 코스 주소를 붙여넣어 줘.');
    if (input.length > MAX_CHARS) throw new Error('링크가 너무 길어. 50,000자 이하만 지원해.');
    var url;
    try {
      // BRC 자체의 경로로 된 주소도 허용. 다른 사이트의 상대 URL은 불허.
      if (input.startsWith('?') || input.startsWith('#brc=')) url = new URL(input, BASE);
      else url = new URL(input);
    } catch (e) { throw new Error('올바른 URL이 아니야. BRC 전체 주소를 복사해 줘.'); }

    if (url.protocol !== 'https:' || url.hostname !== 'socks720.github.io' ||
        (url.pathname !== '/brc-navi/' && url.pathname !== '/brc-navi' && url.pathname !== '/brc-navi/index.html') ||
        url.username || url.password || url.port) {
      throw new Error('공식 BRC 주소만 가져올 수 있어. (socks720.github.io/brc-navi/)');
    }
    if (url.hash && !url.hash.startsWith('#brc=')) {
      throw new Error('BRC 공유 링크(#brc=...) 또는 코스 등록 링크가 필요해.');
    }
    if (url.hash.startsWith('#brc=') && url.hash.length > 5) {
      if (url.searchParams.has('t') || url.searchParams.has('p')) {
        throw new Error('코스 등록 링크와 공유 링크가 동시에 들어 있어. 하나만 사용해 줘.');
      }
      return { type: 'share', name: 'BRC 공유 코스', count: null, url: BASE + url.hash };
    }

    var params = url.searchParams;
    var name = (params.get('t') || '').trim();
    if (!name) throw new Error('코스명(t=)이 없는 링크야.');

    var points = params.getAll('p');
    if (points.length > 0) {
      if (points.length > MAX_POINTS) throw new Error('경유·도착 지점은 최대 60개까지 지원해.');
      points.forEach(function (point, index) {
        var at = point.lastIndexOf('@');
        if (at <= 0) throw new Error((index + 1) + '번 지점 이름이나 좌표가 잘못됐어.');
        var coords = point.slice(at + 1).split(',');
        if (coords.length !== 2 || !coords[0].trim() || !coords[1].trim())
          throw new Error((index + 1) + '번 지점 좌표가 잘못됐어. 경도,위도 순서야.');
        var x = Number(coords[0]), y = Number(coords[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180 || x > 180 || y < -90 || y > 90)
          throw new Error((index + 1) + '번 지점 좌표 범위가 잘못됐어.');
      });
      // 원본의 t/p 순서와 map=을 보존하고, 불필요한 추적 매개변수만 제거.
      ['gclid', 'fbclid', 'mc_cid', 'mc_eid'].forEach(function (key) { params.delete(key); });
      Array.from(params.keys()).forEach(function (key) { if (/^utm_/i.test(key)) params.delete(key); });
      return { type: 'full', name: name, count: points.length, url: BASE + '?' + params.toString() };
    }
    if (params.has('v') && params.has('d') && params.get('v') && params.get('d')) {
      return { type: 'legacy', name: name, count: null, url: BASE + '?' + params.toString() };
    }
    throw new Error('BRC 등록 링크는 t와 p= 지점이 필요해. (기존 v/d 방식도 가능)');
  }

  // Node 테스트에서도 핵심 URL 검증 함수를 사용할 수 있게 공개함.
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseImportLink: parseImportLink };
  if (typeof document === 'undefined') return;

  function init() {
    if (document.getElementById('brc-import-widget-root')) return;
    var style = document.createElement('style');
    style.id = 'brc-import-widget-style';
    style.textContent = `
#brc-import-widget-root {position:relative;z-index:2147483000;font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo','Malgun Gothic',sans-serif;}
#brc-import-widget-root * {box-sizing:border-box;}
#brc-import-widget-root .brci-fab {position:fixed;right:14px;bottom:calc(84px + env(safe-area-inset-bottom,0px));border:0;border-radius:25px;padding:12px 17px;background:#1858b8;color:#fff;font-size:14px;font-weight:700;box-shadow:0 4px 16px #0004;cursor:pointer;z-index:2147483001;}
#brc-import-widget-root .brci-fab:focus-visible,#brc-import-widget-root button:focus-visible,#brc-import-widget-root textarea:focus-visible {outline:3px solid #80baff;outline-offset:2px;}
#brc-import-widget-root .brci-overlay {position:fixed;inset:0;background:#0009;display:none;align-items:center;justify-content:center;padding:18px;z-index:2147483002;}
#brc-import-widget-root .brci-overlay[aria-hidden="false"] {display:flex;}
#brc-import-widget-root .brci-dialog {width:min(100%,470px);max-height:min(90vh,700px);overflow:auto;background:#fff;color:#202632;border-radius:18px;padding:22px 18px 18px;box-shadow:0 15px 60px #0006;}
#brc-import-widget-root .brci-head {display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}
#brc-import-widget-root .brci-title {font-size:19px;font-weight:800;margin:0;}
#brc-import-widget-root .brci-close {border:0;background:#eef1f5;color:#293343;font-size:24px;line-height:1;border-radius:50%;width:36px;height:36px;cursor:pointer;}
#brc-import-widget-root .brci-desc {font-size:13px;line-height:1.55;color:#586373;margin:8px 0 14px;}
#brc-import-widget-root .brci-label {display:block;font-weight:700;font-size:14px;margin:8px 0 7px;}
#brc-import-widget-root textarea {display:block;width:100%;min-height:114px;resize:vertical;border:1px solid #bcc6d2;border-radius:10px;padding:12px;font:13px/1.5 inherit;color:#202632;overflow-wrap:anywhere;background:#fff;}
#brc-import-widget-root .brci-actions {display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
#brc-import-widget-root .brci-button {min-height:43px;border:0;border-radius:10px;padding:10px 15px;font-size:14px;font-weight:750;cursor:pointer;background:#1858b8;color:#fff;}
#brc-import-widget-root .brci-secondary {background:#eaf0fa;color:#184e9a;}
#brc-import-widget-root .brci-error {font-size:13px;line-height:1.5;color:#a32828;min-height:1.4em;white-space:pre-wrap;margin-top:12px;}
#brc-import-widget-root .brci-preview {display:none;background:#eef6ff;padding:12px;border-radius:10px;margin-top:12px;line-height:1.5;font-size:14px;overflow-wrap:anywhere;}
#brc-import-widget-root .brci-preview strong {display:block;font-size:15px;margin-bottom:4px;}
#brc-import-widget-root .brci-note {font-size:12px;color:#626c7c;margin:14px 0 0;line-height:1.55;}
@media(prefers-color-scheme:dark){#brc-import-widget-root .brci-dialog{background:#1f2735;color:#f4f6fb;}#brc-import-widget-root .brci-close{background:#344155;color:#fff;}#brc-import-widget-root textarea{background:#161e2a;border-color:#64748b;color:#fff;}#brc-import-widget-root .brci-desc,#brc-import-widget-root .brci-note{color:#bfccdb;}#brc-import-widget-root .brci-preview{background:#183753;color:#f4f6fb;}#brc-import-widget-root .brci-secondary{background:#334a6b;color:#e9f3ff;}#brc-import-widget-root .brci-error{color:#ffa9a9;}}
`;
    document.head.appendChild(style);
    var root = document.createElement('div');
    root.id = 'brc-import-widget-root';
    root.innerHTML = `
<button class="brci-fab" type="button" aria-label="BRC URL 붙여넣기로 코스 가져오기">＋ 코스 가져오기</button>
<div class="brci-overlay" aria-hidden="true">
  <section class="brci-dialog" role="dialog" aria-modal="true" aria-labelledby="brci-title">
    <div class="brci-head"><h2 id="brci-title" class="brci-title">URL로 코스 가져오기</h2><button class="brci-close" type="button" aria-label="닫기">×</button></div>
    <p class="brci-desc">다른 앱에서 BRC 코스 링크를 복사한 뒤, Safari의 이 화면에 붙여넣어 줘.</p>
    <label class="brci-label" for="brci-url">BRC 코스 등록·공유 URL</label>
    <textarea id="brci-url" spellcheck="false" placeholder="https://socks720.github.io/brc-navi/?t=...&p=..."></textarea>
    <div class="brci-actions"><button class="brci-button brci-secondary brci-paste" type="button">클립보드 붙여넣기</button><button class="brci-button brci-check" type="button">링크 확인</button></div>
    <div class="brci-error" role="alert" aria-live="polite"></div>
    <div class="brci-preview" aria-live="polite"><strong class="brci-preview-title"></strong><span class="brci-preview-details"></span><div class="brci-actions"><button class="brci-button brci-open" type="button">기존 BRC에서 열기</button></div></div>
    <p class="brci-note">기존 보관함·폴더는 변경하지 않아. 링크를 열면 BRC의 원래 저장 기능으로 코스를 보관함에 저장해 줘. Safari 탭에서 실행해야 Safari 데이터가 이어져.</p>
  </section>
</div>`;
    document.body.appendChild(root);
    var fab = root.querySelector('.brci-fab');
    var overlay = root.querySelector('.brci-overlay');
    var close = root.querySelector('.brci-close');
    var textarea = root.querySelector('#brci-url');
    var error = root.querySelector('.brci-error');
    var preview = root.querySelector('.brci-preview');
    var previewTitle = root.querySelector('.brci-preview-title');
    var previewDetails = root.querySelector('.brci-preview-details');
    var current = null;
    var previousFocus = null;

    function show() { previousFocus = document.activeElement; overlay.setAttribute('aria-hidden','false'); setTimeout(function(){ textarea.focus(); },0); }
    function hide() { overlay.setAttribute('aria-hidden','true'); current = null; preview.style.display = 'none'; error.textContent = ''; if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus(); }
    function updateInput() { current = null; preview.style.display = 'none'; error.textContent = ''; }
    fab.addEventListener('click', show);
    close.addEventListener('click', hide);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) hide(); });
    document.addEventListener('keydown', function(e) {
      if (overlay.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape') { e.preventDefault(); hide(); }
      // 간단한 키보드 포커스 순환
      if (e.key === 'Tab') {
        var els = Array.from(overlay.querySelectorAll('button,textarea')).filter(function(el){return el.offsetParent !== null;});
        if (els.length) {
          var first = els[0], last = els[els.length - 1];
          if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus();}
          else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus();}
        }
      }
    });
    textarea.addEventListener('input', updateInput);
    root.querySelector('.brci-paste').addEventListener('click', async function() {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        error.textContent = '자동 붙여넣기가 제한된 환경이야. 입력창을 길게 누르고 붙여넣기를 선택해 줘.';
        textarea.focus();
        return;
      }
      try { textarea.value = await navigator.clipboard.readText(); updateInput(); textarea.focus(); }
      catch (e) { error.textContent = '클립보드 접근이 차단됐어. 입력창을 길게 누른 뒤 붙여넣기를 선택해 줘.'; textarea.focus(); }
    });
    root.querySelector('.brci-check').addEventListener('click', function() {
      updateInput();
      try {
        current = parseImportLink(textarea.value);
        previewTitle.textContent = current.name;
        previewDetails.textContent = current.count == null ? 'BRC 공유·이전 링크 · 기존 BRC가 내용을 해석해.' : '경유·도착 ' + current.count + '개 · ' + Math.ceil(current.count / 4) + '구간 자동 분할';
        preview.style.display = 'block';
      } catch (e) { error.textContent = e.message; }
    });
    root.querySelector('.brci-open').addEventListener('click', function() {
      if (!current) return;
      // 동일한 Safari 탭 · 동일한 GitHub Pages origin으로 이동: 별도 브라우저 저장소를 만들지 않음.
      window.location.assign(current.url);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
