import { useState } from 'react';
import './LoginScreen.css';

interface LoginScreenProps {
    onLogin: (username: string, avatar: string, userId: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatar, setAvatar] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const avatarOptions = [
        '😀', '😎', '🤖', '👨‍💻', '👩‍💻', '🦊', '🐱', '🐶', '🐼', '🦁',
        '🎮', '🎨', '🎭', '🎪', '🎯', '⚡', '🔥', '💎', '🌟', '✨'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Nazwa użytkownika i hasło są wymagane');
            return;
        }

        if (isRegistering) {
            if (password !== confirmPassword) {
                setError('Hasła nie są identyczne');
                return;
            }
            if (password.length < 4) {
                setError('Hasło musi mieć minimum 4 znaki');
                return;
            }
        }

        setLoading(true);

        try {
            const endpoint = isRegistering ? '/api/register' : '/api/login';
            const body = isRegistering
                ? { username: username.trim(), email: email.trim(), password, avatar: avatar || '😀' }
                : { username: username.trim(), password };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.success && data.user) {
                onLogin(data.user.username, data.user.avatar, data.user.id);
            } else {
                setError(data.message || 'Wystąpił błąd');
            }
        } catch (err) {
            setError('Nie można połączyć się z serwerem');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className="login-container">
                <div className="login-header">
                    <div className="logo">💬</div>
                    <h1>Messenger</h1>
                    <p>{isRegistering ? 'Utwórz nowe konto' : 'Zaloguj się do swojego konta'}</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">Nazwa użytkownika</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Wpisz swoją nazwę użytkownika"
                            disabled={loading}
                            autoComplete="username"
                        />
                    </div>

                    {isRegistering && (
                        <div className="form-group">
                            <label htmlFor="email">Email (opcjonalnie)</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="twoj@email.com"
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="password">Hasło</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Wpisz hasło"
                            disabled={loading}
                            autoComplete={isRegistering ? "new-password" : "current-password"}
                        />
                    </div>

                    {isRegistering && (
                        <>
                            <div className="form-group">
                                <label htmlFor="confirmPassword">Potwierdź hasło</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Wpisz hasło ponownie"
                                    disabled={loading}
                                    autoComplete="new-password"
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
                        </>
                    )}

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'Proszę czekać...' : (isRegistering ? 'Zarejestruj się' : 'Zaloguj się')}
                    </button>

                    <div className="toggle-mode">
                        {isRegistering ? (
                            <>
                                Masz już konto?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegistering(false);
                                        setError('');
                                        setEmail('');
                                        setConfirmPassword('');
                                        setAvatar('');
                                    }}
                                    disabled={loading}
                                >
                                    Zaloguj się
                                </button>
                            </>
                        ) : (
                            <>
                                Nie masz konta?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegistering(true);
                                        setError('');
                                    }}
                                    disabled={loading}
                                >
                                    Zarejestruj się
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
