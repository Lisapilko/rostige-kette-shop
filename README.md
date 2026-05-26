# Zur Rostigen Kette - Bike Shop

## Installation lokal
```bash
npm install
cp .env.example .env
npm run dev
```

In `.env` eintragen:
```txt
VITE_SUPABASE_URL=deine Supabase Project URL
VITE_SUPABASE_ANON_KEY=dein Supabase Publishable Key
```

## Vercel Environment Variables
In Vercel unter Project → Settings → Environment Variables eintragen:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Wichtig: SQL Update ausführen
Bitte `supabase-setup.sql` einmal im Supabase SQL Editor ausführen. Dadurch funktionieren Rollen, Verkäufe, Admin-Ansicht und Uploads sauber.

## Rollen
- Admin: darf Bikes, Helme, Uploads und Verkäufe verwalten
- Mitarbeiter: darf Verkäufe eintragen
- Kunden: sehen nur Bikes und Helme
