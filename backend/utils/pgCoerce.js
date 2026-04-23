/** Coerce pg int / bigint / string to integer; null / NaN → null */
function ni(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "bigint") return Number(v);
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
}

module.exports = { ni };
