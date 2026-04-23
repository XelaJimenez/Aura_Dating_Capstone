import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

/**
 * Capstone demo only: form data is not sent anywhere and is not persisted.
 */
export default function AuraPlus() {
    const [fullName, setFullName]       = useState("");
    const [email, setEmail]             = useState("");
    const [phone, setPhone]             = useState("");
    const [addressLine, setAddressLine] = useState("");
    const [city, setCity]               = useState("");
    const [zipCode, setZipCode]         = useState("");
    const [cardName, setCardName]       = useState("");
    const [cardNumber, setCardNumber]   = useState("");
    const [cardExpiry, setCardExpiry]   = useState("");
    const [plan, setPlan]               = useState("monthly");
    const [submitted, setSubmitted]     = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <>
            <Navbar />
            <div className="faded-background d-flex justify-content-center align-items-start min-vh-100 py-4 px-3">
                <div className="login-card p-4 text-start" style={{ maxWidth: 480, width: "100%" }}>
                    <h1 className="aura-logo text-center mb-2">Aura+</h1>
                    <p className="text-muted small text-center mb-3">
                        Capstone demo — this form does not save or use your information.
                    </p>

                    {submitted ? (
                        <div className="text-center py-3">
                            <p className="text-success fw-semibold mb-2">Thanks for exploring Aura+!</p>
                            <p className="small text-muted mb-4">
                                No payment was processed and nothing was stored.
                            </p>
                            <Link to="/profile" className="btn btn-outline-danger btn-sm me-2">
                                Back to profile
                            </Link>
                            <Link to="/matching" className="btn btn-danger btn-sm">
                                Continue to matching
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <h2 className="fs-5 mb-3">Join Aura+ (demo)</h2>

                            <div className="mb-3">
                                <label className="form-label">Full name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-control"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Phone (optional)</label>
                                <input
                                    type="tel"
                                    className="form-control"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>

                            <h3 className="fs-6 text-muted mt-4 mb-2">Billing address (fake)</h3>
                            <div className="mb-3">
                                <label className="form-label">Street</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={addressLine}
                                    onChange={(e) => setAddressLine(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                            <div className="row g-2 mb-3">
                                <div className="col-7">
                                    <label className="form-label">City</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="col-5">
                                    <label className="form-label">ZIP</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={zipCode}
                                        onChange={(e) => setZipCode(e.target.value)}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <h3 className="fs-6 text-muted mt-4 mb-2">Payment (fake)</h3>
                            <div className="mb-3">
                                <label className="form-label">Name on card</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={cardName}
                                    onChange={(e) => setCardName(e.target.value)}
                                    placeholder="As shown on card"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Card number</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(e.target.value)}
                                    placeholder="4242 4242 4242 4242"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Expiry (MM/YY)</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={cardExpiry}
                                    onChange={(e) => setCardExpiry(e.target.value)}
                                    placeholder="12/28"
                                    autoComplete="off"
                                />
                            </div>

                            <div className="mb-4">
                                <label className="form-label d-block">Plan</label>
                                <div className="d-flex flex-column gap-2">
                                    <label className="d-flex align-items-center gap-2 mb-0">
                                        <input
                                            type="radio"
                                            name="plan"
                                            checked={plan === "monthly"}
                                            onChange={() => setPlan("monthly")}
                                        />
                                        <span>Monthly — $9.99/mo (demo)</span>
                                    </label>
                                    <label className="d-flex align-items-center gap-2 mb-0">
                                        <input
                                            type="radio"
                                            name="plan"
                                            checked={plan === "annual"}
                                            onChange={() => setPlan("annual")}
                                        />
                                        <span>Annual — $79/yr (demo)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <button type="submit" className="btn btn-danger">
                                    Complete signup (demo)
                                </button>
                                <Link to="/profile" className="btn btn-outline-secondary btn-sm">
                                    Cancel
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
}
