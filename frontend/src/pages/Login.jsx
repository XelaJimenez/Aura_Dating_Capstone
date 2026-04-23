import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

function Login() {
    const navigate = useNavigate();
    const { login } = useUser();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email.includes("@")) { setError("Please enter a valid email."); return; }
        if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Login failed. Please try again.");
                return;
            }

            // Store in context + localStorage
            login(data.user, data.token);
            navigate("/matching");
        } catch (err) {
            setError("Could not connect to server. Is the backend running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="faded-background d-flex justify-content-center align-items-center min-vh-100">
            <div className="login-card p-4 text-center">
                <h1 className="aura-logo">Aura</h1>
                <h2 className="mb-4 fs-2">Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-3">
                        <input
                            type="email"
                            className="form-control custom-input"
                            placeholder="✉ Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="mb-3">
                        <input
                            type="password"
                            className="form-control custom-input"
                            placeholder="🔒 Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-danger small mb-3">{error}</p>}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? "Logging in..." : "Lets Go →"}
                    </button>
                </form>
                <div className="mt-3 small">
                    <p className="mb-1">
                        <Link to="/forgot-password" className="text-dark text-decoration-underline">
                            Forgot password?
                        </Link>
                    </p>
                    <p>
                        Don't have account?{" "}
                        <Link to="/signup" className="text-dark fw-bold">Sign Up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
