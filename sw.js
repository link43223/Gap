// Gap Service Worker - 离线缓存
var CACHE = "gap-v3";
var FILES = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/articles.js",
    "/dict-zh.js",
    "/phonetic.js",
    "/manifest.json"
];

// 安装时缓存核心文件
self.addEventListener("install", function(e) {
    e.waitUntil(
        caches.open(CACHE).then(function(cache) {
            return cache.addAll(FILES);
        })
    );
});

// 激活时清理旧缓存
self.addEventListener("activate", function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE; })
                    .map(function(k) { return caches.delete(k); })
            );
        })
    );
});

// 请求拦截：缓存优先，网络兜底
self.addEventListener("fetch", function(e) {
    // API 请求走网络
    if (e.request.url.indexOf("api.dictionaryapi.dev") !== -1 ||
        e.request.url.indexOf("api.mymemory.translated.net") !== -1) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then(function(cached) {
            return cached || fetch(e.request).then(function(response) {
                // 缓存成功的网络请求
                if (response.ok && response.type === "basic") {
                    var clone = response.clone();
                    caches.open(CACHE).then(function(cache) {
                        cache.put(e.request, clone);
                    });
                }
                return response;
            });
        })
    );
});
