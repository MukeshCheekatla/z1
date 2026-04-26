/**
 * 1TamilMV - Elite [W] Search Edition
 * Fixed for Avatar & older titles
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
var MAIN_URL = 'https://www.1tamilmv.ltd';
var HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": MAIN_URL + "/"
};

function getStreams(tmdbId, type, season, episode) {
    var tmdbUrl = "https://api.themoviedb.org/3/" + (type === 'movie' ? 'movie' : 'tv') + "/" + tmdbId + "?api_key=" + TMDB_KEY;
    
    return fetch(tmdbUrl)
        .then(function(r) { return r.json(); })
        .then(function(mediaInfo) {
            var title = mediaInfo.title || mediaInfo.name;
            var year = (mediaInfo.release_date || mediaInfo.first_air_date || "").split("-")[0];
            var query = title + (year ? " " + year : "");
            var searchUrl = MAIN_URL + "/search/?q=" + encodeURIComponent(query) + "&quicksearch=1";

            return fetch(searchUrl, { headers: HEADERS })
                .then(function(r) { return r.text(); })
                .then(function(html) {
                    var $ = cheerio.load(html);
                    var watchLinks = [];
                    
                    $("a").each(function() {
                        var text = $(this).text().trim();
                        var href = $(this).attr("href");
                        if (text === "[W]" && href) {
                            var parentLi = $(this).closest("li");
                            var topicTitle = parentLi.find('a[href*="/forums/topic/"]').first().text().trim() || title;
                            watchLinks.push({ t: topicTitle, u: href });
                        }
                    });

                    // If search failed, try homepage scouting as fallback
                    if (watchLinks.length === 0) {
                        return fetch(MAIN_URL, { headers: HEADERS })
                            .then(function(r) { return r.text(); })
                            .then(function(homeHtml) {
                                var $h = cheerio.load(homeHtml);
                                $h('a:contains("[WATCH]")').each(function() {
                                    var u = $h(this).attr("href");
                                    var t = $h(this).parent().text() || title;
                                    if (t.toLowerCase().indexOf(title.toLowerCase()) !== -1) {
                                        watchLinks.push({ t: t, u: u });
                                    }
                                });
                                return watchLinks;
                            });
                    }
                    return watchLinks;
                })
                .then(function(links) {
                    return Promise.all(links.slice(0, 5).map(function(link) {
                        return fetch(link.u, { headers: HEADERS })
                            .then(function(r) { return r.text(); })
                            .then(function(h) {
                                var m = h.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i) || h.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/i);
                                if (!m) return null;
                                
                                var finalUrl = m[0].replace(/\\/g, '');
                                var qMatch = link.t.match(/\b(1080p|720p|480p|4K)\b/i);
                                var quality = qMatch ? qMatch[0].toUpperCase() : "HD";
                                var sMatch = link.t.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
                                var size = sMatch ? sMatch[1] : "Cloud";
                                
                                return {
                                    name: "1TamilMV",
                                    title: "1TamilMV (" + quality + ")\n\u1F4F9: WEB-DL\n\u1F4FC: " + title + " (" + year + ")\n\u1F4BE: " + size + "\n\u1F310: TAMIL",
                                    url: finalUrl,
                                    quality: quality,
                                    headers: { "User-Agent": HEADERS["User-Agent"], "Referer": link.u },
                                    provider: "1tamilmv"
                                };
                            }).catch(function(){ return null; });
                    }));
                });
        })
        .then(function(res) {
            return res.filter(function(x) { return x !== null; });
        })
        .catch(function() { return []; });
}

// --- Export ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = { getStreams: getStreams };
}
