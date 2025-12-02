/**
 * Azure Function: check-availability
 * Prüft welche Tische zu einem bestimmten Zeitpunkt bereits gebucht sind
 */

const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

// Tisch-Konfiguration
const TABLES = ['R1', 'R3', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11'];
const RESERVATION_DURATION_HOURS = 3;

module.exports = async function (context, req) {
    context.log('check-availability function aufgerufen');

    // CORS Headers
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res.status = 204;
        return;
    }

    try {
        const date = req.query.date;
        const time = req.query.time;

        if (!date || !time) {
            context.res.status = 400;
            context.res.body = { error: 'Datum und Uhrzeit sind erforderlich' };
            return;
        }

        // Access Token abrufen
        const accessToken = await getAccessToken();
        
        // Graph Client initialisieren
        const client = Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });

        // Start- und Endzeit berechnen
        const startDateTime = new Date(`${date}T${time}:00`);
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + RESERVATION_DURATION_HOURS);

        // Kalendereinträge für den Zeitraum abrufen
        const calendarView = await client
            .api('/users/wirtshaus@metzenhof.at/calendar/calendarView')
            .query({
                startDateTime: startDateTime.toISOString(),
                endDateTime: endDateTime.toISOString()
            })
            .get();

        // Gebuchte Tische aus den Terminen extrahieren
        const bookedTables = [];
        
        for (const event of calendarView.value) {
            // Tischnummer aus dem Betreff oder Ort extrahieren
            for (const tableId of TABLES) {
                if (event.subject && event.subject.includes(tableId)) {
                    bookedTables.push(tableId);
                }
                if (event.location && event.location.displayName && 
                    event.location.displayName.includes(tableId)) {
                    bookedTables.push(tableId);
                }
            }
        }

        // Duplikate entfernen
        const uniqueBookedTables = [...new Set(bookedTables)];

        context.res.body = {
            date: date,
            time: time,
            bookedTables: uniqueBookedTables
        };

    } catch (error) {
        context.log.error('Fehler:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Interner Serverfehler',
            message: error.message 
        };
    }
};

/**
 * Access Token von Azure AD abrufen
 */
async function getAccessToken() {
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        body: params,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    if (!response.ok) {
        throw new Error('Token konnte nicht abgerufen werden');
    }

    const data = await response.json();
    return data.access_token;
}


