import { Link } from "react-router-dom";

/** Subdued upsell when a free-tier limit is hit — links to demo Aura+ signup. */
export default function AuraPlusHint({ className = "" }) {
    return (
        <p className={`aura-plus-hint${className ? ` ${className}` : ""}`}>
            Need more?{" "}
            <Link to="/aura-plus" className="aura-plus-hint__link">
                Aura+
            </Link>{" "}
            will offer higher limits.
        </p>
    );
}
