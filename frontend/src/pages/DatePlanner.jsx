import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AuraPlusHint from "../components/AuraPlusHint";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

const VENUES = [
    { icon: "🍽️", name: "Restaurant",    suggestion: "Piccolo Sogno",         venue_type: "public",      lat: 41.8851, lng: -87.6445 },
    { icon: "🎬", name: "Movie Theater",  suggestion: "AMC River East",         venue_type: "public",      lat: 41.8918, lng: -87.6196 },
    { icon: "☕", name: "Coffee Shop",    suggestion: "Intelligentsia Coffee",  venue_type: "public",      lat: 41.9003, lng: -87.6779 },
    { icon: "🎳", name: "Bowling",        suggestion: "Pinstripes",             venue_type: "semi-public", lat: 41.8960, lng: -87.6270 },
    { icon: "🌳", name: "Park / Outdoors",suggestion: "Millennium Park",        venue_type: "public",      lat: 41.8827, lng: -87.6233 },
];

const TIME_SLOTS = [
    { label: "Friday 6PM – 10PM",   day: "friday",   start: "18:00", end: "22:00" },
    { label: "Saturday 12PM – 5PM", day: "saturday", start: "12:00", end: "17:00" },
    { label: "Saturday 6PM – 10PM", day: "saturday", start: "18:00", end: "22:00" },
    { label: "Sunday 12PM – 5PM",   day: "sunday",   start: "12:00", end: "17:00" },
    { label: "Sunday 6PM – 9PM",    day: "sunday",   start: "18:00", end: "21:00" },
];

function VenueMap({ venues, selectedVenue, onSelect }) {
    const mapRef     = useRef(null);
    const mapObjRef  = useRef(null);
    const markersRef = useRef([]);

    useEffect(() => {
        if (mapObjRef.current) return;

        const init = () => {
            if (!window.L || !mapRef.current) return false;

            const map = window.L.map(mapRef.current).setView([41.8827, -87.6233], 13);
            mapObjRef.current = map;

            window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "© OpenStreetMap contributors",
            }).addTo(map);

            venues.forEach((venue) => {
                const marker = window.L.marker([venue.lat, venue.lng])
                    .addTo(map)
                    .bindPopup(`<b>${venue.icon} ${venue.name}</b><br/>${venue.suggestion}`);
                marker.on("click", () => onSelect(venue));
                markersRef.current.push({ marker, venue });
            });
            return true;
        };

        if (!init()) {
            const interval = setInterval(() => { if (init()) clearInterval(interval); }, 100);
            return () => clearInterval(interval);
        }
    }, []);

    useEffect(() => {
        if (!window.L || !mapObjRef.current) return;
        markersRef.current.forEach(({ marker, venue }) => {
            const icon = window.L.divIcon({
                className: "",
                html: `<div style="background:${selectedVenue?.name === venue.name ? "#a8001c" : "#c94b5b"};color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;">${venue.icon}</div>`,
                iconSize:   [32, 32],
                iconAnchor: [16, 16],
            });
            marker.setIcon(icon);
        });
    }, [selectedVenue]);

    return <div ref={mapRef} className="venue-map" />;
}

function DatePlanner() {
    const location  = useLocation();
    const navigate  = useNavigate();
    const { currentUser, token } = useUser();

    const match    = location.state?.match    || null;
    const returnTo = location.state?.returnTo || null;

    const [selectedVenue, setSelectedVenue] = useState(null);
    const [selectedSlot,  setSelectedSlot]  = useState(null);
    const [sent,  setSent]  = useState(false);
    const [error, setError] = useState("");
    const [dateLimitAuraPlus, setDateLimitAuraPlus] = useState(false);

    useEffect(() => {
        setError("");
        setDateLimitAuraPlus(false);
    }, [selectedVenue, selectedSlot]);

    const buildProposedDatetime = (slot) => {
        const days   = { friday: 5, saturday: 6, sunday: 0 };
        const target = days[slot.day];
        const now    = new Date();
        const diff   = (target - now.getDay() + 7) % 7 || 7;
        const date   = new Date(now);
        date.setDate(now.getDate() + diff);
        const [h, m] = slot.start.split(":");
        date.setHours(parseInt(h), parseInt(m), 0, 0);
        return date.toISOString();
    };

    const handleSendRequest = async () => {
        if (!selectedVenue || !selectedSlot) {
            setError("Please pick a spot and a time.");
            return;
        }
        setError("");
        setDateLimitAuraPlus(false);

        const proposed_datetime = buildProposedDatetime(selectedSlot);

        try {
            const res = await fetch(`${API_BASE_URL}/dates/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    match_id:          match?.match_id       || null,
                    sender_id:         currentUser?.user_id  || null,
                    venue_type:        selectedVenue.venue_type,
                    venue_name:        selectedVenue.suggestion,
                    proposed_datetime,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to send date request.");
                setDateLimitAuraPlus(data.upgrade_hint === "aura_plus");
                return;
            }
        } catch (err) {
            console.error("Date request failed:", err);
        }

        setSent(true);
        setTimeout(() => navigate(returnTo || "/chat"), 1500);
    };

    return (
        <>
            <Navbar />
            <div className="container d-flex justify-content-center faded-background min-vh-100 min-vw-100 pt-4">
                <div className="login-card p-4 mb-4 text-start date-planner-card">

                    <div className="text-center mb-4">
                        {match ? (
                            <>
                                <img
                                    src={match.image}
                                    alt={match.name}
                                    className="date-planner-match-avatar rounded-circle mb-2"
                                />
                                <h4 className="mb-0">Plan a date with {match.name}</h4>
                            </>
                        ) : (
                            <h4>Date Planner</h4>
                        )}
                        <p className="text-muted small mt-1">Tap a pin to select a spot.</p>
                    </div>

                    <div className="mb-4">
                        <VenueMap venues={VENUES} selectedVenue={selectedVenue} onSelect={setSelectedVenue} />
                    </div>

                    {selectedVenue && (
                        <div className="venue-selected-banner mb-3">
                            <strong>{selectedVenue.icon} {selectedVenue.name}</strong> — {selectedVenue.suggestion}
                        </div>
                    )}

                    <h5 className="section-title">Pick a Spot</h5>
                    <div className="d-flex flex-column gap-2 mb-4">
                        {VENUES.map((venue) => (
                            <div
                                key={venue.name}
                                onClick={() => setSelectedVenue(venue)}
                                className={`card p-3 venue-card${selectedVenue?.name === venue.name ? " venue-card--selected" : ""}`}
                            >
                                <div className="fw-bold">{venue.icon} {venue.name}</div>
                                <div className="text-muted small">📍 {venue.suggestion}</div>
                            </div>
                        ))}
                    </div>

                    <h5 className="section-title">Pick a Time</h5>
                    <div className="d-flex flex-column gap-2 mb-4">
                        {TIME_SLOTS.map((slot) => (
                            <div
                                key={slot.label}
                                onClick={() => setSelectedSlot(slot)}
                                className="d-flex align-items-center gap-2 time-slot-row"
                            >
                                <input
                                    type="radio"
                                    readOnly
                                    checked={selectedSlot?.label === slot.label}
                                    className="form-check-input mt-0 time-slot-radio"
                                />
                                <label className="time-slot-label">{slot.label}</label>
                            </div>
                        ))}
                    </div>

                    {error && <p className="text-danger small mb-2">{error}</p>}
                    {dateLimitAuraPlus && <AuraPlusHint className="mb-3 text-start" />}

                    {sent ? (
                        <div className="text-center text-success fw-bold">
                            ✅ Date request sent to {match?.name}!
                        </div>
                    ) : (
                        <div className="text-center">
                            <button
                                className="btn btn-danger"
                                onClick={handleSendRequest}
                                disabled={!selectedVenue || !selectedSlot}
                            >
                                {match ? `Send Date Request to ${match.name} 💌` : "Save Date Plan"}
                            </button>
                        </div>
                    )}

                    {returnTo && !sent && (
                        <div className="text-center mt-3">
                            <button className="btn btn-sm btn-outline-danger" onClick={() => navigate(returnTo)}>
                                ‹ Back to Chat
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}

export default DatePlanner;