/**
 * PlayIMDb - Gimmick Scraper (Nuvio Optimized)
 */

const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function getTMDBDetails(tmdbId, mediaType) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return {
        title: data.title || data.name || "Unknown",
        year: (data.release_date || data.first_air_date || "").split("-")[0] || "N/A",
        imdbId: data.imdb_id
    };
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        if (!mediaInfo.imdbId) return [];

        const results = [];
        
        // PlayIMDb Trick
        results.push({
            name: "PlayIMDb",
            title: `PlayIMDb (Multi)\n📹: WEB-Stream\n📼: ${mediaInfo.title} (${mediaInfo.year})\n💾: Auto-Scale\n🌐: MULTI-AUDIO`,
            url: `https://www.playimdb.com/title/${mediaInfo.imdbId}/`,
            quality: "MULTI",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Referer": "https://www.playimdb.com/"
            },
            provider: "playimdb"
        });

        // VidSrc Backup
        results.push({
            name: "VidSrc",
            title: `VidSrc (HD)\n📹: WEB-DL\n📼: ${mediaInfo.title} (${mediaInfo.year})\n💾: Cloud-Stream\n🌐: ENGLISH`,
            url: `https://vidsrc.me/embed/${mediaInfo.imdbId}/`,
            quality: "HD",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Referer": "https://vidsrc.me/"
            },
            provider: "vidsrc"
        });

        return results;
    } catch (error) {
        return [];
    }
}

typeof module !== "undefined" && module.exports ? (module.exports = { getStreams }) : (global.getStreams = { getStreams });
