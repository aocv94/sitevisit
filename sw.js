/* Site Visit Report + Daily Log - offline worker

   The documents (index.html, daily.html) are served NETWORK-FIRST with a
   2.5s timeout, so a new deploy is picked up automatically on the next
   online launch. No version bump needed for normal edits.

   Everything else is CACHE-FIRST, so the app opens with no signal.

   Only bump VERSION when you want to purge the cache (e.g. you replaced
   the floor plan images and the old ones are still showing).

   ---------------------------------------------------------------------
   The other half of this policy lives in vercel.json, which sets the HTTP
   Cache-Control headers this worker sits on top of. JSON has no comments
   and Vercel rejects unknown keys, so the reasoning is documented here:

     /sw.js                    max-age=0, must-revalidate
       Never cached. This is the ONE mechanism by which a new deploy
       reaches a phone that already has the PWA installed. Cache this and
       you are stuck on the old version. Service-Worker-Allowed: / gives
       the worker root scope.

     /(index.html)?            max-age=0, must-revalidate
     /daily.html               max-age=0, must-revalidate
     /manifest.json            max-age=0, must-revalidate
     /manifest-daily.json      max-age=0, must-revalidate
       Always revalidate. This is the floor that the network-first +
       2.5s timeout above is built on. Every document and every manifest
       needs a rule here - a page missing from this list is the one that
       goes stale on an installed PWA.

     /plans/(.*)               max-age=0, must-revalidate
     /jspdf.umd.min.js         max-age=0, must-revalidate
       Revalidate rather than immutable, because these are replaced under
       the SAME filename (101.jpg stays 101.jpg). A long cache would leave
       you showing the old floor plan - the exact problem described above.
       Served cache-first here, so offline is still instant.

     /(icon-192|icon-512).png  max-age=31536000, immutable
       One year, no revalidation. Safe because if the icons change, the
       filename changes.
*/
var VERSION = 'svr-v2';
var TIMEOUT = 2500;

/* Los dos documentos y sus manifiestos. daily.html usa la marca vectorial de
   Constellation, que va inline en el propio HTML: no hay assets de marca que
   precachear para esa pagina. Los JPG son solo de la demo de Landwise.     */
var SHELL = [
  './index.html',
  './daily.html',
  './manifest.json',
  './manifest-daily.json',
  './jspdf.umd.min.js',
  './brand/landwise-lockup.jpg',
  './brand/landwise-mark.jpg'
];

/* Best-effort. Keep in sync with PLANS[] in index.html.
   A missing file is skipped rather than failing the install.
   Vacio a proposito: PLANS[] tambien esta vacio y los 15 JPG de plantas ya
   no estan en el repo, asi que listarlos eran 15 peticiones fallidas en cada
   install. daily.html no usa plantas.                                      */
var PLANS = [];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(VERSION).then(function(c){
      return c.addAll(SHELL).then(function(){
        return Promise.all(PLANS.map(function(p){
          return c.add(p).catch(function(){ return null; });
        }));
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isDoc(req, url){
  return req.mode === 'navigate' ||
         url.pathname === '/' ||
         /index\.html$/.test(url.pathname) ||
         /daily\.html$/.test(url.pathname);
}

/* Sin esto el fallback offline era siempre index.html, asi que abrir la
   bitacora sin cobertura mostraba el reporte de visita: la pagina equivocada,
   no una version vieja de la correcta.                                     */
function docFallback(url){
  return /daily\.html$/.test(url.pathname) ? './daily.html' : './index.html';
}

/* network, but give up fast - a garage with one bar is worse than no bars */
function networkFirst(req, url){
  return caches.open(VERSION).then(function(cache){
    var net = new Promise(function(resolve, reject){
      var done = false;
      var timer = setTimeout(function(){ if(!done){ done = true; reject(); } }, TIMEOUT);
      fetch(req).then(function(res){
        clearTimeout(timer);
        if(done) return;
        done = true;
        if(res && res.ok) cache.put(req, res.clone());
        resolve(res);
      }).catch(function(){
        clearTimeout(timer);
        if(!done){ done = true; reject(); }
      });
    });
    return net.catch(function(){
      return cache.match(req).then(function(hit){
        return hit || cache.match(docFallback(url));
      });
    });
  });
}

function cacheFirst(req){
  return caches.match(req).then(function(hit){
    if(hit) return hit;
    return fetch(req).then(function(res){
      if(res && res.ok){
        var copy = res.clone();
        caches.open(VERSION).then(function(c){ c.put(req, copy); });
      }
      return res;
    }).catch(function(){ return hit; });
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);
  if(url.origin !== self.location.origin){
    /* fonts and anything else external: try, shrug if it fails */
    e.respondWith(fetch(req).catch(function(){ return caches.match(req); }));
    return;
  }

  e.respondWith(isDoc(req, url) ? networkFirst(req, url) : cacheFirst(req));
});
