# NewsCenter – integrierter Stand aus Sprint 2 und Sprint 3

Die folgenden Abschnitte erhalten die Dokumentation beider Entwicklungsstände.
Die Integration verbindet Tag-Vorschläge, Subscriber Counts, persistente
Publish-Agent-Einstellungen und die versionierte API mit dem LDAP-Studienprofil.

- Die kanonischen API-Routen liegen unter `/api/v1/users`, `/api/v1/tags` und
  `/api/v1/messages`. Die bisherigen Root-Pfade bleiben kompatible Aliase.
- Der Frontend-API-Client ergänzt `/api/v1`; der Profilservice ruft deshalb
  `/users/me` auf. Der resultierende Request lautet `/api/v1/users/me`.
- Swagger liegt in `backend/swagger.js` und enthält auch das Profil-Schema und
  den Profil-Endpunkt. `/subscribe` bleibt außerhalb des API-Präfixes.
- `OLLAMA_MODEL` ist konfigurierbar und verwendet standardmäßig `llama3`,
  passend zum vorhandenen Modell. Der Tag-Vorschlagsdienst nutzt OpenThesaurus
  und direkte Texttreffer unabhängig von Ollama.
- Die additive Migration `001_user_profile_fields.sql` wird für bestehende
  Datenbanken wie unten beschrieben angewendet; bestehende Volumes bleiben erhalten.

## LDAP-Anzeigenamen: verifizierte Profilquelle

Der autorisierte Live-Diagnosecheck bestätigte `givenName` und `sn` als eindeutige
Attribute des eigenen Eintrags (Bind, Read, DN-/uid-Prüfung und LDAP-Ergebniscode 0).

- `authService.authenticateLDAP()` führt nach StartTLS und erfolgreichem Bind auf
  derselben Verbindung einen Base-Scope-Read mit `(objectClass=*)`, Limit 1 und
  deaktivierter Alias-Auflösung aus. Referrals werden nicht verfolgt.
- `ldapProfileService` übernimmt die getestete DN-/uid-Identitätsprüfung. Eine
  reine Schreibweisenabweichung von DN-Werten erfordert bekannte
  Case-Ignore-Attribute und zusätzlich eine passende `uid`. Andere Einträge,
  mehrdeutige Resultate und unvollständige LDAP-Ergebnisse liefern keinen Namen.
- Nur eindeutige, nicht leere `givenName`- und `sn`-Werte werden mit einem
  Leerzeichen verbunden. `cn`, E-Mail und Kennung sind keine Namens-Fallbacks.
- Das interne Ergebnis enthält `authenticated`, `displayName` und einen festen
  `profileReadStatus`. Ein fehlgeschlagener Read bleibt bei erfolgreichem Bind
  eine Profilanreicherungsstörung und wird nicht zum Authentifizierungsfehler.
- Ein vorhandener LDAP-Anzeigename wird bei Lesefehlern beibehalten. Neue
  LDAP-Konten ohne verifizierten Namen speichern einen leeren String im
  bestehenden `display_name`; die Oberfläche zeigt „Nicht verfügbar“.
- `updateLdapDisplayName()` schreibt ausschließlich `display_name` und schützt
  lokale Konten zusätzlich mit dem bestehenden LDAP-Marker in der SQL-Bedingung.
  Die frische Benutzerzeile wird für die Login-Response verwendet. Bestandskonten
  erhalten ihren Namen beim nächsten erfolgreichen LDAP-Login, ohne Neuanlage.
- Kennung, Studienprofil, Rollenprüfung und JWT-Payload/-Laufzeit bleiben die
  bisherigen Identifikations- und Berechtigungsgrundlagen. Es gibt keine neue
  Datenbankspalte oder zusätzliche Migration für den Namen.
- Unbind und notfalls erzwungener Disconnect schließen den Client auch bei
  Bind-/Read-/Verbindungsfehlern und Timeouts. LDAP-Einträge, Namen und
  Fehlermeldungen mit möglichen Zugangsdaten werden nicht protokolliert.
- Der reaktive Frontend-Store `frontend/src/store/user.js` synchronisiert den
  Namen aus Login und Profil mit Session, Header und Settings. Späte Antworten
  eines anderen Kontos werden verworfen; Logout leert den Benutzerstand.

Automatisierte Abdeckung: `authService.ldapProfile.test.js`,
`userService.loginProfile.test.js`, `userRepository.profile.test.js`,
`ldapLoginApi.test.js` und `frontend/tests/userProfile.test.js`. Die
LDAP-/SQL-Transporte dieser Tests sind gemockt und erzeugen keine produktiven
Benutzerkonten. Die vorhandenen Publish-Agent-/Subscriber-Count-Tests laufen mit.

## Integrationsprüfung vom 4. November 2026 (Merge-Stand vor der Namenskorrektur)

- Backend: **9 Suites / 108 Tests bestanden**, einschließlich 15 zusätzlicher
  Tests in `backend/tests/sprintIntegration.test.js`. Diese starten den echten
  App-Einstieg auf einem freien Port mit gemockter DB und gemocktem Thesaurus
  und prüfen Versionierung, Legacy-Aliase, Counts, Vorschläge, Profil, CORS,
  Swagger und den SSE-Pfad gemeinsam.
- Frontend: `npm run lint -- --no-fix` fehlerfrei; `npm run build` erfolgreich.
  Build-Hinweise betreffen Browserslist-Daten und Asset-/Bundle-Größen.
- Backend- und Frontend-Docker-Images erfolgreich gebaut und die beiden
  App-Container für Smokeprüfungen gestartet.
- **16 Live-Smokeprüfungen bestanden**: versionierte und bisherige Routen,
  Counts gegen SQL-Zählung, bestehende/neue Tag-Vorschläge ohne Speicherung,
  vorhandenes Studienprofil samt Semester, Feed, Suche, Swagger und installierte
  Ollama-Modellkonfiguration.
- Zusätzliche Frontend-Prüfungen bestätigen den einfachen API-Prefix,
  gespeicherte Agent-Einstellungen samt Änderungsereignis, die Übernahme
  bestehender/neuer Topics und die gemeinsame Darstellung von Profil und
  Subscriber Counts. Die ausgelieferten Bundles enthalten beide Sprint-Stände.
- Migration zweimal auf einer temporären Tabelle geprüft und zurückgerollt:
  vier nullable Spalten, Unique-Constraint und vorhandener Testdatensatz erhalten.
  Die bestehende Datenbank enthält die vier Profilspalten bereits.
- Schreibende Veröffentlichungs-/Abonnement-Akzeptanztests und ein echter
  LDAP-Bind sind nicht Bestandteil dieser Integrationsprüfung; DB/LDAP in den
  entsprechenden automatisierten Tests sind gemockt.

---

# Sprint 3 – LDAP-Profiling & Identifikationslogik

Die folgenden Sprint-3-Abschlussangaben beschreiben den ursprünglichen Stand.
Die spätere Namensauflösung und ihre zusätzlichen Tests sind im Abschnitt
„LDAP-Anzeigenamen: verifizierte Profilquelle“ oben dokumentiert.

Dieses Dokument beschreibt die im Sprint 3 implementierten Funktionen, den
dazugehörigen API-Endpunkt, die Datenbank-Migration, die durchgeführte
Qualitätssicherung und die noch offenen Einschränkungen.

---

## 1. Überblick

Beim LDAP-Login werden aus der FH-Studierendenkennung (z. B. `if24b032`)
automatisch Profilinformationen abgeleitet, in der Datenbank gespeichert und
über einen eigenen API-Endpunkt ausgelesen. In den Einstellungen werden diese
Informationen schreibgeschützt angezeigt.

Ablauf:

```
LDAP-Login (Bestands- oder Neuanlage)
        │
        ▼
Kennungsparser (studentIdParser.parseStudentId)
  if24b032 → "if" | "24" | "b" | "032"
        │
        ▼
deriveProfile()  →  { studentId, studyProgram, degree, studyStartYear }
        │
        ▼
Speicherung in users (beim ersten Login) bzw. Update (bei jedem Folge-Login)
        │
        ▼
GET /api/v1/users/me  →  Profilfelder + dynamisch berechnetes currentSemester
        │
        ▼
SettingsView (Frontend) – read-only Profilkarte
```

Nicht verändert wurden: Hybrid-Login-Verhalten, Rollenprüfung,
JWT-Payload (`userId`, `email`, `role`) und JWT-Laufzeit.

---

## 2. Implementierte Funktionen

### 2.1 Kennungsparser (`backend/src/utils/studentIdParser.js`)

Reine Funktion ohne LDAP-, Auth- oder DB-Abhängigkeit.

- **Format (bestätigt):** `<2-stelliges Kürzel><2-stelliges Jahr><Abschlussbuchstabe><3-stellige Nummer>`
- **RegEx:** `^[a-zA-Z]{2}\d{2}[a-zA-Z]\d{3}$`
- **Beispiel:** `if24b032` → Kürzel `if`, Jahr `24`, Abschluss `b`, Nummer `032`
- Groß-/Kleinbuchstaben und führende/folgende Leerzeichen werden toleriert
  (Normalisierung auf Kleinschreibung).
- Rückgabe bei ungültigem Format: `{ valid: false, studentId }`
  (z. B. Mitarbeiterkennungen wie `m.mustermann`) – es werden **keine**
  Profilfelder abgeleitet.
- Mapping ausschließlich aus bestätigten Zuordnungen:
  - `if` → `Informatik`
  - `b` → `Bachelor`
  - Alles andere → `"unbekannt"` (Fallback, Kennung bleibt gültig)
- Studienbeginnjahr: zweistelliges Jahr → `20xx` (z. B. `24` → `2024`).

### 2.2 Semesterberechnung (`backend/src/utils/semester.js`)

Reine Funktion `calculateSemester(studyStartYear, date = new Date())`.

- Studienbeginn = Wintersemester des Jahres (Annahme).
- Wintersemester: Oktober–Februar (läuft über den Jahreswechsel),
  Sommersemester: März–September.
- Rückgabe: Anzahl der Semester (1 = erstes Semester) oder `null`
  bei ungültigem/zukünftigem Studienbeginn bzw. ungültigem Datum.
- Beispiel: Studienbeginn 2024, Stand November 2026 → **5. Semester**.
- Das Semester wird **nicht gespeichert**, sondern bei jedem Abruf berechnet.

### 2.3 Profilerfassung beim LDAP-Login (`backend/src/services/userService.js`)

- **Neuer LDAP-User (JIT-Provisioning):** Beim ersten Login wird das Konto wie
  bisher angelegt; die Profilfelder werden direkt mitgeschrieben
  (`...(profile || {})`). Rolle weiterhin über `STUDENT_ID_REGEX`
  (`STUDENT` bei gültiger Kennung, sonst `EMPLOYEE`).
- **Bestehender LDAP-User:** Bei jedem erfolgreichen LDAP-Login werden die
  Profilfelder nachgeführt (`userRepository.updateProfile`).
- **Lokale Konten:** Der LDAP-Fallback wird für lokale Konten nie zum
  Schreiben von Profilfelder verwendet – lokale Daten bleiben unverändert.
- **Mitarbeiter / ungültiges Kennungsformat:** `deriveProfile()` liefert
  `null`, es werden keine Profilfelder gespeichert (alle `NULL`).
- **Login-Response unverändert:** `{ message, token, user }` – Profile erscheinen
  nicht im Login-Response.
- **JWT unverändert:** Payload `{ userId, email, role }`, Laufzeit
  `JWT_EXPIRES_IN` (Default 2h).

### 2.4 Profil-API: `GET /api/v1/users/me` (`backend/src/routes/users.js`)

- Authentifizierung über bestehende Bearer-JWT-Middleware.
- Die Benutzer-ID stammt **ausschließlich** aus dem validierten Token
  (`req.user.id`), nie aus Pfad- oder Query-Parametern.
- Registrierung vor der Route `/:id`, damit `/me` nicht als UUID interpretiert wird.
- Zusätzlich unter dem bestehenden Pfad `/users/me` erreichbar
  (gleicher Router, kein zweites Feature).
- Swagger-Dokumentation: Endpunkt + Schema `UserProfile` + `BearerAuth`.
- Enthält nie Passwort-Hashes; bei fehlenden Profildaten sind die vier
  Profilfelder und `currentSemester` `null`.

Siehe Abschnitt 3 für die vollständige Feldliste und Beispiele.

### 2.5 Profilanzeige im Frontend (`frontend/src/views/SettingsView.vue`)

- Neue read-only Profilkarte (Badge „Nur zur Anzeige") oberhalb des Rollen-Agent.
- Daten werden über `frontend/src/services/profileService.js` →
  `GET /api/v1/users/me` geladen (bestehender Axios-Client mit
  Bearer-Token-Interceptor, `baseURL` = `VUE_APP_API_URL` + `/api/v1`).
- Anzeige: Anzeigename, E-Mail, Rolle, Studiengang, Abschlussart,
  Studienbeginnjahr, Aktuelles Semester (`5. Semester`).
- Fehlende Werte (`null`/leer) werden als **„Nicht verfügbar"** dargestellt
  (kursiv, abgegrenzter Stil).
- Ladezustand („Lade Profil…"), Fehlerzustand
  (401 → „Nicht angemeldet – bitte erneut einloggen.",
  sonst „Profil konnte nicht geladen werden.").
- Bestehende Einstellungs-Blöcke (Rollen-, Tag-, Publish-, Message-Agent)
  und deren Funktionalität wurden nicht verändert.

### 2.6 Datenbank-Migration

Siehe Abschnitt 4.

---

## 3. Profilfelder und API-Endpunkt

### 3.1 Felder (Datenbank ↔ API)

| Datenbank-Spalte (`users`) | API-Feld (`GET .../users/me`) | Typ | Beispiel | Wenn keine Kennung |
|---|---|---|---|---|
| `student_id` (UNIQUE, neu) | – (nur intern gespeichert) | text | `if24b032` | `NULL` |
| `study_program` (neu) | `studyProgram` | string\|null | `Informatik` | `NULL` |
| `degree` (neu) | `degree` | string\|null | `Bachelor` | `NULL` |
| `study_start_year` (neu) | `studyStartYear` | integer\|null | `2024` | `NULL` |
| – (nicht gespeichert) | `currentSemester` | integer\|null | `5` | `null` |
| `id` | `id` | uuid | | |
| `display_name` | `displayName` | string | | |
| `email` | `email` | string | | |
| `role` | `role` | `STUDENT`\|`EMPLOYEE` | | |

`currentSemester` wird dynamisch berechnet und nie persistiert.
Unbekannte Kürzel/Buchstaben werden als gespeicherter Fallback
`"unbekannt"` zurückgegeben (nicht `null`), solange die Kennung selbst
gültig ist.

### 3.2 `GET /api/v1/users/me`

- **Auth:** `Authorization: Bearer <JWT>` (Pflicht)
- **Fehler:** `401 MISSING_AUTH_HEADER` | `401 INVALID_AUTH_FORMAT` |
  `401 INVALID_OR_EXPIRED_TOKEN` | `404 User not found`

Erfolgsbeispiel (LDAP-Student, Stand November 2026):

```json
GET /api/v1/users/me
Authorization: Bearer <token>

{
  "id": "dbad32a7-17e3-46d9-8dc6-83e37293a905",
  "displayName": "if24b032",
  "email": "if24b032@technikum-wien.at",
  "role": "STUDENT",
  "studyProgram": "Informatik",
  "degree": "Bachelor",
  "studyStartYear": 2024,
  "currentSemester": 5
}
```

Lokales Konto bzw. Konto ohne Profildaten:

```json
{
  "id": "…",
  "displayName": "QA Local",
  "email": "qa-local@example.com",
  "role": "STUDENT",
  "studyProgram": null,
  "degree": null,
  "studyStartYear": null,
  "currentSemester": null
}
```

Erreichbar auch unter dem Legacy-Pfad `GET /users/me` (identische Antwort).

---

## 4. Datenbank-Migration

- **Datei:** `db/migrations/001_user_profile_fields.sql`
- **Frische Datenbanken:** `db/init/01_schema.sql` enthält dieselben Spalten.
- **Art:** additiv und idempotent (`ADD COLUMN IF NOT EXISTS`), ausschließlich
  `NULL`-fähige Spalten – Bestandsdaten und lokale Konten bleiben unverändert,
  kein Reset, keine Löschungen.

Neue Spalten der Tabelle `users`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_program TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS degree TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS study_start_year SMALLINT;
```

Anwendung auf eine bereits laufende Datenbank (Projekt-Root):

```bash
Get-Content -Raw db/migrations/001_user_profile_fields.sql |
  docker exec -i newscenter-db psql -U newscenter -d newscenter -v ON_ERROR_STOP=1
```

Alternativ in Adminer (`http://localhost:8080`) ausführen. Das Skript kann
mehrfach ausgeführt werden.

---

## 5. Geänderte und neue Dateien

| Datei | Änderung |
|---|---|
| `backend/src/utils/studentIdParser.js` | **neu** – Kennungsparser |
| `backend/src/utils/semester.js` | **neu** – Semesterberechnung |
| `backend/src/services/userService.js` | `deriveProfile()`, Profilerfassung im Login, `getMyProfile()` |
| `backend/src/routes/users.js` | `GET /me` (auth) vor `/:id` |
| `backend/src/repositories/userRepository.js` | optionale Profil-Parameter in `create()`, `updateProfile()`, `findProfileById()` |
| `backend/src/index.js`, `backend/swagger.js` | API-Mounts und Swagger (`UserProfile`, `BearerAuth`) |
| `db/migrations/001_user_profile_fields.sql` | **neu** – Migration |
| `db/init/01_schema.sql` | Profilspalten für frische Datenbanken |
| `frontend/src/services/profileService.js` | **neu** – `getMyProfile()` |
| `frontend/src/views/SettingsView.vue` | read-only Profilkarte |
| `frontend/src/styles/SettingsView.css` | Profile-Stile (additiv) |
| `backend/tests/studentIdParser.test.js` | **neu** – 5 Tests |
| `backend/tests/semester.test.js` | **neu** – 13 Tests |
| `backend/tests/userRepository.profile.test.js` | **neu** – 14 Tests |
| `backend/tests/userService.loginProfile.test.js` | **neu** – 13 Tests |
| `backend/tests/userProfileApi.test.js` | **neu** – 13 Tests |

Unverändert (bewusst): `backend/src/middleware/auth.js`,
`backend/src/services/authService.js` (LDAP-Bind, JWT-Signatur),
`backend/src/services/messageService.js`, Login- und Rollenlogik.

---

## 6. Tests und Qualitätssicherung

### 6.1 Unit-/Integrations-Tests (Jest, ohne DB/LDAP/Netz)

```bash
cd backend
npm test
```

**Ergebnis: 7 Suites / 81 Tests – alle bestanden.**

| Datei | Inhalt |
|---|---|
| `tests/studentIdParser.test.js` | gültige/ungültige Kennungen, Jahr-20xx, Unbekannt-Fallbacks |
| `tests/semester.test.js` | WS/SS-Übergänge, Jahreswechsel, zukünftiger Start, Parser-Integration |
| `tests/userRepository.profile.test.js` | Profilspalten, Rückwärtskompatibilität, Migration idempotent/destruktionsfrei |
| `tests/userService.loginProfile.test.js` | neuer/bestehender LDAP-User, lokale Konten, Rollenprüfung, JWT/Response unverändert |
| `tests/userProfileApi.test.js` | `/me`-Antwort, fehlende Profildaten, alle 401/404-Fälle, kein `password_hash` |
| `tests/authService.test.js`, `tests/messageService.test.js` | Bestandstests (unverändert) |

### 6.2 Live-Prüfung im laufenden Stack (Sprint-3-Abschluss-QS)

50 Checks gegen den laufenden Container-Stack (LDAP-Zugriff über einen
Prozess-internen Mock, da keine echten LDAP-Zugangsdaten vorliegen;
Login-, JIT-, Profil-, JWT- und API-Pfade sind der echte Produktcode):

- **Ablauf:** neuer LDAP-Student → JIT + Profil → `GET /me` (8 Felder,
  `currentSemester: 5`, kein `password_hash`) – bestanden.
- **Bestehender LDAP-User** (`if24b158`, Bestandskonto): Profil wurde beim
  Login korrekt ergänzt (`Informatik`/`Bachelor`/`2024`); Folge-Login
  schreibt idempotent dieselben Werte – bestanden.
- **Neue/bestehende LDAP-User, lokale Konten:** Registrierung, lokaler Login,
  LDAP-Login, falsche Passwörter (401), lokales Konto bleibt ohne
  Profildaten – bestanden.
- **Grenzfälle:** unbekanntes Kürzel (`xy24b001` → `unbekannt`),
  unbekannter Abschlussbuchstabe (`if24x001` → `unbekannt`),
  Mitarbeiterkennung (`m.mustermann` → `EMPLOYEE`, alle Profilfelder `null`),
  fehlende Profildaten (Bestands- und lokale Konten) – bestanden.
- **Regression:** Nachrichtenfeed (STUDENT/EMPLOYEE-Rollenfilter,
  `filter=all`, mit/ohne Abonnement), Thesaurus-Suche, Nachricht lesen,
  Validierung `POST /messages`, Tags, Abonnements (anlesen/legen/löschen),
  Benutzer-Routen (200/400/404), alle 401-Auth-Fälle, JWT-Payload
  unverändert, Swagger (UI + Endpunkt + Schema) – bestanden.
- **Aufräumen:** Alle QA-Testkonten wurden wieder entfernt;
  Bestandsdaten unverändert (4 Users, 6 Nachrichten, 5 Tags, 7 Abos).

**Ergebnis: 50/50 Checks bestanden.**

### 6.3 Frontend

```bash
cd frontend
npm run lint    # 0 Fehler
npm run build   # Build erfolgreich
```

---

## 7. Offene Einschränkungen (bewusst dokumentiert)

1. **Studiengang-Mapping nur teilweise bestätigt.**
   Bestätigt und implementiert sind ausschließlich `if` → „Informatik" und
   `b` → „Bachelor". Alle anderen Kürzel/Buchstaben liefern den Fallback
   `"unbekannt"`. Die vollständige Mapping-Tabelle der FH Technikum Wien
   (weitere Studiengänge, Master- und andere Abschlussbuchstaben) steht noch
   aus und muss nachgetragen werden (`STUDY_PROGRAMS`/`DEGREES` in
   `backend/src/utils/studentIdParser.js`).

2. **Master-Format unbestätigt.**
   Ob ein Masterabschluss über dieselbe Kennungsstruktur mit einem eigenen
   Buchstaben (z. B. `m`) kodiert wird, ist nicht bestätigt. Ein solcher
   Buchstabe ergäbe aktuell `degree: "unbekannt"`; ein abweichendes
   Gesamtformat (z. B. längere Kennung) würde als ungültig erkannt und
   führt zu keinem Profil.

3. **Semester ist rechnerisch, nicht das tatsächliche Semester.**
   Die Berechnung basiert ausschließlich auf dem Studienbeginnjahr aus der
   Kennung und den festen Termingrenzen WS (Okt–Feb) / SS (Mär–Sep).
   Studienunterbrechungen, wiederholte Semester, vorzeitige Abschlüsse oder
   abweichende Studienpläne werden **nicht** berücksichtigt; maßgeblich wäre
   ein Studienverlauf aus der Verwaltung, der hier nicht angebunden ist.
   Die Annahme „Studienbeginn im Wintersemester" ist ebenfalls eine
   Vereinfachung.

4. **Zweistelliges Jahr → `20xx`.**
   Kennungen mit `xx` werden pauschal als 20xx interpretiert (keine
   Jahrhundert-Logik).

5. **Kein echter LDAP-End-to-End-Test.**
   Unit-Tests mocken LDAP/DB; die Live-Prüfung nutzte einen prozessinternen
   LDAP-Mock, da keine echten Zugangsdaten vorliegen. Der echte
   StartTLS-Bind wurde in dieser Sprint-QS nicht gegen den Server der
   FH ausgeführt.

6. **Mitarbeiterkennung-Format undefiniert.**
   Für Mitarbeiterkonten ist kein Kennungsformat definiert; jedes nicht
   passende Format führt zu `EMPLOYEE` ohne Profilfelder.

---

## 8. Reproduktion der Tests

```bash
# Backend-Tests
cd backend && npm test

# Frontend
cd frontend && npm run lint && npm run build

# Migration (laufende DB)
Get-Content -Raw db/migrations/001_user_profile_fields.sql |
  docker exec -i newscenter-db psql -U newscenter -d newscenter -v ON_ERROR_STOP=1
```

---

# Innolab 3 Sprint 2

## Ziel

Vollständige Entkopplung der Backend-Services von der Benutzeroberfläche (Frontend-Unabhängigkeit).

---

## 1. CORS – Konfigurierbar per ENV

**Problem:** `app.use(cors())` erlaubte alle Origins unkontrolliert.

**Lösung:** Origin-Whitelist über `ALLOWED_ORIGIN` (ENV):

```js
// backend/src/index.js
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "*").split(",").map(o => o.trim());
app.use(cors({ origin: ..., methods: [...], allowedHeaders: [...], credentials: true }));
```

| Datei | Änderung |
|---|---|
| `backend/.env` | `ALLOWED_ORIGIN=http://localhost:8081` |
| `docker-compose.yml` | `- ALLOWED_ORIGIN=http://localhost:8081` |

> Für Produktion: `ALLOWED_ORIGIN=https://meine-app.at` (kommasepariert für mehrere Domains)

---

## 2. API-Versioning – `/api/v1/...`

**Problem:** Alle Endpunkte lagen auf dem Root-Pfad – Breaking Changes erfordern simultane Frontend-Anpassung.

**Lösung:** Alle Routen unter `/api/v1` versioniert:

```js
// backend/src/index.js
const API_PREFIX = "/api/v1";
app.use(`${API_PREFIX}/users`,    usersRouter);
app.use(`${API_PREFIX}/tags`,     tagsRouter);
app.use(`${API_PREFIX}/messages`, messagesRouter);
```

```js
// frontend/src/services/api.js
baseURL: (process.env.VUE_APP_API_URL || 'http://localhost:3000') + '/api/v1'
```

**Ausnahme:** `/subscribe` (SSE) bleibt ohne Prefix – `EventSource` im Browser unterstützt keine Custom-Headers.

Im integrierten Stand bleiben `/users`, `/tags` und `/messages` als kompatible
Aliase erhalten. Der Profilservice verwendet wie die anderen Services einen
Pfad ohne eigenes `/api/v1`, damit das Präfix nur einmal ergänzt wird.

---

## 3. Swagger / OpenAPI – Vollständige Dokumentation

**Problem:** Die meisten Endpunkte fehlten in der Swagger-Spec – externe Systeme konnten die API nicht vollständig aus der Doku ableiten.

**Lösung:** Alle Endpunkte vollständig in `backend/swagger.js` dokumentiert und via `setupSwagger()` eingebunden:

| Gruppe | Endpunkte |
|---|---|
| **Users** | `GET /users`, `POST /users`, `POST /users/login`, `GET /users/{id}` |
| **Subscriptions** | `GET /users/{id}/subscriptions`, `POST /users/{id}/subscriptions`, `DELETE /users/{id}/subscriptions/{tagId}` |
| **Tags** | `GET /tags`, `POST /tags`, `GET /tags/{id}` |
| **Messages** | `GET /messages`, `POST /messages`, `GET /messages/{id}`, `GET /messages/search` |
| **Messages** | `POST /messages/{id}/tags`, `POST /messages/{id}/summarize`, `POST /messages/tag-suggestions` |
| **SSE** | `GET /subscribe` |

Zusätzlich ergänzt:
- **`components/schemas`**: wiederverwendbare Schemas für `User`, `Message`, `Tag`, `Error`
- **`securitySchemes`**: `BearerAuth` (JWT) – alle geschützten Endpunkte mit `security`-Referenz
- **Tag-Gruppierung**: Endpunkte in `Users`, `Subscriptions`, `Tags`, `Messages`, `SSE` gegliedert

Erreichbar unter: `http://localhost:3000/api-docs`

---

## 4. Swagger-Auslagerung – `swagger.js`

**Problem:** Die vollständige OpenAPI-Spec (~350 Zeilen JSON) war direkt in `backend/src/index.js` eingebettet → Datei hatte 574 Zeilen, schlecht wartbar.

**Lösung:** Swagger-Doku in `backend/swagger.js` ausgelagert:

```js
// backend/swagger.js
function setupSwagger(app, { port, apiPrefix }) { ... }
module.exports = { setupSwagger };

// backend/src/index.js
const { setupSwagger } = require("../swagger");
setupSwagger(app, { port, apiPrefix: API_PREFIX });
```

| | Vorher | Nachher |
|---|---|---|
| `index.js` | 574 Zeilen | **121 Zeilen** |
| `swagger.js` | 55 Zeilen (veraltet) | **~360 Zeilen** (vollständig) |

---
## 5. AppHeader und Settings änderung

**Problem:** Man konnte den Benutzernamen nicht sehen. Man wusste nicht welche Account eingeloggt ist.

**Lösung:** AppHeader und SettingsView wurden ergänzt.

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `backend/src/index.js` | CORS-Whitelist + `/api/v1`-Prefix + SSE-Header bereinigt → Swagger ausgelagert (121 Zeilen) |
| `backend/swagger.js` | Vollständige OpenAPI-Spec mit allen Endpunkten, Schemas und Auth |
| `backend/.env` | `ALLOWED_ORIGIN` hinzugefügt |
| `docker-compose.yml` | `ALLOWED_ORIGIN` als ENV-Variable |
| `frontend/src/services/api.js` | `baseURL` um `/api/v1` erweitert |
| `frontend/src/services/sseService.js` | Kommentar zur SSE-Ausnahme ergänzt |
| `frontend/src/components/AppHeader.vue` | Benutzernamen und Login-Info ergänzt |
| `frontend/src/views/SettingsView.vue` | Benutzernamen und Login-Info ergänzt |
| `documentation.md` | Dieses Dokument |
