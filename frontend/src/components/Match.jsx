import ShieldRating from "./ShieldRating";

function trustShieldRating(user) {
    if (!user) return null;
    const num = (v) => {
        if (v == null || v === "") return null;
        const x = Number(v);
        return Number.isFinite(x) ? x : null;
    };

    const fromDisplay = num(user.trust_shield_display);
    if (fromDisplay != null && fromDisplay >= 1 && fromDisplay <= 5) return Math.round(fromDisplay);

    const fromDirect = num(user.shield_rating ?? user.starRating);
    if (fromDirect != null && fromDirect >= 1 && fromDirect <= 5) return Math.round(fromDirect);

    const fromPub = num(user.public_trust_rating);
    if (fromPub != null) return Math.max(1, Math.min(5, Math.round(fromPub)));

    return null;
}

function trustLabelForCard(user, shieldRating) {
    if (shieldRating == null) return "New User";
    if (user?.trust_label === "New User") return "";
    return user?.trust_label || "";
}

function Match({ user, onHeart, onReject }) {
    const shieldRating = trustShieldRating(user);
    const trustLabel = trustLabelForCard(user, shieldRating);

    return (
        <div className="login-card p-4 text-center mb-4">

            <div className="bg-white">
                <div className="d-flex align-items-center justify-content-center gap-2 mt-3">
                    <button className="btn btn-outline-danger mt-5" onClick={onReject}>
                        ❌
                    </button>

                    <img
                        src={user.image}
                        className="rounded mt-4 match-profile-image"
                        alt="profile"
                    />

                    <button className="btn btn-outline-danger mt-5" onClick={onHeart}>
                        ❤️
                    </button>
                </div>

                <div className="pb-2 mt-2">
                    <div className="small text-muted">Safety trust</div>
                    <ShieldRating
                        rating={shieldRating}
                    />
                    <div className="small text-muted">{trustLabel}</div>
                </div>
            </div>

            <h3 className="mt-3">{user.name}</h3>

            <div className="mb-3 text-start">
                <label>Location</label>
                <input className="form-control" value={user.location} disabled />
            </div>

            <div className="mb-3 text-start">
                <label>Age</label>
                <input className="form-control" value={user.age} disabled />
            </div>

            <div className="mb-3 text-start">
                <label>Gender</label>
                <input className="form-control" value={user.gender} disabled />
            </div>
        </div>
    );
}

export default Match;