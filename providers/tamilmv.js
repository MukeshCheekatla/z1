/**
 * 1TamilMV - Native Site Scraper (Nuvio Optimized)
 */

const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44'; 
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MAIN_URL = 'https://www.1tamilmv.ltd';

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

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

function parseTamilMVClarity(topicTitle, linkIndex) {
    const bracketMatch = topicTitle.match(/\[(.*?)\]/);
    if (!bracketMatch) return { quality: "HD", size: "Cloud", codec: "AVC", source: "WEB-DL" };

    const content = bracketMatch[1];
    const parts = content.split("-").map(p => p.trim());
    const qualities = parts[0].split(/[,&]/).map(q => q.trim());
    const quality = qualities[linkIndex] || qualities[0] || "HD";
    const sizesStr = parts.find(p => p.includes("GB") || p.includes("MB")) || "";
    const sizes = sizesStr.split(/[-&]/).map(s => s.trim()).filter(s => s);
    const size = sizes[linkIndex] || sizes[0] || "Unknown";
    const codec = parts.find(p => /AVC|HEVC|x264|x265/i.test(p)) || "AVC";
    const source = topicTitle.includes("TRUE WEB-DL") ? "TRUE WEB-DL" : (topicTitle.includes("UNTOUCHED") ? "UNTOUCHED" : "WEB-DL");

    return { quality, size, codec, source };
}

async function extractVideoSource(embedUrl) {
    try {
        const response = await fetchWithTimeout(embedUrl, { headers: HEADERS });
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

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbUrl = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await fetchWithTimeout(tmdbUrl);
        const data = await tmdbRes.json();
        const mediaInfo = {
            title: data.title || data.name || "Unknown",
            year: (data.release_date || data.first_air_date || "").split("-")[0] || "N/A"
        };

        const searchQuery = mediaType === 'tv' 
            ? `${mediaInfo.title} S${season.toString().padStart(2, '0')} E${episode.toString().padStart(2, '0')}`
            : `${mediaInfo.title} ${mediaInfo.year}`;

        const queries = [searchQuery, mediaInfo.title];
        let results = [];
        let topicResults = [];

        for (const query of queries) {
            try {
                const searchUrl = `${MAIN_URL}/search/?q=${encodeURIComponent(query)}&quicksearch=1`;
                const res = await fetchWithTimeout(searchUrl, { headers: HEADERS });
                const html = await res.text();
                const $ = cheerio.load(html);

                $('li.ipsStreamItem').each((i, el) => {
                    const topicLink = $(el).find('a[href*="/forums/topic/"]').first();
                    if (!topicLink.length) return;
                    const topicTitle = topicLink.text().trim();
                    const watchLinks = [];
                    $(el).find('a').each((j, a) => {
                        if ($(a).text().trim() === '[W]' && $(a).attr('href')) {
                            watchLinks.push($(a).attr('href'));
                        }
                    });
                    if (watchLinks.length > 0) topicResults.push({ title: topicTitle, links: watchLinks });
                });
                if (topicResults.length > 0) break;
            } catch (e) {}
        }

        for (const topic of topicResults.slice(0, 3)) {
            for (let i = 0; i < topic.links.length; i++) {
                const clarity = parseTamilMVClarity(topic.title, i);
                const finalUrl = await extractVideoSource(topic.links[i]);
                const lang = /telugu/i.test(topic.title) ? "TELUGU" : (/hindi/i.test(topic.title) ? "HINDI" : "TAMIL");

                results.push({
                    name: "1TamilMV",
                    title: `1TamilMV (${clarity.quality})\n📹: ${clarity.source} (${clarity.codec})\n📼: ${mediaInfo.title} (${mediaInfo.year})\n💾: ${clarity.size}\n🌐: ${lang}`,
                    url: finalUrl,
                    quality: clarity.quality,
                    headers: {
                        "User-Agent": HEADERS["User-Agent"],
                        "Referer": topic.links[i]
                    },
                    provider: "1tamilmv"
                });
            }
        }
        return results;
    } catch (error) {
        return [];
    }
}

typeof module !== "undefined" && module.exports ? (module.exports = { getStreams }) : (global.getStreams = { getStreams });
