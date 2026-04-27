/**
 * PlayIMDb - Enhanced with Cloudnestra Decryption
 * Based on high-performance VidSrc extraction patterns
 */

const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44';
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function safeFetch(url, options = {}) {
    if (typeof fetchv2 === 'function') {
        const headers = options.headers || {};
        const method = options.method || 'GET';
        const body = options.body || null;
        try {
            return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
        } catch (e) {
            console.error("Fetch failed:", url, e);
        }
    }
    return fetch(url, options);
}

function toQualityLabel(text) {
    const val = String(text || '').toLowerCase();
    if (val.includes('2160') || val.includes('4k')) return '2160p';
    if (val.includes('1440')) return '1440p';
    if (val.includes('1080')) return '1080p';
    if (val.includes('720')) return '720p';
    return 'HD';
}

async function getTMDBInfo(tmdbId, type) {
    const url = `${TMDB_BASE}/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await safeFetch(url);
    const data = res && res.ok ? await res.json() : null;
    if (!data) return null;

    const info = {
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || "").split("-")[0],
        imdbId: data.imdb_id
    };

    if (!info.imdbId && type === 'tv') {
        const extRes = await safeFetch(`${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const ext = extRes && extRes.ok ? await extRes.json() : null;
        if (ext) info.imdbId = ext.imdb_id;
    }
    return info;
}

async function resolveDirectStreams(media, type, season, episode) {
    const imdbId = media.imdbId;
    const playUrl = `https://www.playimdb.com/title/${imdbId}/`;
    const seStr = type === 'tv' ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : "";
    const mediaTitle = `${media.title || "Unknown"} (${media.year || "N/A"})${seStr}`;

    // 1. Fetch PlayIMDb landing
    const res = await safeFetch(playUrl);
    const html = res && res.ok ? await res.text() : '';
    
    // 2. Handle TV menu if needed (find correct episode iframe)
    let targetUrl = playUrl;
    if (type === 'tv') {
        const epMatch = html.match(new RegExp(`<div[^>]+class=["']ep[^>]+data-s=["']${season}["'][^>]+data-e=["']${episode}["'][^>]+data-iframe=["']([^"']+)["']`, 'i')) ||
                        html.match(new RegExp(`<div[^>]+class=["']ep[^>]+data-iframe=["']([^"']+)["'][^>]+data-s=["']${season}["'][^>]+data-e=["']${episode}["']`, 'i'));
        if (epMatch) {
            targetUrl = epMatch[1].startsWith('/') ? `https://www.playimdb.com${epMatch[1]}` : epMatch[1];
        }
    }

    // 3. Extract Cloudnestra iframe
    const pageRes = await safeFetch(targetUrl, { headers: { Referer: 'https://www.playimdb.com/' } });
    const pageHtml = pageRes && pageRes.ok ? await pageRes.text() : '';
    const iframeSrc = (pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
    if (iframeSrc) {
        const cloudBase = "https:" + (iframeSrc.startsWith('//') ? iframeSrc : (iframeSrc.startsWith('/') ? iframeSrc : "//" + iframeSrc));
        
        // 4. Follow to prorcp layer
        const cloudRes = await safeFetch(cloudBase, { headers: { Referer: targetUrl } });
        const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';
        const prorcpMatch = cloudHtml.match(/src\s*:\s*['"](\/prorcp\/[^'"]+)['"]/);
        
        if (prorcpMatch) {
            const prorcpUrl = new URL(cloudBase).origin + prorcpMatch[1];
            const finalRes = await safeFetch(prorcpUrl, { headers: { Referer: cloudBase } });
            const finalHtml = finalRes && finalRes.ok ? await finalRes.text() : '';

            // 5. DECRYPTION: Find hidden div and post to dec-cloudnestra
            const hidden = finalHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/);
            if (hidden) {
                const divId = hidden[1];
                const divText = hidden[2];
                const decRes = await safeFetch('https://enc-dec.app/api/dec-cloudnestra', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: divText, div_id: divId })
                });
                const decJson = decRes && decRes.ok ? await decRes.json() : null;
                const urls = decJson && Array.isArray(decJson.result) ? decJson.result : [];

                if (urls.length > 0) {
                    return urls.map((url, idx) => {
                        const quality = toQualityLabel(url);
                        return {
                            name: `PlayIMDb | Server ${idx + 1}`,
                            title: `${mediaTitle} - ${quality} [Direct]`,
                            url: url,
                            quality: quality,
                            headers: { Referer: 'https://cloudnestra.com/' },
                            provider: 'playimdb'
                        };
                    });
                }
            }
        }
    }

    return [];
}

async function getStreams(tmdbId, type, season, episode) {
    try {
        const media = await getTMDBInfo(tmdbId, type);
        if (!media || !media.imdbId) return [];
        return await resolveDirectStreams(media, type, season, episode);
    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
