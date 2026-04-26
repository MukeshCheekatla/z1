/**
 * PlayIMDb Gimmick Scraper
 * Professional Edition with Multi-Line Emoji Metadata
 */

const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44'; 
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function getTMDBDetails(tmdbId, mediaType) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return {
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || "").split("-")[0],
        imdbId: data.imdb_id
    };
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        if (!mediaInfo.imdbId) return [];

        const streams = [];

        // The "PlayIMDb" Trick
        streams.push({
            name: "PlayIMDb",
            title: `PlayIMDb (Multi)
📹: WEB-Stream
📼: ${mediaInfo.title} (${mediaInfo.year})
💾: Auto-Scale
🌐: MULTI-AUDIO`,
            url: `https://www.playimdb.com/title/${mediaInfo.imdbId}/`,
            quality: "MULTI",
            provider: "playimdb"
        });

        // VidSrc Backup
        streams.push({
            name: "VidSrc",
            title: `VidSrc (HD)
📹: WEB-DL
📼: ${mediaInfo.title} (${mediaInfo.year})
💾: Cloud-Stream
🌐: ENGLISH`,
            url: `https://vidsrc.me/embed/${mediaInfo.imdbId}/`,
            quality: "HD",
            provider: "vidsrc"
        });

        return streams;
    } catch (error) {
        return [];
    }
}

module.exports = { getStreams };
