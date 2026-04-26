/**
 * 1TamilMV - Hermes-Bulletproof Edition
 * NO async/await (Pure Promises) to prevent Nuvio crashes
 */

const cheerio = require('cheerio-without-node-native');

// --- Polyfills ---
function atob(v) {
    var b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o = '', c = 0, bs, b1, i = 0;
    v = String(v).replace(/=+$/, '');
    while (b1 = v.charAt(i++)) {
        b1 = b.indexOf(b1);
        if (~b1) {
            bs = c % 4 ? bs * 64 + b1 : b1;
            if (c++ % 4) o += String.fromCharCode(255 & (bs >> ((-2 * c) & 6)));
        }
    }
    return o;
}

// --- Config ---
var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://www.1tamilmv.lc';
var HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": MAIN_URL + "/"
};

// --- Helpers ---

function cleanTitle(t) {
    var m = t.match(/\[(.*?)\]/);
    if (!m) return { q: "HD", s: "Cloud", c: "AVC" };
    var p = m[1].split("-");
    return {
        q: p[0].trim() || "HD",
        s: (p.find(function(x){ return x.includes("GB") || x.includes("MB") }) || "Unknown").trim(),
        c: (p.find(function(x){ return /AVC|HEVC|x264|x265/i.test(x) }) || "AVC").trim()
    };
}

function extractStream(url) {
    return fetch(url, { headers: HEADERS })
        .then(function(r) { return r.text(); })
        .then(function(h) {
            var m = h.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i) || h.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/i);
            return m ? m[0].replace(/\\/g, '') : null;
        })
        .catch(function() { return null; });
}

// --- Main Engine ---

function getStreams(tmdbId, type, season, episode) {
    var url = "https://api.themoviedb.org/3/" + (type === 'movie' ? 'movie' : 'tv') + "/" + tmdbId + "?api_key=" + TMDB_KEY;
    
    return fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var title = data.title || data.name;
            var year = (data.release_date || data.first_air_date || "").split("-")[0];
            
            // Search multiple categories (Homepage + Archives)
            var targets = [MAIN_URL, MAIN_URL + "/index.php?/forums/forum/11-tamil-new-movies/"];
            
            return Promise.all(targets.map(function(t) {
                return fetch(t, { headers: HEADERS }).then(function(r) { return r.text(); });
            })).then(function(pages) {
                var streams = [];
                var matches = [];
                
                pages.forEach(function(html) {
                    var $ = cheerio.load(html);
                    $('a:contains("[WATCH]")').each(function() {
                        var watchUrl = $(this).attr("href");
                        var text = $(this).parent().text() || $(this).text();
                        if (text.toLowerCase().indexOf(title.toLowerCase()) !== -1) {
                            matches.push({ t: text, u: watchUrl });
                        }
                    });
                });

                // Extract first 3 matches
                return Promise.all(matches.slice(0, 3).map(function(m) {
                    return extractStream(m.u).then(function(finalUrl) {
                        if (!finalUrl) return null;
                        var info = cleanTitle(m.t);
                        return {
                            name: "1TamilMV",
                            title: "1TamilMV (" + info.q + ")\n📹: " + info.c + "\n📼: " + title + " (" + year + ")\n💾: " + info.s,
                            url: finalUrl,
                            quality: info.q,
                            headers: { "User-Agent": HEADERS["User-Agent"], "Referer": m.u }
                        };
                    });
                }));
            });
        })
        .then(function(results) {
            return results.filter(function(x) { return x !== null; });
        })
        .catch(function(e) {
            console.error("TamilMV Error:", e);
            return [];
        });
}

// --- Export ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = { getStreams: getStreams };
}
