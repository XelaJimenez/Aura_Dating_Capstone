function ChatList({ matches, loading, onSelect }) {
    if (loading) {
        return (
            <div className="chat-inbox-card">
                <div className="chat-inbox-head">
                    <h2 className="chat-inbox-title">Messages</h2>
                    <p className="chat-inbox-sub">Loading your conversations…</p>
                </div>
                <div className="chat-inbox-body" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="chat-inbox-skel-row">
                            <div className="chat-inbox-skel-avatar" />
                            <div className="chat-inbox-skel-lines">
                                <div className="chat-inbox-skel-line" />
                                <div className="chat-inbox-skel-line chat-inbox-skel-line--short" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="chat-inbox-card">
            <div className="chat-inbox-head">
                <h2 className="chat-inbox-title">Messages</h2>
                <p className="chat-inbox-sub">Tap a match to keep the conversation going</p>
            </div>
            <div className="chat-inbox-body">
                {matches.length === 0 && (
                    <p className="chat-inbox-empty">No matches yet. Keep swiping — your next chat is waiting.</p>
                )}
                {matches.map((match, index) => (
                    <button
                        type="button"
                        key={match.match_id || index}
                        className="chat-inbox-row"
                        onClick={() => onSelect(match)}
                    >
                        <img src={match.image} alt={match.name} className="chat-inbox-avatar" />
                        <div className="chat-inbox-main">
                            <div className="chat-inbox-name">{match.name}</div>
                            <div className="chat-inbox-preview">
                                {match.last_message && String(match.last_message).trim()
                                    ? match.last_message
                                    : `You matched with ${match.name} — say hello!`}
                            </div>
                        </div>
                        <div className="chat-inbox-meta">
                            {match.unread_count > 0 && (
                                <span className="chat-inbox-badge">{match.unread_count}</span>
                            )}
                            <span className="chat-inbox-chevron" aria-hidden>
                                ›
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ChatList;
