# ZapłaćNaCzas (statyczne HTML + JS)

To repozytorium zawiera gotowe strony HTML + moduły JavaScript (ESM) z podłączonym Supabase (Postgres + Auth + RLS). Nie ma tu Next.js ani bundlera — uruchamiasz statyczny frontend.

## Struktura

- `public/*.html` — gotowe strony (landing, logowanie, rejestracja, dashboard, płatności, ustawienia).
- `public/js/*.js` — moduły JavaScript (Supabase, logika harmonogramów, obsługa formularzy).
- `public/css/styles.css` — główny arkusz stylów.
- `supabase/migrations/0001_init.sql` — migracja bazy danych z RLS.

## Konfiguracja Supabase

1. Utwórz projekt Supabase.
2. Wykonaj migrację SQL z pliku `supabase/migrations/0001_init.sql`.
3. Włącz RLS (jest w migracji).
4. Skonfiguruj redirect URLs w Supabase Auth (np. `http://localhost:8080/app.html`).

## Konfiguracja frontendu

1. Otwórz plik `public/js/config.js`.
2. Wpisz:

```
export const SUPABASE_URL = "https://...";
export const SUPABASE_ANON_KEY = "...";
```

## Uruchomienie lokalne

Najprościej uruchomić statyczny serwer z katalogu `public`:

```bash
cd public
python3 -m http.server 8080
```

Następnie otwórz `http://localhost:8080/index.html`.

## Uwaga o przypomnieniach

Wersja statyczna nie zawiera serwerowego CRON-a. Jeśli chcesz wysyłać emailowe przypomnienia, użyj:
- Supabase Edge Function lub innego serwera CRON,
- klucza `SUPABASE_SERVICE_ROLE_KEY` tylko po stronie serwera.

Frontend nie powinien przechowywać klucza service role.
