const C='sme-agri-v2.7';
const FILES=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './ai-assistant.js',
  './bio-bridge.js',
  './fertilizer-pro.js',
  './invoicing.js',
  './pro-upgrade.js',
  './sme-dock.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(C)
      .then(cache=>cache.addAll(FILES))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;

  event.respondWith((async()=>{
    try{
      const response=await fetch(request);
      if(response.ok){
        const cache=await caches.open(C);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(error){
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate'){
        const appShell=await caches.match('./index.html');
        if(appShell)return appShell;
      }
      return new Response('غير متصل بالإنترنت وهذا الملف غير متاح في النسخة المحفوظة.',{
        status:503,
        statusText:'Offline',
        headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});
