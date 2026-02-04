import { useState, useRef } from 'react';
import './ProfileEditor.css';

interface ProfileEditorProps {
    currentUsername: string;
    currentAvatar: string;
    onClose: () => void;
    onSave: (newUsername: string, newAvatar: string) => void;
    serverUrl: string;
}

export default function ProfileEditor({ currentUsername, currentAvatar, onClose, onSave, serverUrl }: ProfileEditorProps) {
    const [username, setUsername] = useState(currentUsername);
    const [avatar, setAvatar] = useState(currentAvatar);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const avatarOptions = [
        '😀', '😎', '🤖', '👨‍💻', '👩‍💻', '🦊', '🐱', '🐶', '🐼', '🦁',
        '🎮', '🎨', '🎭', '🎪', '🎯', '⚡', '🔥', '💎', '🌟', '✨'
    ];

    const isEmoji = (str?: string) => !str?.startsWith('http') && !str?.startsWith('data:');

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Limit size to 2MB for profile picture
        if (file.size > 2 * 1024 * 1024) {
            setError('Zdjęcie jest za duże. Maksymalny rozmiar to 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAvatar(base64);
        };
        reader.readAsDataURL(file);

        // Reset input
        e.target.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Nazwa użytkownika nie może być pusta');
            return;
        }

        if (username === currentUsername && avatar === currentAvatar) {
            setError('Nie wprowadzono żadnych zmian');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${serverUrl}/api/user/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUsername,
                    updates: {
                        username: username.trim() !== currentUsername ? username.trim() : undefined,
                        avatar: avatar !== currentAvatar ? avatar : undefined
                    }
                })
            });

            const data = await response.json();

            if (data.success && data.user) {
                onSave(data.user.username, data.user.avatar);
                onClose();
            } else {
                setError(data.message || 'Wystąpił błąd podczas aktualizacji profilu');
            }
        } catch (err) {
            setError('Nie można połączyć się z serwerem');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content profile-editor" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edytuj profil</h2>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}

                    <div className="profile-preview-section">
                        <div className="current-avatar-preview">
                            {isEmoji(avatar) ? (
                                <div className="avatar-preview-emoji">{avatar}</div>
                            ) : (
                                <img src={avatar} alt="Podgląd" className="avatar-preview-img" />
                            )}
                        </div>
                        <button
                            type="button"
                            className="upload-photo-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                        >
                            📷 Zmień zdjęcie urządzenia
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">Nazwa użytkownika</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Wpisz nową nazwę użytkownika"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Wybierz emoji lub wgraj własne zdjęcie</label>
                        <div className="avatar-selector">
                            {avatarOptions.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className={`avatar-option ${avatar === emoji ? 'selected' : ''}`}
                                    onClick={() => setAvatar(emoji)}
                                    disabled={loading}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} disabled={loading} className="cancel-button">
                            Anuluj
                        </button>
                        <button type="submit" disabled={loading} className="save-button">
                            {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
