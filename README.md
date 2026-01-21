# ZapłaćNaCzas (statyczne HTML + JS)

To repozytorium zawiera gotowe strony HTML + moduły JavaScript (ESM) z podłączonym Supabase (Postgres + Auth + RLS). Nie ma tu Next.js ani bundlera — uruchamiasz statyczny frontend.

## Struktura


- `/*.html` — gotowe strony (landing, logowanie, rejestracja, dashboard, płatności, ustawienia).
- `/js/*.js` — moduły JavaScript (Supabase, logika harmonogramów, obsługa formularzy).
- `/css/styles.css` — główny arkusz stylów.
- `supabase/migrations/0001_init.sql` — migracja bazy danych z RLS.

## Konfiguracja Supabase

1. Utwórz projekt Supabase.
2. Wykonaj migrację SQL z pliku `supabase/migrations/0001_init.sql`.
3. Włącz RLS (jest w migracji).
4. Skonfiguruj URL-e w Supabase Auth:
   - **Site URL** ustaw na domenę produkcyjną (np. `https://twojadomena.pl`).
   - **Redirect URLs** dodaj adresy, na które Supabase może przekierować po potwierdzeniu emaila,
     np. `https://twojadomena.pl/auth-confirmed.html` oraz lokalnie `http://localhost:8080/auth-confirmed.html`.

## Konfiguracja frontendu


1. Otwórz plik `js/config.js`.
2. Wpisz:

```
export const SUPABASE_URL = "https://...";
export const SUPABASE_ANON_KEY = "...";
```

## Uruchomienie lokalne


Najprościej uruchomić statyczny serwer z katalogu głównego:
python3 -m http.server 8080
```

Następnie otwórz `http://localhost:8080/index.html`.

## Uwaga o przypomnieniach

Wersja statyczna nie zawiera serwerowego CRON-a. Jeśli chcesz wysyłać emailowe przypomnienia, użyj:
- Supabase Edge Function lub innego serwera CRON,
- klucza `SUPABASE_SERVICE_ROLE_KEY` tylko po stronie serwera.

Frontend nie powinien przechowywać klucza service role.

Dla wysyłki emaili przez Resend skonfiguruj w środowisku Edge Function zmienne:
- `RESEND_API_KEY`
- `RESEND_FROM` (np. `ZapłaćNaCzas <no-reply@twojadomena.pl>`)
