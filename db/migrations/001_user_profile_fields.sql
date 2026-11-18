-- =============================================================================
-- Sprint 3 – Schritt 3: Profilfelder für LDAP-Profiling
-- =============================================================================
-- Additiv und idempotent: funktioniert auf frischen UND bestehenden Datenbanken.
-- Es werden ausschließlich Spalten hinzugefügt – keine Daten gelöscht, kein
-- Schema zurückgesetzt, bestehende Benutzerdaten und lokale Konten bleiben
-- unverändert (alle neuen Spalten sind NULL-fähig).
--
-- Anwendung auf eine bereits laufende Datenbank (Projekt-Root):
--   Get-Content -Raw db/migrations/001_user_profile_fields.sql |
--     docker exec -i newscenter-db psql -U newscenter -d newscenter -v ON_ERROR_STOP=1
-- Alternativ: Skript in Adminer (http://localhost:8080) ausführen.
-- Das Skript kann mehrfach ausgeführt werden (IF NOT EXISTS).
-- =============================================================================

-- Studierendenkennung (z.B. "if24b032"); NULL für lokale Konten/Mitarbeiter
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id TEXT UNIQUE;

-- Studiengang (z.B. "Informatik"); NULL wenn Kürzel unbekannt bzw. keine Kennung
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_program TEXT;

-- Abschlussart (z.B. "Bachelor"); NULL wenn Buchstabe unbekannt bzw. keine Kennung
ALTER TABLE users ADD COLUMN IF NOT EXISTS degree TEXT;

-- Studienbeginnjahr (z.B. 2024); NULL wenn keine Kennung
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_start_year SMALLINT;
