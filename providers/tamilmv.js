/**
 * 1TamilMV - Elite Edition
 * Fixes: Source Error (LuluVid extraction), correct stream title/name display
 */

var cheerio = require('cheerio-without-node-native');

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://www.1tamilmv.ltd';
var HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": "https://www.1tamilmv.ltd/"
};

// Use Nuvio's fetchv2 if available (bypasses CORS)
function safeFetch(url, options) {
    if (typeof fetchv2 === 'function') {
        var h = (options && options.headers) || {};
        var method = (options && options.method) || 'GET';
        var body = (options && options.body) || null;
        return fetchv2(url, h, method, body, true, 'utf-8');
    }
    return fetch(url, options);
}

// Unpack JS Packer — supports base 62+ (used by LuluVid/HGLink)
function unpack(p, a, c, k) {
    var intToBase = function(num, radix) {
        if (radix <= 36) return num.toString(radix);
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var str = "";
        do {
            str = chars[num % radix] + str;
            num = Math.floor(num / radix);
        } while (num > 0);
        return str;
    };
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp('\\b' + intToBase(c, a) + '\\b', 'g'), k[c]);
        }
    }
    return p;
}

// Strmup uses a special AJAX endpoint (not page regex)
function extractFromStrmup(embedUrl) {
    try {
        var urlObj = new URL(embedUrl);
        var filecode = urlObj.pathname.split('/').filter(function(p) { return p; }).pop();
        if (!filecode) return Promise.resolve(null);

        var ajaxUrl = urlObj.origin + '/ajax/stream?filecode=' + filecode;
        return safeFetch(ajaxUrl, {
            headers: { "User-Agent": HEADERS["User-Agent"], "Referer": embedUrl, "X-Requested-With": "XMLHttpRequest" }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) { return data && data.streaming_url ? data.streaming_url : null; })
        .catch(function() { return null; });
    } catch(e) { return Promise.resolve(null); }
}

// Extract direct .m3u8 / .mp4 from embed hosts (LuluVid, HGLink, etc.)
function extractFromEmbed(embedUrl) {
    // Route to specialized extractor if host is strmup
    try {
        var host = new URL(embedUrl).hostname.toLowerCase();
        if (host.indexOf('strmup') !== -1) return extractFromStrmup(embedUrl);
    } catch(e) {}

    return safeFetch(embedUrl, { headers: { "User-Agent": HEADERS["User-Agent"], "Referer": MAIN_URL } })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            // Mirror fallback: if LuluVid returns a loading page, try known mirrors
            if (html.indexOf('<title>Loading') !== -1 || html.indexOf('Page is loading') !== -1) {
                var mirrors = ['yuguaab.com', 'cavanhabg.com'];
                var embedHost;
                try { embedHost = new URL(embedUrl).hostname; } catch(e) { embedHost = ''; }
                var mirrorPromises = mirrors.map(function(mirror) {
                    if (embedHost.indexOf(mirror) !== -1) return Promise.resolve(null);
                    return safeFetch(embedUrl.replace(embedHost, mirror), {
                        headers: { "User-Agent": HEADERS["User-Agent"], "Referer": MAIN_URL }
                    }).then(function(r) { return r.text(); }).catch(function() { return null; });
                });
                return Promise.all(mirrorPromises).then(function(results) {
                    for (var i = 0; i < results.length; i++) {
                        if (results[i] && (results[i].indexOf('jwplayer') !== -1 || results[i].indexOf('sources') !== -1 || results[i].indexOf('eval(function') !== -1)) {
                            html = results[i];
                            break;
                        }
                    }
                    return extractVideoFromHtml(html, embedUrl);
                });
            }
            return extractVideoFromHtml(html, embedUrl);
        })
        .catch(function() { return null; });
}

// Shared video extraction logic from HTML
function extractVideoFromHtml(html, embedUrl) {
    var embedBase;
    try { embedBase = new URL(embedUrl).origin; } catch(e) { embedBase = ''; }

    // Unpack JS Packer if present
    var packerMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\s*\(([\s\S]*)\)\s*\)/);
    if (packerMatch) {
        try {
            var raw = packerMatch[1].trim();
            var pMatch = raw.match(/^'([\s\S]*)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\s*\.split\(/);
            if (pMatch) {
                html += "\n" + unpack(pMatch[1], parseInt(pMatch[2]), parseInt(pMatch[3]), pMatch[4].split('|'));
            }
        } catch(e) {}
    }

    // Try to find video URL
    var patterns = [
        /["']hls[2-4]["']\s*:\s*["']([^"']+)["']/i,
        /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i,
        /https?:\/\/[^\s"']+\.m3u8[^\s"']*/i,
        /https?:\/\/[^\s"']+\.mp4[^\s"']*/i,
        /(?:source|file|src)\s*[=:]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var m = html.match(patterns[i]);
        if (m) {
            var videoUrl = m[1] || m[0];
            videoUrl = videoUrl.replace(/[\\]+/g, '').replace(/["']+$/, '');
            if (videoUrl && videoUrl.length > 10) {
                if (videoUrl.startsWith('/') && !videoUrl.startsWith('//')) videoUrl = embedBase + videoUrl;
                return videoUrl;
            }
        }
    }
    return null;
}


function getStreams(tmdbId, type, season, episode) {
    var title, year;

    return safeFetch("https://api.themoviedb.org/3/" + (type === 'movie' ? 'movie' : 'tv') + "/" + tmdbId + "?api_key=" + TMDB_KEY, {})
        .then(function(r) { return r.json(); })
        .then(function(info) {
            title = info.title || info.name;
            year = (info.release_date || info.first_air_date || "").split("-")[0];

            // Smart search: specific for TV, title+year for movies
            var q1 = type === "tv"
                ? title + " S" + String(season).padStart(2, "0") + " E" + String(episode).padStart(2, "0")
                : title + (year ? " " + year : "");
            var q2 = title;

            // Try q1 first, fallback to q2
            function trySearch(queries, idx) {
                if (idx >= queries.length) return Promise.resolve([]);
                var url = MAIN_URL + "/search/?q=" + encodeURIComponent(queries[idx]) + "&quicksearch=1";
                return safeFetch(url, { headers: HEADERS })
                    .then(function(r) { return r.text(); })
                    .then(function(html) {
                        var $ = cheerio.load(html);
                        var links = [];
                        $("a").each(function() {
                            var txt = $(this).text().trim();
                            var href = $(this).attr("href");
                            if (txt === "[W]" && href) {
                                var topicTitle = $(this).closest("li").find('a[href*="/forums/topic/"]').first().text().trim() || title;
                                links.push({ t: topicTitle, u: href });
                            }
                        });
                        if (links.length > 0) return links;
                        return trySearch(queries, idx + 1);
                    });
            }

            return trySearch([q1, q2], 0);
        })
        .then(function(links) {
            // For each [W] link, extract the direct video URL from the embed
            return Promise.all(links.slice(0, 5).map(function(link) {
                return extractFromEmbed(link.u).then(function(videoUrl) {
                    if (!videoUrl) return null;

                    // Parse metadata from topic title
                    var qualities = link.t.match(/\b(2160p|4K|1080p|720p|480p|360p)\b/ig) || [];
                    var seen = {};
                    var uniqueQ = [];
                    for (var i = 0; i < qualities.length; i++) {
                        var q = qualities[i].toUpperCase();
                        if (!seen[q]) { seen[q] = 1; uniqueQ.push(q); }
                    }
                    var qualityStr = uniqueQ.length > 0 ? uniqueQ.join(", ") : "HD";

                    var topQ = "HD";
                    if (uniqueQ.indexOf("4K") !== -1 || uniqueQ.indexOf("2160P") !== -1) topQ = "4K";
                    else if (uniqueQ.indexOf("1080P") !== -1) topQ = "1080p";
                    else if (uniqueQ.indexOf("720P") !== -1) topQ = "720p";

                    var sizes = link.t.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/ig) || [];
                    var sizeStr = sizes.join(" | ") || "Cloud";

                    var lang = "TAMIL";
                    var tl = link.t.toLowerCase();
                    if (tl.indexOf("telugu") !== -1) lang = "TELUGU";
                    else if (tl.indexOf("hindi") !== -1) lang = "HINDI";
                    else if (tl.indexOf("malayalam") !== -1) lang = "MALAYALAM";
                    else if (tl.indexOf("kannada") !== -1) lang = "KANNADA";
                    else if (tl.indexOf("english") !== -1) lang = "ENGLISH";

                    // Nuvio displays: name = top label, title = subtitle/description
                    return {
                        name: "1TamilMV | " + topQ + " | " + lang,
                        title: qualityStr + " | " + sizeStr + " | " + title + " (" + year + ")",
                        url: videoUrl,
                        quality: topQ,
                        headers: { "User-Agent": HEADERS["User-Agent"], "Referer": link.u },
                        provider: "1tamilmv"
                    };
                });
            }));
        })
        .then(function(results) {
            return (results || []).filter(function(x) { return x !== null; });
        })
        .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
