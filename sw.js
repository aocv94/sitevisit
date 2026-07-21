/* Constellation Site Visit Report - offline worker

   index.html is served NETWORK-FIRST with a 2.5s timeout, so a new deploy
   is picked up automatically on the next online launch. No version bump
   needed for normal edits.

   Everything else is CACHE-FIRST, so the app opens with no signal.

   Only bump VERSION when you want to purge the cache (e.g. you replaced
   the floor plan images and the old ones are still showing).
*/
var VERSION = 'svr-v1';
var TIMEOUT = 2500;

var SHELL = [
  './index.html',
  './manifest.json',
  './jspdf.umd.min.js'
];

/* Best-effort. Keep in sync with PLANS[] in index.html.
   A missing file is skipped rather than failing the install. */
var PLANS = [
  './plans/101.jpg', './plans/102.jpg', './plans/103.jpg', './plans/103a.jpg',
  './plans/104.jpg', './plans/105.jpg', './plans/106.jpg', './plans/107.jpg',
  './plans/108.jpg', './plans/109.jpg', './plans/110.jpg', './plans/111.jpg',
  './plans/112.jpg', './plans/113.jpg', './plans/114.jpg'
];

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
         /index\.html$/.test(url.pathname);
}

/* network, but give up fast - a garage with one bar is worse than no bars */
function networkFirst(req){
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
        return hit || cache.match('./index.html');
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

  e.respondWith(isDoc(req, url) ? networkFirst(req) : cacheFirst(req));
});
