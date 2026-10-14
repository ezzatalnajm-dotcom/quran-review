// مراجعة الحفظ — Service Worker: يتيح العمل دون إنترنت مع وصول التحديثات تلقائيًا
const V = 'qr-v1';
const ROOT = self.registration.scope;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => c.addAll([ROOT, 'manifest.json', 'icon-192.png', 'icon-512.png'].map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return; // فحص التحديث (Range) يذهب للشبكة مباشرة
  const u = new URL(r.url);

  // صفحة التطبيق: الشبكة أولًا (لتصل التحديثات)، وإن تأخرت أو انقطعت فالنسخة المحفوظة
  if (r.mode === 'navigate') {
    const net = fetch(r).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(ROOT, c)); }
      return res;
    });
    const slow = new Promise(ok => setTimeout(() => caches.match(ROOT).then(m => m && ok(m)), 4000));
    e.respondWith(Promise.race([net, slow]).catch(() => caches.match(ROOT)));
    return;
  }

  // ملفات التطبيق الأخرى: من الذاكرة فورًا مع تحديثها في الخلفية
  if (u.origin === self.location.origin) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(m => {
      const f = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => m || Response.error());
      return m || f;
    })));
    return;
  }

  // خط أميري قرآن (Google Fonts): يُحفظ بعد أول تحميل
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(m => m || fetch(r).then(res => { c.put(r, res.clone()); return res; }))));
  }
});
