/**
 * PlayIMDb - Elite Edition
 * Fixed for Avatar & older titles
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
    var url = "https://api.themoviedb.org/3/" + (type === 'movie' ? 'movie' : 'tv') + "/" + tmdbId + "?api_key=" + TMDB_KEY;

    return fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var imdbId = data.imdb_id;
            var title = data.title || data.name;
            var year = (data.release_date || data.first_air_date || "").split("-")[0];
            var seStr = type === 'tv' ? " S" + season + "E" + episode : "";

            if (!imdbId && data.external_ids) imdbId = data.external_ids.imdb_id;
            if (!imdbId) return [];

            return [
                {
                    name: "PlayIMDb",
                    title: "PlayIMDb (Multi)\n\u{1F4F9}: WEB-Stream\n\u{1F4FC}: " + title + " (" + year + ")" + seStr + "\n\u{1F4BE}: Cloud-Play\n\u{1F310}: MULTI-AUDIO",
                    url: "https://www.playimdb.com/title/" + imdbId + "/",
                    quality: "MULTI",
                    provider: "playimdb"
                },
                {
                    name: "VidSrc",
                    title: "VidSrc (HD)\n\u{1F4F9}: WEB-DL\n\u{1F4FC}: " + title + " (" + year + ")" + seStr + "\n\u{1F4BE}: Auto-Scale\n\u1F310: ENGLISH",
                    url: "https://vidsrc.me/embed/" + imdbId + "/",
                    quality: "HD",
                    provider: "vidsrc"
                }
            ];
        })
        .catch(function() {
            return [];
        });
}

// --- Export ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = { getStreams: getStreams };
}
