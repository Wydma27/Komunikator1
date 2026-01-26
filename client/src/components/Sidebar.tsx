import { useState } from 'react';
import './Sidebar.css';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import type { User, Message } from '../types';

interface SidebarProps {
    users: User[];
    currentUser: User;
    isConnected: boolean;
    onLogout: () => void;
    onThemeToggle: () => void;
    isDarkMode: boolean;
    onEditProfile: () => void;
    activeChatId: string;
    onSelectChat: (chatId: string) => void;
    onAddFriend: (friendUsername: string) => void;
    onRespondToRequest: (fromUsername: string, action: 'accept' | 'reject') => void;
    chats: Record<string, Message[]>;
}

function Sidebar({
    users,
    currentUser,
    isConnected,
    onLogout,
    onThemeToggle,
    isDarkMode,
    onEditProfile,
    activeChatId,
    onSelectChat,
    onAddFriend,
    onRespondToRequest,
    chats
}: SidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const otherUsers = users.filter(u => u.username !== currentUser.username);

    // Znajomi (na podstawie username w tablicy friends)
    // Dodajemy też osoby, z którymi mamy historię rozmów, nawet jeśli nie są "oficjalnie" w friends (auto-friend hack)
    const chatIds = Object.keys(chats).filter(id => id !== 'general');

    // Unikalna lista userów, którzy są znajomymi LUB mają z nami czat
    const friendsAndChats = otherUsers.filter(u =>
        currentUser.friends?.includes(u.username) || chatIds.includes(u.username)
    );

    // SORTOWANIE: Najnowsze wiadomości na górze
    const sortedFriends = [...friendsAndChats].sort((a, b) => {
        const messagesA = chats[a.username] || [];
        const messagesB = chats[b.username] || [];

        // Pobierz ostatnią wiadomość (lub czas 0 jeśli brak)
        const timeA = messagesA.length > 0 ? new Date(messagesA[messagesA.length - 1].timestamp).getTime() : 0;
        const timeB = messagesB.length > 0 ? new Date(messagesB[messagesB.length - 1].timestamp).getTime() : 0;

        // Jeśli czasy są równe (np. brak wiadomości), sortuj alfabetycznie
        if (timeA === timeB) {
            return a.username.localeCompare(b.username);
        }

        // Malejąco (najnowsze first)
        return timeB - timeA;
    });

    const searchResults = otherUsers.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    console.log('🔍 Search:', searchQuery, '| Total users:', users.length, '| Other users:', otherUsers.length, '| Results:', searchResults.length);

    // Helper do ostatniej wiadomości
    const getLastMessage = (username: string) => {
        const msgs = chats[username];
        if (msgs && msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            // Skróć tekst
            let content = last.type === 'text' ? last.content : (last.type === 'image' ? 'Obraz' : 'GIF');
            if (content.length > 20) content = content.substring(0, 20) + '...';

            const isMe = last.sender.username === currentUser.username;
            return (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {isMe ? 'Ty: ' : ''}{content} • {formatDistanceToNow(new Date(last.timestamp), { addSuffix: true, locale: pl })}
                </span>
            );
        }
        return null;
    };

    const isEmoji = (str?: string) => !str?.startsWith('http') && !str?.startsWith('data:');

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="header-top">
                    <h2>Wiadomości</h2>
                    <div className="sidebar-actions">
                        <button className="edit-profile-btn" onClick={onEditProfile} title="Edytuj profil">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </div>
                </div>

                <div className="current-user-card">
                    <div className="user-avatar-container">
                        {isEmoji(currentUser.avatar) ? (
                            <div className="user-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{currentUser.avatar}</div>
                        ) : (
                            <img src={currentUser.avatar} alt={currentUser.username} className="user-avatar" />
                        )}
                        <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></span>
                    </div>
                    <div className="user-info">
                        <h3>{currentUser.username}</h3>
                        <p className="user-status">{isConnected ? 'Dostępny' : 'Łączenie...'}</p>
                    </div>
                </div>
            </div>

            <div className="search-container">
                <div className="search-input-wrapper">
                    <div className="search-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input type="text" placeholder="Szukaj znajomych..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                </div>
            </div>


            <div className="users-section">

                {/* sekcja zaproszeń */}
                {currentUser.friendRequests && currentUser.friendRequests.length > 0 && (
                    <div className="friend-requests-section">
                        <div className="section-header">
                            <h3>Zaproszenia ({currentUser.friendRequests.length})</h3>
                        </div>
                        <div className="requests-list">
                            {currentUser.friendRequests.map(req => (
                                <div key={req.from} className="user-item request-item">
                                    <div className="user-details">
                                        <h4>{req.from}</h4>
                                        <p className="request-time">{formatDistanceToNow(new Date(req.timestamp), { addSuffix: true, locale: pl })}</p>
                                    </div>
                                    <div className="request-actions">
                                        <button
                                            className="accept-btn"
                                            onClick={(e) => { e.stopPropagation(); onRespondToRequest(req.from, 'accept'); }}
                                            title="Akceptuj"
                                        >✓</button>
                                        <button
                                            className="reject-btn"
                                            onClick={(e) => { e.stopPropagation(); onRespondToRequest(req.from, 'reject'); }}
                                            title="Odrzuć"
                                        >✗</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* General chat removed */}

                {searchQuery ? (
                    <>
                        <div className="section-header" style={{ marginTop: '20px' }}>
                            <h3>Wyniki wyszukiwania</h3>
                        </div>
                        <div className="users-list">
                            {searchResults.length > 0 ? (
                                searchResults.map(user => {
                                    const isFriend = currentUser.friends?.includes(user.username);
                                    return (
                                        <div key={user.username} className={`user-item ${activeChatId === user.username ? 'active' : ''}`}
                                            onClick={() => {
                                                if (isFriend) {
                                                    onSelectChat(user.username);
                                                    setSearchQuery('');
                                                }
                                            }}
                                            style={{ cursor: isFriend ? 'pointer' : 'default' }}
                                        >
                                            <div className="user-avatar-container">
                                                {isEmoji(user.avatar) ? (
                                                    <div className="user-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{user.avatar}</div>
                                                ) : (
                                                    <img src={user.avatar} alt={user.username} className="user-avatar" />
                                                )}
                                                <span className={`status-indicator ${user.status}`}></span>
                                            </div>
                                            <div className="user-details" style={{ flex: 1 }}>
                                                <h4>{user.username}</h4>
                                                <p className="user-last-seen">{isFriend ? 'Twój znajomy' : 'Użytkownik'}</p>
                                            </div>
                                            {!isFriend && (
                                                <button
                                                    className="icon-btn"
                                                    style={{ backgroundColor: 'var(--accent-color)', color: 'white', width: '32px', height: '32px' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAddFriend(user.username);
                                                        setSearchQuery('');
                                                    }}
                                                    title="Dodaj do znajomych i czatuj"
                                                >
                                                    +
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Brak wyników</div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="section-header" style={{ marginTop: '20px' }}>
                            <h3>Znajomi ({sortedFriends.length})</h3>
                        </div>
                        <div className="users-list">
                            {sortedFriends.length > 0 ? (
                                sortedFriends.map(user => (
                                    <div key={user.username} className={`user-item ${activeChatId === user.username ? 'active' : ''}`} onClick={() => onSelectChat(user.username)}>
                                        <div className="user-avatar-container">
                                            {isEmoji(user.avatar) ? (
                                                <div className="user-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{user.avatar}</div>
                                            ) : (
                                                <img src={user.avatar} alt={user.username} className="user-avatar" />
                                            )}
                                            <span className={`status-indicator ${user.status}`}></span>
                                        </div>
                                        <div className="user-details">
                                            <h4>{user.username}</h4>
                                            <div className="user-last-message">
                                                {getLastMessage(user.username) || (
                                                    <p className={`user-last-seen ${user.status}`}>
                                                        {user.status === 'online' ? 'Dostępny' : formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true, locale: pl })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    Nie masz jeszcze znajomych. <br /> Użyj wyszukiwarki, aby ich znaleźć! 🔍
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="sidebar-footer">
                <button className="theme-toggle" onClick={onThemeToggle}>
                    {isDarkMode ? '☀️ Jasny motyw' : '🌙 Ciemny motyw'}
                </button>
                <button className="logout-btn" onClick={onLogout}>
                    Wyloguj
                </button>
            </div>
        </div>
    );
}

export default Sidebar;
