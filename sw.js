// Gap Service Worker - 离线缓存
var CACHE = "gap-v30";
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
    // 新版本立即接管，避免旧缓存继续服务（配合 activate 的 clients.claim）
    self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener("activate", function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// 请求拦截
self.addEventListener("fetch", function(e) {
    // API 请求走网络
    if (e.request.url.indexOf("api.dictionaryapi.dev") !== -1 ||
        e.request.url.indexOf("api.mymemory.translated.net") !== -1) {
        return;
    }

    // 页面导航（HTML）：网络优先，离线才回退缓存 —— 保证用户总是拿到最新版本，
    // 避免 cache-first 导致 index.html 永远命中旧缓存（"版本古老"问题根因）
    if (e.request.mode === "navigate") {
        e.respondWith(
            fetch(e.request).then(function(response) {
                if (response.ok) {
                    var clone = response.clone();
                    caches.open(CACHE).then(function(cache) {
                        cache.put(e.request, clone);
                    });
                }
                return response;
            }).catch(function() {
                return caches.match(e.request);
            })
        );
        return;
    }

    // se-books 数据
    if (e.request.url.indexOf("/se-books/") !== -1) {
        // se-catalog.json 是书架索引：网络优先保证新增书立即可见（离线才回退缓存）
        if (e.request.url.indexOf("se-catalog.json") !== -1) {
            e.respondWith(
                fetch(e.request).then(function(response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
                    }
                    return response;
                }).catch(function() { return caches.match(e.request); })
            );
            return;
        }
        // data.js 等书数据：Stale-While-Revalidate，先返回缓存（快 + 离线可用），后台更新
        e.respondWith(
            caches.match(e.request).then(function(cached) {
                var network = fetch(e.request).then(function(response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
                    }
                    return response;
                }).catch(function() { return cached; });
                return cached || network;
            })
        );
        return;
    }

    // 静态资源（带版本 query，URL 变化即重新缓存）：缓存优先，网络兜底
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
