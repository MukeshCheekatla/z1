/**
 * PlayIMDb
 * How it works: add "play" before "imdb.com" in any IMDb URL
 * https://www.imdb.com/title/tt0371746/ → https://www.playimdb.com/title/tt0371746/
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';

function safeFetch(url, options) {
    if (typeof fetchv2 === 'function') {
        var h = (options && options.headers) || {};
        var method = (options && options.method) || 'GET';
        var body = (options && options.body) || null;
        return fetchv2(url, h, method, body, true, 'utf-8');
    }
    return fetch(url, options);
}

// Get IMDb ID + title from TMDB
function getTMDBInfo(tmdbId, type) {
    var url = "https://api.themoviedb.org/3/" + (type === 'tv' ? 'tv' : 'movie') + "/" + tmdbId + "?api_key=" + TMDB_KEY;
    return safeFetch(url, {})
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var imdbId = data.imdb_id;
            var title = data.title || data.name;
            var year = (data.release_date || data.first_air_date || "").split("-")[0];

            // TV shows need separate call for imdb_id
            if (!imdbId && type === 'tv') {
                return safeFetch("https://api.themoviedb.org/3/tv/" + tmdbId + "/external_ids?api_key=" + TMDB_KEY, {})
                    .then(function(r) { return r.json(); })
                    .then(function(ext) {
                        return { imdbId: ext.imdb_id, title: title, year: year };
                    });
            }
            return { imdbId: imdbId, title: title, year: year };
        })
        .catch(function() { return { imdbId: null, title: "Unknown", year: "" }; });
}

function getStreams(tmdbId, type, season, episode) {
    return getTMDBInfo(tmdbId, type)
        .then(function(media) {
            if (!media.imdbId) return [];

            var seStr = type === 'tv' ? " S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0") : "";
            
            // Base URL for scanning
            var playUrl = "https://www.playimdb.com/title/" + media.imdbId + "/";

            // Deep extraction logic to bypass redirects and "Play Button" pages
            function extract(url, ref, depth) {
                if (depth > 4) return Promise.resolve(url);
                
                var headers = { 
                    "Referer": ref || "https://www.playimdb.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                };

                return safeFetch(url, { headers: headers })
                    .then(function(r) { return r.text(); })
                    .then(function(html) {
                        // A. IF TV SHOW: Find the specific episode in the "Hamburger Menu"
                        if (type === 'tv' && depth === 0) {
                            // More robust regex that handles attributes in any order
                            var epMatch = html.match(new RegExp('<div[^>]+class=["\']ep[^>]+data-s=["\']' + season + '["\'][^>]+data-e=["\']' + episode + '["\'][^>]+data-iframe=["\']([^"\']+)["\']', 'i')) ||
                                          html.match(new RegExp('<div[^>]+class=["\']ep[^>]+data-iframe=["\']([^"\']+)["\'][^>]+data-s=["\']' + season + '["\'][^>]+data-e=["\']' + episode + '["\']', 'i'));
                            
                            if (epMatch) {
                                var next = epMatch[1];
                                if (next.startsWith('/')) next = "https://www.playimdb.com" + next;
                                return extract(next, url, depth + 1);
                            }
                        }

                        // B. Check for direct video sources (.m3u8, .mp4, or known hosts)
                        var videoPatterns = [
                            /https?:\/\/[^\s"']+\.m3u8[^\s"']*/i,
                            /https?:\/\/[^\s"']+\.mp4[^\s"']*/i,
                            /(?:file|source|src|url)\s*[=:]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
                            /["'](https?:\/\/[^"']+(?:putgate|vidsrc|vidsrc-embed|vidsrcme|vsrc|vsembed|cloudnestra)[^"']+)["']/i
                        ];
                        for (var i = 0; i < videoPatterns.length; i++) {
                            var m = html.match(videoPatterns[i]);
                            if (m) {
                                var v = (m[1] || m[0]).replace(/\\/g, '');
                                if (v.includes('m3u8') || v.includes('mp4') || v.includes('putgate')) return v;
                            }
                        }

                        // C. Look for "loadIframe" style JS injections (Bypasses the "Play Button")
                        var jsIframeMatch = html.match(/src\s*:\s*['"](\/(?:pro)?rcp\/[^'"]+)['"]/);
                        if (jsIframeMatch) {
                            var base = new URL(url).origin;
                            return extract(base + jsIframeMatch[1], url, depth + 1);
                        }

                        // D. Follow standard iframes
                        var iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                        if (iframeMatch) {
                            var nextUrl = iframeMatch[1];
                            if (nextUrl.startsWith('//')) nextUrl = 'https:' + nextUrl;
                            if (nextUrl.startsWith('/')) nextUrl = new URL(url).origin + nextUrl;
                            // Avoid infinite loops if iframe points to self
                            if (nextUrl !== url) return extract(nextUrl, url, depth + 1);
                        }

                        return url;
                    })
                    .catch(function() { return url; });
            }

            return extract(playUrl, "https://www.playimdb.com/", 0)
                .then(function(finalUrl) {
                    var streams = [];
                    
                    // Stream 1: The extracted direct source
                    streams.push({
                        name: "PlayIMDb | MULTI | HD",
                        title: media.title + " (" + media.year + ")" + seStr + "\nSource: Direct Player",
                        url: finalUrl,
                        quality: "HD",
                        headers: { "Referer": "https://www.playimdb.com/" },
                        provider: "playimdb"
                    });

                    // Stream 2: Verified VidSrc Mirror (Official API: vidsrc-embed.ru)
                    var mirrorUrl = type === 'tv' 
                        ? "https://vidsrc-embed.ru/embed/tv/" + media.imdbId + "/" + season + "-" + episode
                        : "https://vidsrc-embed.ru/embed/movie/" + media.imdbId;
                    
                    streams.push({
                        name: "VidSrc | MIRROR | HD",
                        title: media.title + " (" + media.year + ")" + seStr + "\nSource: Vidsrc Network",
                        url: mirrorUrl,
                        quality: "HD",
                        headers: { "Referer": "https://vidsrc-embed.ru/" },
                        provider: "playimdb"
                    });

                    return streams;
                });
        })
        .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
