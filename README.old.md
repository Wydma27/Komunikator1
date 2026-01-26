# 💬 Messenger - Komunikator w Czasie Rzeczywistym

Nowoczesny komunikator inspirowany Facebook Messengerem z pełną funkcjonalnością czasu rzeczywistego.

## ✨ Funkcje

### 🚀 Priorytet 1 - Fundament
- ✅ **WebSocket (Socket.io)** - Komunikacja w czasie rzeczywistym
- ✅ **Statusy doręczenia/odczytu** - Widzisz, kto przeczytał Twoje wiadomości
- ✅ **Wskaźniki pisania** - Animowane kropki pokazujące, że ktoś pisze

### 🎯 Priorytet 2 - Interaktywność
- ✅ **Reakcje emoji** - Reaguj na wiadomości za pomocą emoji
- ✅ **Odpowiedzi na wiadomości** - System wątków (threads)
- ✅ **Status aktywności** - Zielona kropka przy aktywnych użytkownikach

### 🎨 Priorytet 3 - Multimedia
- ✅ **Wysyłanie GIF-ów** - Wbudowana biblioteka GIF-ów
- ✅ **Emoji Picker** - Pełny wybór emoji
- ✅ **Personalizacja** - Piękny design z gradientami i animacjami

## 🛠️ Technologie

### Backend
- **Node.js** + **Express** - Serwer HTTP
- **Socket.io** - Komunikacja WebSocket w czasie rzeczywistym
- **CORS** - Dostęp z dowolnego źródła

### Frontend
- **React 19** + **TypeScript** - Nowoczesny framework UI
- **Vite** - Szybki build tool
- **Socket.io Client** - Połączenie z serwerem
- **date-fns** - Formatowanie dat
- **emoji-picker-react** - Wybór emoji

## 📦 Instalacja

### 1. Zainstaluj wszystkie zależności
```bash
npm run install:all
```

Lub ręcznie:
```bash
# Zależności serwera
npm install

# Zależności klienta
cd client
npm install
cd ..
```

## 🚀 Uruchomienie

### Opcja 1: Uruchom wszystko jednocześnie (Zalecane)
```bash
npm run dev
```

### Opcja 2: Uruchom osobno

**Terminal 1 - Serwer:**
```bash
npm run server
```

**Terminal 2 - Klient:**
```bash
npm run client
```

## 🌍 Dostęp

### Lokalnie
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### Z innych urządzeń w sieci lokalnej
1. Znajdź swój adres IP (np. `ipconfig` na Windows lub `ifconfig` na Linux/Mac)
2. Zastąp `localhost` w `client/src/App.tsx` swoim adresem IP:
   ```typescript
   const SOCKET_URL = 'http://TWOJ_ADRES_IP:3001';
   ```
3. Uruchom ponownie aplikację
4. Inne urządzenia mogą się połączyć przez: `http://TWOJ_ADRES_IP:5173`

### Serwer dostępny dla wszystkich
Serwer nasłuchuje na `0.0.0.0:3001`, co oznacza, że jest dostępny dla:
- Localhost (127.0.0.1)
- Wszystkich interfejsów sieciowych
- Innych urządzeń w tej samej sieci

## 🎮 Jak używać

1. **Logowanie**
   - Wpisz swoją nazwę użytkownika
   - Wybierz styl awatara
   - Kliknij "Dołącz do czatu"

2. **Wysyłanie wiadomości**
   - Wpisz wiadomość w polu tekstowym
   - Naciśnij Enter lub kliknij ikonę wysyłania
   - Shift+Enter dla nowej linii

3. **Reakcje**
   - Najedź na wiadomość
   - Kliknij ikonę emoji (😊)
   - Wybierz reakcję

4. **Odpowiedzi**
   - Najedź na wiadomość
   - Kliknij ikonę odpowiedzi (←)
   - Napisz odpowiedź

5. **GIF-y**
   - Kliknij przycisk "GIF" w polu tekstowym
   - Wybierz GIF z galerii
   - GIF zostanie wysłany automatycznie

6. **Emoji**
   - Kliknij ikonę emoji (😊) w polu tekstowym
   - Wybierz emoji z pickera
   - Emoji zostanie dodane do wiadomości

## 📁 Struktura Projektu

```
my-app-17/
├── server/
│   └── index.js          # Serwer Socket.io
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginScreen.tsx      # Ekran logowania
│   │   │   ├── Sidebar.tsx          # Lista użytkowników
│   │   │   ├── ChatWindow.tsx       # Główne okno czatu
│   │   │   └── Message.tsx          # Komponent wiadomości
│   │   ├── App.tsx                  # Główny komponent
│   │   └── index.css                # Globalne style
│   └── package.json
└── package.json
```

## 🎨 Design

Aplikacja wykorzystuje:
- **Gradient Messenger** - Charakterystyczny niebieski gradient (#0084ff → #00c6ff)
- **Glassmorphism** - Przezroczyste tła z blur
- **Animacje** - Płynne przejścia i efekty hover
- **Dark Mode** - Ciemny motyw dla wygody oczu
- **Responsywność** - Działa na wszystkich urządzeniach

## 🔧 Konfiguracja

### Zmiana portu serwera
W `server/index.js`:
```javascript
const PORT = process.env.PORT || 3001;
```

### Zmiana adresu serwera
W `client/src/App.tsx`:
```typescript
const SOCKET_URL = 'http://localhost:3001';
```

## 📝 Notatki

- Wiadomości są przechowywane w pamięci serwera (nie w bazie danych)
- Po restarcie serwera historia wiadomości zostanie wyczyszczona
- Użytkownicy offline są usuwani po 5 minutach nieaktywności

## 🚀 Przyszłe Funkcje

- [ ] Baza danych (MongoDB/PostgreSQL)
- [ ] Prywatne czaty 1-na-1
- [ ] Wysyłanie plików i zdjęć
- [ ] Połączenia głosowe/wideo
- [ ] Znikające wiadomości (Vanish Mode)
- [ ] Szyfrowanie end-to-end
- [ ] Motywy kolorystyczne
- [ ] Wyszukiwanie wiadomości
- [ ] Powiadomienia push

## 📄 Licencja

ISC

## 👨‍💻 Autor

Stworzono z ❤️ używając React, Node.js i Socket.io
