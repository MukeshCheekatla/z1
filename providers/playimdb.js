/**
 * PlayIMDb - Instant Streaming (Nuvio Elite Edition)
 * Uses TMDB/IMDb IDs for direct VidSrc routing
 */

// --- Polyfills for Hermes Compatibility ---
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob(value) {
    if (!value) return '';
    let input = String(value).replace(/=+$/, '');
    let output = '';
    let bc = 0, bs, buffer, idx = 0;
    while ((buffer = input.charAt(idx++))) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
            bs = bc % 4 ? bs * 64 + buffer : buffer;
            if (bc++ % 4) {
                output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
            }
        }
    }
    return output;
}

// --- Configuration ---
const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- Utility Functions ---

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// --- Main Scraper ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // 1. Get IMDb ID for better routing
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbUrl = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const tmdbRes = await fetchWithTimeout(tmdbUrl);
        const data = await tmdbRes.json();
        
        const imdbId = data.external_ids?.imdb_id;
        const title = data.title || data.name || "Unknown";
        const year = (data.release_date || data.first_air_date || "").split("-")[0] || "";

        const finalId = imdbId || tmdbId;
        const results = [];

        // Player URLs
        const players = [
            { name: "VidSrc (Premium)", url: mediaType === 'movie' ? `https://vidsrc.me/embed/movie?imdb=${finalId}` : `https://vidsrc.me/embed/tv?imdb=${finalId}&sea=${season}&epi=${episode}` },
            { name: "VidSrc.pro (Fast)", url: mediaType === 'movie' ? `https://vidsrc.pro/embed/movie/${finalId}` : `https://vidsrc.pro/embed/tv/${finalId}/${season}/${episode}` },
            { name: "VidSrc.to (HD)", url: mediaType === 'movie' ? `https://vidsrc.to/embed/movie/${finalId}` : `https://vidsrc.to/embed/tv/${finalId}/${season}/${episode}` }
        ];

        for (const player of players) {
            const seStr = mediaType === 'tv' ? ` S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}` : "";
            
            // ELITE Metadata Format
            const displayTitle = `${player.name} (Multi)
📹: WEB-DL (Multi-Audio)
📼: ${title} (${year})${seStr} HD
💾: Cloud Stream
🌐: MULTI-LANGUAGE`;

            results.push({
                name: "PlayIMDb",
                title: displayTitle,
                url: player.url,
                quality: "1080p",
                headers: {
                    "Referer": "https://vidsrc.me/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                },
                provider: "playimdb"
            });
        }

        return results;

    } catch (error) {
        console.error("[PlayIMDb] Error:", error.message);
        return [];
    }
}

// --- Elite Export Logic ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = { getStreams };
}
