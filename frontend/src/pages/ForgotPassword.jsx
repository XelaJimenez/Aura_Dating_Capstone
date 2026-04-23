import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.includes("@")) {
            setError("Please enter a valid email.");
            return;
        }

        setError("");
        setSuccessMessage("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Something went wrong. Please try again.");
                return;
            }

            setSuccessMessage(data.message || "A temporary password has been sent.");
        } catch {
            setError("Could not connect to server. Is the backend running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="faded-background d-flex justify-content-center align-items-center min-vh-100">
            <div className="login-card p-4 text-center">
                <h1 className="aura-logo">Aura</h1>
                <h2 className="mb-4 fs-2">Forgot password</h2>
                {successMessage ? (
                    <>
                        <p className="mb-4 text-success">{successMessage}</p>
                        <p className="small text-muted mb-4">You can return to the login page when you are ready.</p>
                        <button
                            type="button"
                            className="submit-btn"
                            onClick={() => navigate("/")}
                        >
                            Back to login
                        </button>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <p className="small text-muted mb-3">Enter the email for your Aura account.</p>
                        <div className="mb-3">
                            <input
                                type="email"
                                className="form-control custom-input"
                                placeholder="✉ Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                        {error && <p className="text-danger small mb-3">{error}</p>}
                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? "Sending..." : "Send temporary password"}
                        </button>
                        <div className="mt-3 small">
                            <Link to="/" className="text-dark fw-bold">
                                Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ForgotPassword;
