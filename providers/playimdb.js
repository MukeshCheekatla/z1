/**
 * PlayIMDb - Hermes-Bulletproof Edition
 * NO async/await (Pure Promises) to prevent Nuvio crashes
 */

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

function getStreams(tmdbId, type, season, episode) {
    var url = "https://api.themoviedb.org/3/" + (type === 'movie' ? 'movie' : 'tv') + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&append_to_response=external_ids";

    return fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var id = data.external_ids && data.external_ids.imdb_id ? data.external_ids.imdb_id : tmdbId;
            var title = data.title || data.name;
            var year = (data.release_date || data.first_air_date || "").split("-")[0];
            var se = type === 'tv' ? " S" + season + "E" + episode : "";

            var sources = [
                { n: "VidSrc (Premium)", u: type === 'movie' ? "https://vidsrc.me/embed/movie?imdb=" + id : "https://vidsrc.me/embed/tv?imdb=" + id + "&sea=" + season + "&epi=" + episode },
                { n: "VidSrc.pro", u: type === 'movie' ? "https://vidsrc.pro/embed/movie/" + id : "https://vidsrc.pro/embed/tv/" + id + "/" + season + "/" + episode },
                { n: "VidSrc.to", u: type === 'movie' ? "https://vidsrc.to/embed/movie/" + id : "https://vidsrc.to/embed/tv/" + id + "/" + season + "/" + episode }
            ];

            return sources.map(function(s) {
                return {
                    name: "PlayIMDb",
                    title: s.n + " (HD)\n📹: WEB-DL (Multi-Audio)\n📼: " + title + " (" + year + ")" + se + "\n🌐: MULTI-LANGUAGE",
                    url: s.u,
                    quality: "1080p",
                    headers: { "Referer": "https://vidsrc.me/", "User-Agent": "Mozilla/5.0" },
                    provider: "playimdb"
                };
            });
        })
        .catch(function(e) {
            console.error("PlayIMDb Error:", e);
            return [];
        });
}

// --- Export ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = { getStreams: getStreams };
}
