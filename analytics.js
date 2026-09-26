/* Paws 측정.
 *
 * 쿠키도 지문도 쓰지 않는다 — 앱이 "데이터가 이 기계를 떠나지 않습니다" 라고 약속했다.
 * 사이트가 그보다 헐거우면 그 약속이 거짓말이 된다.
 *
 * TOKEN 이 비어 있으면 아무것도 바깥으로 보내지 않는다.
 * 출처를 링크에 붙이는 일은 토큰과 무관하게 언제나 한다 — 그쪽은 우리 서버도 제3자도 거치지 않고
 * 결제 정보에 그대로 실려 간다.
 */
(function () {
  'use strict';

  /* Cloudflare 대시보드 → Web Analytics → Add a site → beacon token 을 여기에 붙인다.
   * 무료, 쿠키 없음, 동의 배너 불필요. 채우는 순간부터 방문이 잡힌다. */
  var TOKEN = '3913344a4f8641eab7b14c64cfb8acc5';

  var lang = (document.documentElement.lang || 'ko').toLowerCase();
  var REF_KEY = 'paws.ref';

  /* 처음 들어온 경로를 세션에 적어 둔다. 사이트 안에서 페이지를 옮기면 referrer 가
   * 우리 자신으로 덮이기 때문에, 결제 순간에는 이미 "어디서 왔는지" 를 잃는다. */
  function source() {
    try {
      var q = new URLSearchParams(location.search).get('utm_source');
      if (q) { sessionStorage.setItem(REF_KEY, q.slice(0, 60)); return q.slice(0, 60); }
      var saved = sessionStorage.getItem(REF_KEY);
      if (saved) return saved;
      var host = document.referrer ? new URL(document.referrer).hostname : '';
      if (host && host !== location.hostname) {
        sessionStorage.setItem(REF_KEY, host.slice(0, 60));
        return host.slice(0, 60);
      }
    } catch (e) { /* 사파리 프라이빗 창에서는 sessionStorage 가 던진다. 측정은 포기하고 페이지는 산다. */ }
    return '';
  }

  /* 결제까지 살아남는 유일한 표시. Lemon Squeezy 가 주문에 custom 필드로 저장하므로,
   * 애널리틱스가 없어도 "어느 언어 페이지에서, 어느 채널로 온 사람이 샀는가" 를 알 수 있다. */
  function tagCheckoutLinks() {
    var links = document.querySelectorAll('a[href*="lemonsqueezy.com/checkout"]');
    var src = source();
    for (var i = 0; i < links.length; i++) {
      try {
        var u = new URL(links[i].href);
        u.searchParams.set('checkout[custom][lang]', lang);
        if (src) u.searchParams.set('checkout[custom][src]', src);
        links[i].href = u.toString();
      } catch (e) { /* 손댈 수 없는 링크는 그대로 둔다. 구매를 막는 것보다 낫다. */ }
    }
  }

  /* 내려받기는 감사 페이지를 거친다. 그래야 다운로드가 한 번의 방문으로 세어지고,
   * 처음 여는 사람에게 설치 세 줄을 보여줄 자리가 생긴다. */
  function routeDownloads() {
    var base = document.body.getAttribute('data-root') || '';
    var links = document.querySelectorAll('a[href$=".dmg"]:not([data-direct])');
    for (var i = 0; i < links.length; i++) {
      var file = links[i].getAttribute('href').split('/').pop();
      links[i].setAttribute('href', base + 'thanks.html?lang=' + encodeURIComponent(lang) + '&f=' + encodeURIComponent(file));
      links[i].removeAttribute('download');
    }
  }

  if (TOKEN) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
    document.head.appendChild(s);
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () { tagCheckoutLinks(); routeDownloads(); });
})();
