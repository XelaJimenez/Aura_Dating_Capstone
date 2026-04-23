import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

function locationFieldError(loc) {
    const t = (loc || "").trim();
    if (!t) return "Location is required.";
    const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
        return "Enter city and state (e.g. Chicago, IL). City or state alone is not enough.";
    }
    const city = parts[0];
    const state = parts.slice(1).join(", ").trim();
    if (!city || !state) {
        return "Enter city and state (e.g. Chicago, IL). Both parts are required.";
    }
    return null;
}

function Signup() {
    const navigate = useNavigate();
    const { login } = useUser();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [location, setLocation] = useState("");
    const [dob, setDob] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleDobChange = (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length >= 3 && val.length <= 4) {
            val = val.slice(0, 2) + "/" + val.slice(2);
        } else if (val.length >= 5) {
            val = val.slice(0, 2) + "/" + val.slice(2, 4) + "/" + val.slice(4, 8);
        }
        setDob(val);
    };

    const handleSignup = async (e) => {
        e.preventDefault();

        if (!firstName.trim()) { setError("First name is required."); return; }
        if (!lastName.trim())  { setError("Last name is required."); return; }
        const locErr = locationFieldError(location);
        if (locErr) { setError(locErr); return; }
        if (!dob.trim())       { setError("Date of birth is required."); return; }

        const dobRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
        if (!dobRegex.test(dob)) {
            setError("Please enter your date of birth as MM/DD/YYYY.");
            return;
        }

        const birthYear = parseInt(dob.split("/")[2]);
        const age = new Date().getFullYear() - birthYear;

        if (age < 18) { setError("You must be 18 or older."); return; }
        if (!email.includes("@")) { setError("Please enter a valid email."); return; }
        if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, lastName, location, age, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Signup failed. Please try again.");
                return;
            }

            // Store token + user in context and localStorage
            login(data.user, data.token);
            navigate("/questionnaire");

        } catch (err) {
            setError("Could not connect to server. Is the backend running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signin-page faded-background d-flex flex-column justify-content-center align-items-center min-vh-100">
            <div className="p-4 text-center">
                <h1 className="fs-3 text-white">Tell us your vibe.</h1>
                <h2 className="fs-6 text-white">Let us get to know you.</h2>
            </div>
            <div className="signin-card p-4 mb-3 text-center">
                <form onSubmit={handleSignup}>
                    <div className="mb-3 text-start">
                        <label>First Name:</label>
                        <input
                            type="text"
                            className="form-control custom-input bg-light"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                    </div>
                    <div className="mb-3 text-start">
                        <label>Last Name:</label>
                        <input
                            type="text"
                            className="form-control custom-input bg-light"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </div>
                    <div className="mb-3 text-start">
                        <label>Location <span className="text-muted location-hint">(City, State — e.g. Chicago, IL)</span></label>
                        <input
                            type="text"
                            className="form-control custom-input bg-light"
                            placeholder="Chicago, IL"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>
                    <div className="mb-3 text-start">
                        <label>Date of Birth:</label>
                        <input
                            type="text"
                            className="form-control custom-input bg-light"
                            placeholder="MM/DD/YYYY"
                            value={dob}
                            onChange={handleDobChange}
                            maxLength={10}
                        />
                    </div>
                    <div className="mb-3 text-start">
                        <label>Email:</label>
                        <input
                            type="email"
                            className="form-control custom-input bg-light"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="mb-3 text-start">
                        <label>Password:</label>
                        <input
                            type="password"
                            className="form-control custom-input bg-light"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-danger small">{error}</p>}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? "Creating account..." : "Next"}
                    </button>
                </form>
                <div className="mt-3 small">
                    <a href="/" className="text-dark">Back to Login</a>
                </div>
            </div>
        </div>
    );
}

export default Signup;