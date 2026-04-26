/**
 * 1TamilMV - Intelligence-Driven Site Scraper
 * Uses site-specific patterns (Ordered Qualities, Codec Mapping, Size Extraction)
 */

const cheerio = require('cheerio-without-node-native');

// Configuration
const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44'; 
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TAMILMV_URL = 'https://www.1tamilmv.ltd';

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${TAMILMV_URL}/`,
};

// =================================================================================
// UTILITIES
// =================================================================================

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

/**
 * Intelligent Parser for 1TamilMV Forum Titles
 * Extracts and maps quality, size, and codec based on site patterns.
 */
function parseTamilMVClarity(topicTitle, linkIndex) {
    // Extract the content inside brackets: [1080p, 720p, 360p - AVC - UNTOUCHED - 800MB - 550MB & 300MB]
    const bracketMatch = topicTitle.match(/\[(.*?)\]/);
    if (!bracketMatch) return { quality: "HD", size: "Cloud", codec: "AVC" };

    const content = bracketMatch[1];
    const parts = content.split("-").map(p => p.trim());

    // 1. Qualities (usually the first part)
    const qualities = parts[0].split(/[,&]/).map(q => q.trim());
    const quality = qualities[linkIndex] || qualities[0] || "HD";

    // 2. Sizes (usually the last part)
    const sizesStr = parts.find(p => p.includes("GB") || p.includes("MB")) || "";
    const sizes = sizesStr.split(/[-&]/).map(s => s.trim()).filter(s => s);
    const size = sizes[linkIndex] || sizes[0] || "Unknown";

    // 3. Codec/Source
    const codec = parts.find(p => /AVC|HEVC|x264|x265/i.test(p)) || "AVC";
    const source = topicTitle.includes("TRUE WEB-DL") ? "TRUE WEB-DL" : (topicTitle.includes("UNTOUCHED") ? "UNTOUCHED" : "WEB-DL");

    return { quality, size, codec, source };
}

async function extractVideoSource(embedUrl) {
    try {
        const response = await fetchWithTimeout(embedUrl, { 
            headers: { ...HEADERS, 'Referer': TAMILMV_URL } 
        });
        const html = await response.text();
        const patterns = [
            /https?:\/\/[^\s"']+\.m3u8[^\s"']*/gi,
            /https?:\/\/[^\s"']+\.mp4[^\s"']*/gi,
            /file\s*:\s*["']([^"']+)["']/i
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                let videoUrl = Array.isArray(match) ? match[0] : match[1];
                if (videoUrl && videoUrl.length > 10) {
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
                    return videoUrl.replace(/\\/g, '');
                }
            }
        }
        return embedUrl;
    } catch (e) {
        return embedUrl;
    }
}

// =================================================================================
// CORE LOGIC
// =================================================================================

async function getTMDBDetails(tmdbId, mediaType) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    return {
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || "").split("-")[0]
    };
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        const searchQuery = mediaType === 'tv' 
            ? `${mediaInfo.title} S${season.toString().padStart(2, '0')} E${episode.toString().padStart(2, '0')}`
            : `${mediaInfo.title} ${mediaInfo.year}`;

        const queries = [searchQuery, mediaInfo.title];
        let streams = [];
        let topicResults = [];

        for (const query of queries) {
            try {
                const searchUrl = `${TAMILMV_URL}/search/?q=${encodeURIComponent(query)}&quicksearch=1`;
                const res = await fetchWithTimeout(searchUrl, { headers: HEADERS });
                const html = await res.text();
                const $ = cheerio.load(html);

                // Collect topics and their watch links
                $('li.ipsStreamItem').each((i, el) => {
                    const topicLink = $(el).find('a[href*="/forums/topic/"]').first();
                    if (!topicLink.length) return;
                    
                    const topicTitle = topicLink.text().trim();
                    const watchLinks = [];
                    
                    $(el).find('a').each((j, a) => {
                        const text = $(a).text().trim();
                        if (text === '[W]' && $(a).attr('href')) {
                            watchLinks.push($(a).attr('href'));
                        }
                    });

                    if (watchLinks.length > 0) {
                        topicResults.push({ title: topicTitle, links: watchLinks });
                    }
                });
                if (topicResults.length > 0) break;
            } catch (e) {}
        }

        // Process topics and map clarity info
        for (const topic of topicResults.slice(0, 3)) {
            for (let i = 0; i < topic.links.length; i++) {
                const clarity = parseTamilMVClarity(topic.title, i);
                const finalUrl = await extractVideoSource(topic.links[i]);
                
                let lang = "TAMIL";
                if (/telugu/i.test(topic.title)) lang = "TELUGU";
                else if (/hindi/i.test(topic.title)) lang = "HINDI";

                streams.push({
                    name: "1TamilMV",
                    title: `1TamilMV (${clarity.quality})
📹: ${clarity.source} (${clarity.codec})
📼: ${mediaInfo.title} (${mediaInfo.year})
💾: ${clarity.size}
🌐: ${lang}`,
                    url: finalUrl,
                    quality: clarity.quality,
                    provider: "1tamilmv"
                });
            }
        }

        return streams;
    } catch (error) {
        return [];
    }
}

module.exports = { getStreams };
