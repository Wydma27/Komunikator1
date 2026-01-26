import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import type { User, Message } from '../types';
import './Message.css';

interface MessageProps {
    message: Message;
    currentUserId: string;
    onReact: (messageId: string, emoji: string) => void;
    onReply: (message: Message) => void;
    users: User[];
    allMessages?: Message[];
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function MessageItem({ message, currentUserId, onReact, onReply, users, allMessages }: MessageProps) {
    const [showReactions, setShowReactions] = useState(false);
    const isOwnMessage = message.sender.username === currentUserId;

    const handleReactionClick = (emoji: string) => {
        onReact(message.id, emoji);
        setShowReactions(false);
    };

    const hasUserReacted = (emoji: string) => {
        return message.reactions[emoji]?.includes(currentUserId) || false;
    };

    const totalReactions = Object.values(message.reactions || {}).reduce(
        (sum, userIds) => sum + userIds.length,
        0
    );

    const isEmoji = (str?: string) => !str?.startsWith('http') && !str?.startsWith('data:');

    // Znajdź wiadomość, na którą odpowiadamy
    const repliedMessage = message.replyTo && allMessages ? allMessages.find(m => m.id === message.replyTo) : null;

    return (
        <div className={`message ${isOwnMessage ? 'own-message' : 'other-message'}`}>
            {!isOwnMessage && (
                isEmoji(message.sender.avatar) ? (
                    <div className="message-avatar-emoji" style={{ fontSize: '24px', marginRight: '8px', width: '32px', textAlign: 'center' }}>{message.sender.avatar}</div>
                ) : (
                    <img src={message.sender.avatar} alt={message.sender.username} className="message-avatar" />
                )
            )}

            <div className="message-content-wrapper">
                {!isOwnMessage && (
                    <span className="message-sender">{message.sender.username}</span>
                )}

                <div className="message-bubble-container">
                    {/* REPLY CONTEXT */}
                    {repliedMessage && (
                        <div className="replied-message-context" style={{
                            fontSize: '0.8em',
                            background: 'rgba(0,0,0,0.1)',
                            borderLeft: '2px solid var(--accent-light)',
                            padding: '4px 8px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: 0.8
                        }}>
                            <span style={{ fontWeight: 'bold' }}>{repliedMessage.sender.username}</span>: {repliedMessage.type === 'text' ? repliedMessage.content.substring(0, 30) + (repliedMessage.content.length > 30 ? '...' : '') : `[${repliedMessage.type}]`}
                        </div>
                    )}

                    <div className={`message-bubble ${message.type}`}>
                        {message.type === 'text' && <p>{message.content}</p>}
                        {message.type === 'gif' && (
                            <img src={message.content} alt="GIF" className="message-gif" />
                        )}
                        {message.type === 'image' && (
                            <img src={message.content} alt="Image" className="message-image" />
                        )}

                        <span className="message-time">
                            {formatDistanceToNow(new Date(message.timestamp), {
                                addSuffix: true,
                                locale: pl
                            })}
                        </span>
                    </div>

                    <div className="message-actions">
                        <button
                            className="action-btn"
                            onClick={() => setShowReactions(!showReactions)}
                            title="Reaguj"
                        >
                            😊
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => onReply(message)}
                            title="Odpowiedz"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 12L4 8l4-4M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                    {showReactions && (
                        <div className="reaction-picker">
                            {QUICK_REACTIONS.map(emoji => (
                                <button
                                    key={emoji}
                                    className="reaction-btn"
                                    onClick={() => handleReactionClick(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {totalReactions > 0 && (
                    <div className="message-reactions">
                        {Object.entries(message.reactions || {}).map(([emoji, userIds]) => (
                            userIds.length > 0 && (
                                <button
                                    key={emoji}
                                    className={`reaction-badge ${hasUserReacted(emoji) ? 'user-reacted' : ''}`}
                                    onClick={() => handleReactionClick(emoji)}
                                    title={`${userIds.map(id => users.find(u => u.username === id)?.username || 'Użytkownik').join(', ')}`}
                                >
                                    <span className="reaction-emoji">{emoji}</span>
                                    <span className="reaction-count">{userIds.length}</span>
                                </button>
                            )
                        ))}
                    </div>
                )}

                {isOwnMessage && message.readBy && message.readBy.length > 1 && (
                    <div className="read-receipts">
                        {message.readBy
                            .filter(id => id !== currentUserId)
                            .slice(0, 3)
                            .map(userId => {
                                const user = users.find(u => u.username === userId);
                                return user ? (
                                    isEmoji(user.avatar) ? (
                                        <span key={userId} className="read-avatar-emoji" style={{ fontSize: '12px' }}>{user.avatar}</span>
                                    ) : (
                                        <img
                                            key={userId}
                                            src={user.avatar}
                                            alt={user.username}
                                            className="read-avatar"
                                            title={`Przeczytane przez ${user.username}`}
                                        />
                                    )
                                ) : null;
                            })}
                        {message.readBy.length > 4 && (
                            <span className="read-count">+{message.readBy.length - 4}</span>
                        )}
                    </div>
                )}
            </div>

            {isOwnMessage && (
                isEmoji(message.sender.avatar) ? (
                    <div className="message-avatar-emoji" style={{ fontSize: '24px', marginLeft: '8px', width: '32px', textAlign: 'center' }}>{message.sender.avatar}</div>
                ) : (
                    <img src={message.sender.avatar} alt={message.sender.username} className="message-avatar" />
                )
            )}
        </div>
    );
}

export default MessageItem;
