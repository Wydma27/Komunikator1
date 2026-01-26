import { useState } from 'react';
import './ProfileEditor.css';

interface ProfileEditorProps {
    currentUsername: string;
    currentAvatar: string;
    onClose: () => void;
    onSave: (newUsername: string, newAvatar: string) => void;
}

export default function ProfileEditor({ currentUsername, currentAvatar, onClose, onSave }: ProfileEditorProps) {
    const [username, setUsername] = useState(currentUsername);
    const [avatar, setAvatar] = useState(currentAvatar);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const avatarOptions = [
        '😀', '😎', '🤖', '👨‍💻', '👩‍💻', '🦊', '🐱', '🐶', '🐼', '🦁',
        '🎮', '🎨', '🎭', '🎪', '🎯', '⚡', '🔥', '💎', '🌟', '✨'
    ];

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
            const response = await fetch('http://localhost:3005/api/user/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUsername,
                    updates: { username: username.trim(), avatar }
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
                        <label>Wybierz avatar</label>
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
