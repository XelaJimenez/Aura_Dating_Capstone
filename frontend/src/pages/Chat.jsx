import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import { useUser } from "../context/UserContext";
import { API_BASE_URL } from "../config/api";

function Chat() {
    const { currentUser, token } = useUser();
    const location = useLocation();

    const [mutualMatches, setMutualMatches] = useState([]);
    const [loadingMatches, setLoadingMatches] = useState(true);

    const [selectedMatch, setSelectedMatch] = useState(location.state?.selectedMatch || null);
    const openMatchId = location.state?.openMatchId != null ? Number(location.state.openMatchId) : null;

    useEffect(() => {
        if (!currentUser || !token) return;

        fetch(`${API_BASE_URL}/matches/${currentUser.user_id}/mutual`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.matches) setMutualMatches(data.matches);
                setLoadingMatches(false);
            })
            .catch(() => setLoadingMatches(false));
    }, [currentUser, token]);

    useEffect(() => {
        if (selectedMatch || openMatchId == null || Number.isNaN(openMatchId) || mutualMatches.length === 0) return;
        const match = mutualMatches.find((m) => Number(m.match_id) === openMatchId);
        if (match) setSelectedMatch(match);
    }, [selectedMatch, openMatchId, mutualMatches]);

    useEffect(() => {
        if (!selectedMatch || !currentUser || !token) return;
        const matchId = Number(selectedMatch.match_id);
        if (Number.isNaN(matchId)) return;
        fetch(`${API_BASE_URL}/dates/notifications/${currentUser.user_id}/read`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ types: ["new_message"], match_id: matchId }),
        }).catch(() => {});
    }, [selectedMatch, currentUser, token]);

    return (
        <>
            <Navbar />
            <div className="chat-page-outer faded-background">
                <div className="chat-page-inner">
                    {selectedMatch ? (
                        <ChatWindow match={selectedMatch} onBack={() => setSelectedMatch(null)} />
                    ) : (
                        <ChatList
                            matches={mutualMatches}
                            loading={loadingMatches}
                            onSelect={(m) => setSelectedMatch(m)}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

export default Chat;
