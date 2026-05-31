-- Spustite tento skript v Cloud SQL Studio alebo ho importujte do databázy "atelierinak"

-- Povolenie rozšírenia pre generovanie UUID (pre istotu)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabuľka pre profily užívateľov (Admin overenie)
-- ID bude zodpovedať UID z Firebase Authentication (reťazec, nie UUID)
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(255) PRIMARY KEY,
    is_admin BOOLEAN DEFAULT false
);

-- 2. Tabuľka pre položky galérie
CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    s3_key TEXT NOT NULL UNIQUE,      -- Kľúč súboru v GCS (napr. gallery/12345-fotka.jpg)
    alt_text TEXT DEFAULT '',         -- SEO popis
    category TEXT DEFAULT 'hlina',    -- Kategória (hlina, grafika, malba)
    sort_order INTEGER DEFAULT 0,     -- Poradie v galérii
    is_active BOOLEAN DEFAULT true,   -- Možnosť dočasne skryť fotku
    mime_type TEXT,                   -- Napr. "image/jpeg"
    file_size INTEGER,                -- Veľkosť v bajtoch
    uploaded_by VARCHAR(255) REFERENCES profiles(id)
);

-- 3. Tabuľka pre novinky
CREATE TABLE IF NOT EXISTS news_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    s3_key TEXT NOT NULL UNIQUE,      -- Kľúč súboru v GCS (napr. news/12345-plagat.jpg)
    title TEXT DEFAULT '',            -- Nadpis novinky
    description TEXT DEFAULT '',      -- Celý sprievodný text článku
    sort_order INTEGER DEFAULT 0,     -- Poradie zobrazenia
    is_active BOOLEAN DEFAULT true,   -- Možnosť skryť
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by VARCHAR(255) REFERENCES profiles(id)
);

-- Vloženie prvého administrátora (voliteľné)
-- Akonáhle si vytvoríte vo Firebase Authentication účet, nahraďte 'FIREBASE_UID_TU'
-- skutočným UID vášho účtu a spustite:
-- INSERT INTO profiles (id, is_admin) VALUES ('FIREBASE_UID_TU', true) ON CONFLICT (id) DO UPDATE SET is_admin = true;
