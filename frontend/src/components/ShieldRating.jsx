/** Safety shield display (1–5), not popularity stars. Use `variant="onDark"` on dark overlays (e.g. match card). */
function ShieldRating({ rating, variant }) {
    const n = rating == null || Number.isNaN(Number(rating)) ? 0 : Math.max(0, Math.min(5, Number(rating)));
    const cls = ["shield-rating", variant === "onDark" ? "shield-rating--on-dark" : ""].filter(Boolean).join(" ");
    return (
        <div className={cls} title="Safety-based trust rating">
            {[1, 2, 3, 4, 5].map((num) => (
                <i
                    key={num}
                    className={`bi ${num <= n ? "bi-shield-fill" : "bi-shield"}`}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}

export default ShieldRating;
