const DEFAULT_UA = "AuraCapstone/1.0 (educational; city-level matching)";

function nominatimUrl(city, state) {
    const q = `${city}, ${state}, United States`;
    return `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
}

async function geocodeCityState(city, state) {
    const c = typeof city === "string" ? city.trim() : "";
    const s = typeof state === "string" ? state.trim() : "";
    if (!c || !s) return null;

    const url = nominatimUrl(c, s);
    const ua = (process.env.GEOCODING_USER_AGENT || DEFAULT_UA).trim() || DEFAULT_UA;
    const controller = new AbortController();
    const timeoutMs = Number.parseInt(process.env.GEOCODING_TIMEOUT_MS || "2500", 10);
    const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 2500);
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "User-Agent": ua,
            },
            signal: controller.signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { latitude: lat, longitude: lon };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = { geocodeCityState };
