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

            // Build PlayIMDb URL — just "play" before "imdb.com"
            var playUrl = "https://www.playimdb.com/title/" + media.imdbId + "/";

            return [{
                name: "PlayIMDb",
                title: "MULTI | " + media.title + " (" + media.year + ")" + seStr,
                url: playUrl,
                quality: "HD",
                headers: { "Referer": "https://www.playimdb.com/" },
                provider: "playimdb"
            }];
        })
        .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
