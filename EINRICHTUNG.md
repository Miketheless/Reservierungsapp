# Metzenhof Tischreservierung - Einrichtungsanleitung

Diese Anleitung erklärt Schritt für Schritt, wie Sie die Buchungsplattform für das Wirtshaus Metzenhof einrichten.

## 📁 Projektübersicht

```
├── index.html              # Buchungsformular (Hauptseite)
├── confirmation.html       # Bestätigungsseite
├── style.css              # Styling
├── app.js                 # JavaScript-Logik
├── azure-functions/       # Backend für Outlook-Integration
│   ├── check-availability/
│   ├── create-booking/
│   ├── host.json
│   └── package.json
└── EINRICHTUNG.md         # Diese Anleitung
```

---

## 🚀 Teil 1: Frontend einrichten (einfach)

Das Frontend (die Webseite) kann auf jedem Webserver gehostet werden.

### Option A: Auf Ihrem bestehenden Webhosting

1. Laden Sie diese Dateien auf Ihren Webserver hoch:
   - `index.html`
   - `confirmation.html`
   - `style.css`
   - `app.js`

2. Die Buchungsseite ist dann unter Ihrer Domain erreichbar, z.B.:
   - `https://www.metzenhof.at/reservierung/`

### Option B: Azure Static Web Apps (kostenlos)

1. Gehen Sie zu [Azure Portal](https://portal.azure.com)
2. Klicken Sie auf "Ressource erstellen"
3. Suchen Sie nach "Static Web App"
4. Folgen Sie dem Assistenten:
   - Wählen Sie "Free" als Plan
   - Verbinden Sie Ihr GitHub-Repository oder laden Sie die Dateien manuell hoch

---

## ⚙️ Teil 2: Azure Backend einrichten

Das Backend ist notwendig, damit die Reservierungen automatisch in den Outlook-Kalender eingetragen werden.

### Schritt 1: Azure App Registration erstellen

1. Gehen Sie zu [Azure Portal](https://portal.azure.com)
2. Navigieren Sie zu **"Azure Active Directory"** → **"App-Registrierungen"**
3. Klicken Sie auf **"Neue Registrierung"**
4. Füllen Sie aus:
   - **Name:** `Metzenhof Buchungssystem`
   - **Unterstützte Kontotypen:** "Nur Konten in diesem Organisationsverzeichnis"
5. Klicken Sie auf **"Registrieren"**

6. Notieren Sie sich diese Werte (Sie brauchen sie später):
   - **Anwendungs-ID (Client):** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Verzeichnis-ID (Mandant/Tenant):** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Schritt 2: Client Secret erstellen

1. In der App-Registrierung: **"Zertifikate & Geheimnisse"**
2. Klicken Sie auf **"Neuer geheimer Clientschlüssel"**
3. Beschreibung: `Booking API Secret`
4. Ablauf: Wählen Sie einen Zeitraum (z.B. 24 Monate)
5. **WICHTIG:** Kopieren Sie den Wert sofort! Er wird nur einmal angezeigt.

### Schritt 3: API-Berechtigungen hinzufügen

1. In der App-Registrierung: **"API-Berechtigungen"**
2. Klicken Sie auf **"Berechtigung hinzufügen"**
3. Wählen Sie **"Microsoft Graph"**
4. Wählen Sie **"Anwendungsberechtigungen"** (nicht delegiert!)
5. Fügen Sie diese Berechtigungen hinzu:
   - `Calendars.ReadWrite` (Kalender lesen und schreiben)
   - `Mail.Send` (E-Mails senden)
6. Klicken Sie auf **"Administratoreinwilligung erteilen"**

### Schritt 4: Azure Function App erstellen

1. Im Azure Portal: **"Ressource erstellen"** → **"Function App"**
2. Einstellungen:
   - **Funktions-App-Name:** `metzenhof-booking` (oder ähnlich)
   - **Laufzeitstapel:** Node.js
   - **Version:** 18 LTS
   - **Region:** West Europe
   - **Plan:** Consumption (Serverless) - kostenlos für geringe Nutzung
3. Klicken Sie auf **"Erstellen"**

### Schritt 5: Functions deployen

**Option A: Über VS Code (empfohlen)**
1. Installieren Sie die "Azure Functions" Extension
2. Melden Sie sich bei Azure an
3. Rechtsklick auf den `azure-functions` Ordner
4. "Deploy to Function App..."
5. Wählen Sie Ihre Function App aus

**Option B: Über das Azure Portal**
1. Öffnen Sie Ihre Function App
2. Für jede Function (check-availability, create-booking):
   - Klicken Sie auf "Funktionen" → "Erstellen"
   - Wählen Sie "HTTP trigger"
   - Kopieren Sie den Code aus den entsprechenden `index.js` Dateien

### Schritt 6: Umgebungsvariablen setzen

1. In Ihrer Function App: **"Konfiguration"**
2. Fügen Sie diese **Anwendungseinstellungen** hinzu:

| Name | Wert |
|------|------|
| `AZURE_TENANT_ID` | Ihre Verzeichnis-ID (Tenant) |
| `AZURE_CLIENT_ID` | Ihre Anwendungs-ID (Client) |
| `AZURE_CLIENT_SECRET` | Ihr Client Secret |

3. Klicken Sie auf **"Speichern"**

### Schritt 7: Frontend mit Backend verbinden

1. Kopieren Sie die URL Ihrer Function App:
   - Format: `https://metzenhof-booking.azurewebsites.net`
   
2. Öffnen Sie `app.js` und ändern Sie Zeile 3:
   ```javascript
   API_URL: 'https://metzenhof-booking.azurewebsites.net/api',
   ```

3. Laden Sie die aktualisierte `app.js` auf Ihren Webserver hoch.

---

## 📧 Teil 3: E-Mail-Konfiguration

Die E-Mails werden über die Adresse `wirtshaus@metzenhof.at` versendet. Stellen Sie sicher, dass:

1. Das Microsoft 365 Konto aktiv ist
2. Die App-Registrierung Zugriff auf dieses Postfach hat (siehe Schritt 3)

---

## 🪑 Teil 4: Tische als Ressourcen (optional)

Für eine noch bessere Organisation können Sie in Outlook/Exchange Raumressourcen für die Tische anlegen:

1. Im Microsoft 365 Admin Center
2. **"Ressourcen"** → **"Räume & Ausstattung"**
3. Erstellen Sie für jeden Tisch eine Ressource:
   - R1, R3, R5, R6, R7, R8 (6 Personen)
   - R9, R10 (10 Personen)
   - R11 (6 Personen)

Dies ist optional - das System funktioniert auch ohne diese Ressourcen.

---

## ✅ Testen

1. Öffnen Sie Ihre Buchungsseite im Browser
2. Wählen Sie ein Datum (Do-So)
3. Wählen Sie eine Uhrzeit und Personenanzahl
4. Wählen Sie einen Tisch
5. Füllen Sie die Kontaktdaten aus
6. Senden Sie die Reservierung ab

**Prüfen Sie:**
- [ ] Erscheint ein Eintrag im Outlook-Kalender von wirtshaus@metzenhof.at?
- [ ] Wurde eine E-Mail an die Test-E-Mail-Adresse gesendet?
- [ ] Wurde eine E-Mail an wirtshaus@metzenhof.at gesendet?

---

## 🔧 Fehlerbehebung

### "Demo-Modus" wird angezeigt
Das Backend ist nicht korrekt konfiguriert. Prüfen Sie:
- Ist die Function App gestartet?
- Stimmt die API_URL in `app.js`?
- Sind die Umgebungsvariablen gesetzt?

### E-Mails werden nicht gesendet
- Prüfen Sie die API-Berechtigungen (Mail.Send)
- Hat der Admin die Einwilligung erteilt?

### Kalendereintrag wird nicht erstellt
- Prüfen Sie die API-Berechtigungen (Calendars.ReadWrite)
- Existiert das Postfach wirtshaus@metzenhof.at?

### CORS-Fehler im Browser
- Prüfen Sie, ob die Function "anonymous" Auth Level hat
- Die CORS-Headers sollten in den Functions gesetzt sein

---

## 💰 Kosten

- **Frontend (Static Web App):** Kostenlos
- **Azure Functions (Consumption Plan):** 
  - Erste 1 Million Ausführungen/Monat: Kostenlos
  - Für ein Restaurant: Praktisch kostenlos
- **Microsoft 365:** Ihre bestehende Lizenz

---

## 📞 Support

Bei Fragen oder Problemen:
- Dokumentation: [Microsoft Graph API](https://docs.microsoft.com/graph)
- Azure Functions: [Azure Docs](https://docs.microsoft.com/azure/azure-functions)

---

*Erstellt für Wirtshaus Metzenhof - www.metzenhof.at*


