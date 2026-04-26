/**
 * 1TamilMV - Super Scraper (Nuvio Elite Edition)
 * Fixed for "Empty Box" and "Playback Error"
 */

const cheerio = require('cheerio-without-node-native');

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
const MAIN_URL = 'https://www.1tamilmv.lc'; 

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

// --- Utility Functions ---

async function fetchWithTimeout(url, options = {}, timeout = 12000) {
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

function cleanTitle(title) {
    const bracketMatch = title.match(/\[(.*?)\]/);
    if (!bracketMatch) return { quality: "HD", size: "Cloud", codec: "AVC", source: "WEB-DL" };

    const content = bracketMatch[1];
    const parts = content.split("-").map(p => p.trim());
    const quality = parts[0].split(/[,&]/)[0].trim() || "HD";
    const sizesStr = parts.find(p => p.includes("GB") || p.includes("MB")) || "";
    const size = sizesStr.split(/[-&]/)[0].trim() || "Unknown";
    const codec = parts.find(p => /AVC|HEVC|x264|x265/i.test(p)) || "AVC";
    const source = title.includes("TRUE WEB-DL") ? "TRUE WEB-DL" : (title.includes("UNTOUCHED") ? "UNTOUCHED" : "WEB-DL");

    return { quality, size, codec, source };
}

async function extractDirectStream(embedUrl) {
    try {
        const url = new URL(embedUrl);
        const hostname = url.hostname.toLowerCase();

        if (hostname.includes('strmup')) {
            const filecode = url.pathname.split('/').filter(p => p).pop();
            const ajaxUrl = `${url.origin}/ajax/stream?filecode=${filecode}`;
            const res = await fetchWithTimeout(ajaxUrl, {
                headers: { ...HEADERS, 'X-Requested-With': 'XMLHttpRequest', 'Referer': embedUrl }
            });
            const data = await res.json();
            if (data && data.streaming_url) return data.streaming_url;
        }

        const response = await fetchWithTimeout(embedUrl, { headers: { ...HEADERS, 'Referer': MAIN_URL } });
        let html = await response.text();

        const patterns = [
            /https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi,
            /https?:\/\/[^\s"']+\.mp4[^\s"']*/gi,
            /file\s*:\s*["']([^"']+)["']/i
        ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) return (Array.isArray(match) ? match[0] : match[1]).replace(/\\/g, '');
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- Main Scraper ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // 1. TMDB Meta
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbUrl = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await fetchWithTimeout(tmdbUrl);
        const data = await tmdbRes.json();
        const mediaTitle = data.title || data.name || "Unknown";
        const mediaYear = (data.release_date || data.first_air_date || "").split("-")[0] || "";

        // 2. Scouting
        const homeRes = await fetchWithTimeout(MAIN_URL, { headers: HEADERS });
        const homeHtml = await homeRes.text();
        const $ = cheerio.load(homeHtml);
        const candidates = [];

        $('a:contains("[WATCH]")').each((i, el) => {
            const watchUrl = $(el).attr("href");
            if (!watchUrl) return;

            let curr = el.previousSibling;
            let parts = [];
            while (curr && parts.length < 5) {
                if (curr.nodeType === 3) parts.unshift(curr.nodeValue);
                curr = curr.previousSibling;
            }
            const forumTitle = parts.join(" ").trim();
            if (forumTitle.toLowerCase().includes(mediaTitle.toLowerCase())) {
                candidates.push({ forumTitle, watchUrl });
            }
        });

        const finalResults = [];
        for (const cand of candidates.slice(0, 5)) {
            const streamUrl = await extractDirectStream(cand.watchUrl);
            if (!streamUrl) continue;

            const clarity = cleanTitle(cand.forumTitle);
            const lang = /telugu/i.test(cand.forumTitle) ? "TELUGU" : (/hindi/i.test(cand.forumTitle) ? "HINDI" : "TAMIL");

            // EXACT Format from Isaidub technical bible to fix "Empty Box"
            const displayTitle = `1TamilMV (${clarity.quality})
📹: ${clarity.source} (${clarity.codec})
📼: ${mediaTitle} (${mediaYear}) ${clarity.quality}
💾: ${clarity.size}
🌐: ${lang}`;

            finalResults.push({
                name: "1TamilMV",
                title: displayTitle,
                url: streamUrl,
                quality: clarity.quality,
                headers: {
                    "User-Agent": HEADERS["User-Agent"],
                    "Referer": cand.watchUrl
                },
                provider: "1tamilmv"
            });
        }

        return finalResults;
    } catch (error) {
        console.error("[TamilMV] Elite Scraper Error:", error.message);
        return [];
    }
}

// --- Elite Export Logic ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    // Crucial: The app expects an object containing the function
    global.getStreams = { getStreams };
}
