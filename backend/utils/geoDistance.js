function milesBetween(lat1, lon1, lat2, lon2) {
    if (
        lat1 === null || lat1 === undefined
        || lon1 === null || lon1 === undefined
        || lat2 === null || lat2 === undefined
        || lon2 === null || lon2 === undefined
    ) return null;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 3958.7613;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = { milesBetween };
