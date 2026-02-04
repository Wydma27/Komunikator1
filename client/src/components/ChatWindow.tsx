import { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import './ChatWindow.css';
import MessageComponent from './Message';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import type { User, Message } from '../types';

interface ChatWindowProps {
    socket: Socket | null;
    currentUser: User;
    messages: Message[]; // Już przefiltrowane w App
    typingUsers: Set<string>;
    users: User[];
    chatId: string; // 'general' lub ID usera
    chatName: string;
    chatAvatar?: string;
}

const GIFS = [
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
    'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif',
    'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif'
];

function ChatWindow({
    socket,
    currentUser,
    messages,
    typingUsers,
    users,
    chatId,
    chatName,
    chatAvatar
}: ChatWindowProps) {
    const [messageInput, setMessageInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [showProfileInfo, setShowProfileInfo] = useState(false); // Modal profilu
    const [isSending, setIsSending] = useState(false); // Prevent double send
    const sendingLock = useRef(false); // Immediate lock

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        // Reset lock on unmount or chat change
        sendingLock.current = false;
        setIsSending(false);
    }, [chatId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageInput(e.target.value);

        if (socket) {
            socket.emit('typing:start', { to: chatId });

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing:stop', { to: chatId });
            }, 1000);
        }
    };

    const sendMessage = (content: string, type: 'text' | 'image' | 'gif' = 'text') => {
        if (!socket || !content.trim() || sendingLock.current) return;

        sendingLock.current = true;
        setIsSending(true);

        socket.emit('message:send', {
            content: content.trim(),
            type,
            replyTo: replyingTo?.id || null,
            to: chatId // Ważne: wysyłanie do konkretnego czatu
        });

        setMessageInput('');
        setReplyingTo(null);
        setShowEmojiPicker(false);
        setShowGifPicker(false);

        // Reset sending flag after short delay
        setTimeout(() => {
            sendingLock.current = false;
            setIsSending(false);
        }, 500);

        inputRef.current?.focus();

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        socket.emit('typing:stop', { to: chatId });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(messageInput);
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setMessageInput(prev => prev + emojiData.emoji);
        inputRef.current?.focus();
    };

    const handleGifClick = (gifUrl: string) => {
        sendMessage(gifUrl, 'gif');
    };

    const handleReaction = (messageId: string, emoji: string) => {
        if (socket) {
            socket.emit('message:react', { messageId, emoji, chatId });
        }
    };

    const handleReply = (message: Message) => {
        setReplyingTo(message);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !sendingLock.current) {
            e.preventDefault();
            sendMessage(messageInput);
        }
    };

    // Znajdź usera jeśli to czat prywatny, żeby wyświetlić detale w modalu
    const userProfile = chatId === 'general' ? null : users.find(u => u.username === chatId);

    const isEmoji = (str?: string) => !str?.startsWith('http') && !str?.startsWith('data:');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Limit size to 5MB for base64 storage
        if (file.size > 5 * 1024 * 1024) {
            alert('Zdjęcie jest za duże. Maksymalny rozmiar to 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            sendMessage(base64, 'image');
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    return (
        <div className="chat-window">
            {/* HEADER */}
            <div className="chat-header glass">
                <div className="chat-header-content" onClick={() => setShowProfileInfo(true)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {chatAvatar && !isEmoji(chatAvatar) ? (
                            <img src={chatAvatar} alt={chatName} style={{ width: 40, height: 40, borderRadius: '50%' }} />
                        ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px' }}>
                                {chatAvatar || '#'}
                            </div>
                        )}
                        <div>
                            <h2 className="gradient-text" style={{ margin: 0, fontSize: '16px' }}>{chatName}</h2>
                            <p className="chat-subtitle" style={{ margin: 0 }}>
                                {chatId === 'general'
                                    ? `${users.filter(u => u.status === 'online').length} użytkowników online`
                                    : userProfile?.status === 'online' ? 'Dostępny' : 'Niedostępny'
                                }
                            </p>
                        </div>
                    </div>

                    <div className="chat-actions">
                        <button className="icon-btn" title="Informacje" onClick={(e) => { e.stopPropagation(); setShowProfileInfo(true); }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* MESSAGES */}
            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <div className="empty-chat-icon">💬</div>
                        <h3>To początek rozmowy z {chatName}</h3>
                        <p>Napisz "Cześć" 👋</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <MessageComponent
                            key={message.id}
                            message={message}
                            currentUserId={currentUser.username}
                            onReact={handleReaction}
                            onReply={handleReply}
                            users={users}
                            allMessages={messages}
                        />
                    ))
                )}

                {Array.from(typingUsers).length > 0 && (
                    <div className="typing-indicator">
                        <div className="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <span className="typing-text">
                            {Array.from(typingUsers).slice(0, 2).join(', ')} pisze...
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <div className="chat-input-container glass">
                {replyingTo && (
                    <div className="reply-preview">
                        <div className="reply-content">
                            <span className="reply-label">Odpowiadasz na:</span>
                            <span className="reply-text">{replyingTo.sender.username}: {replyingTo.content.substring(0, 50)}</span>
                        </div>
                        <button className="reply-close" onClick={() => setReplyingTo(null)}>✖</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="chat-input-form">
                    <div className="input-actions">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                        <button
                            type="button"
                            className="icon-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Wyślij zdjęcie"
                            disabled={isSending}
                        >
                            📷
                        </button>
                        <button
                            type="button"
                            className="icon-btn"
                            onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                            title="GIF"
                            disabled={isSending}
                        >
                            <span className="gif-icon">GIF</span>
                        </button>
                        <button
                            type="button"
                            className="icon-btn"
                            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                            title="Emoji"
                            disabled={isSending}
                        >
                            😊
                        </button>
                    </div>

                    <textarea
                        ref={inputRef}
                        value={messageInput}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={`Napisz do ${chatName}...`}
                        className="message-input"
                        rows={1}
                    />

                    <button type="submit" className="send-btn" disabled={!messageInput.trim() || isSending}>
                        ➤
                    </button>
                </form>

                {showEmojiPicker && (
                    <div className="emoji-picker-container">
                        <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" height="350px" theme={Theme.DARK} />
                    </div>
                )}

                {showGifPicker && (
                    <div className="gif-picker-container">
                        <div className="gif-grid">
                            {GIFS.map((gif, index) => (
                                <button key={index} type="button" className="gif-item" onClick={() => handleGifClick(gif)}>
                                    <img src={gif} alt={`GIF ${index + 1}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL PROFILU */}
            {showProfileInfo && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setShowProfileInfo(false)}>
                    <div style={{
                        backgroundColor: 'var(--bg-sidebar)', padding: '24px', borderRadius: '16px',
                        width: '300px', textAlign: 'center', border: '1px solid var(--border-color)'
                    }} onClick={e => e.stopPropagation()}>
                        {chatAvatar ? (
                            <img src={chatAvatar} alt={chatName} style={{ width: 100, height: 100, borderRadius: '50%', marginBottom: '16px' }} />
                        ) : (
                            <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#3b82f6', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'white' }}>#</div>
                        )}
                        <h2 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>{chatName}</h2>
                        {userProfile && <p style={{ color: 'var(--text-secondary)' }}>Status: {userProfile.status}</p>}
                        {chatId === 'general' && <p style={{ color: 'var(--text-secondary)' }}>Otwarta grupa dla wszystkich</p>}

                        <button onClick={() => setShowProfileInfo(false)} style={{
                            marginTop: '20px', padding: '8px 16px', borderRadius: '8px',
                            border: 'none', backgroundColor: 'var(--accent-color)', color: 'white', cursor: 'pointer'
                        }}>Zamknij</button>
                    </div>
                </div>
            )}

        </div>
    );
}

export default ChatWindow;
