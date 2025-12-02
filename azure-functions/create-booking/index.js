/**
 * Azure Function: create-booking
 * Erstellt eine Tischreservierung im Outlook-Kalender und sendet E-Mails
 */

const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const RESERVATION_DURATION_HOURS = 3;
const WIRTSHAUS_EMAIL = 'wirtshaus@metzenhof.at';

// Tisch-Kapazitäten
const TABLE_CAPACITY = {
    'R1': 6, 'R3': 6, 'R5': 6, 'R6': 6, 'R7': 6, 
    'R8': 6, 'R9': 10, 'R10': 10, 'R11': 6
};

module.exports = async function (context, req) {
    context.log('create-booking function aufgerufen');

    // CORS Headers
    context.res = {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    };

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        context.res.status = 204;
        return;
    }

    try {
        const booking = req.body;

        // Validierung
        if (!booking.date || !booking.time || !booking.table || 
            !booking.firstName || !booking.lastName || 
            !booking.email || !booking.phone || !booking.guests) {
            context.res.status = 400;
            context.res.body = { error: 'Alle Pflichtfelder müssen ausgefüllt sein' };
            return;
        }

        // Bestätigungscode generieren
        const confirmationCode = generateConfirmationCode();

        // Access Token abrufen
        const accessToken = await getAccessToken();
        
        // Graph Client initialisieren
        const client = Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });

        // Start- und Endzeit berechnen
        const startDateTime = new Date(`${booking.date}T${booking.time}:00`);
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + RESERVATION_DURATION_HOURS);

        // Kalendereintrag erstellen
        const event = {
            subject: `Reservierung ${booking.table} - ${booking.firstName} ${booking.lastName} (${booking.guests} Pers.)`,
            body: {
                contentType: 'HTML',
                content: `
                    <h2>Tischreservierung</h2>
                    <p><strong>Bestätigungscode:</strong> ${confirmationCode}</p>
                    <hr>
                    <p><strong>Name:</strong> ${booking.firstName} ${booking.lastName}</p>
                    <p><strong>E-Mail:</strong> ${booking.email}</p>
                    <p><strong>Telefon:</strong> ${booking.phone}</p>
                    <p><strong>Personenanzahl:</strong> ${booking.guests}</p>
                    <p><strong>Tisch:</strong> ${booking.table} (max. ${TABLE_CAPACITY[booking.table]} Personen)</p>
                    ${booking.notes ? `<p><strong>Anmerkungen:</strong> ${booking.notes}</p>` : ''}
                `
            },
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Europe/Vienna'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Europe/Vienna'
            },
            location: {
                displayName: `Tisch ${booking.table}`
            },
            categories: ['Tischreservierung', booking.table],
            showAs: 'busy'
        };

        await client
            .api(`/users/${WIRTSHAUS_EMAIL}/calendar/events`)
            .post(event);

        context.log('Kalendereintrag erstellt');

        // E-Mail an Kunden senden
        await sendCustomerEmail(client, booking, confirmationCode, startDateTime, endDateTime);
        context.log('Kunden-E-Mail gesendet');

        // E-Mail an Wirtshaus senden
        await sendWirtshausEmail(client, booking, confirmationCode, startDateTime, endDateTime);
        context.log('Wirtshaus-E-Mail gesendet');

        context.res.body = {
            success: true,
            confirmationCode: confirmationCode,
            message: 'Reservierung erfolgreich erstellt'
        };

    } catch (error) {
        context.log.error('Fehler:', error);
        context.res.status = 500;
        context.res.body = { 
            error: 'Reservierung konnte nicht erstellt werden',
            message: error.message 
        };
    }
};

/**
 * Bestätigungscode generieren
 */
function generateConfirmationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MH-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * E-Mail an Kunden senden
 */
async function sendCustomerEmail(client, booking, confirmationCode, startDateTime, endDateTime) {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = startDateTime.toLocaleDateString('de-AT', dateOptions);
    const formattedTime = booking.time;

    const email = {
        message: {
            subject: `Reservierungsbestätigung - Wirtshaus Metzenhof (${confirmationCode})`,
            body: {
                contentType: 'HTML',
                content: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #507d71; padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Wirtshaus Metzenhof</h1>
                        </div>
                        
                        <div style="padding: 30px; background: #f8f7f5;">
                            <h2 style="color: #507d71;">Ihre Reservierung ist bestätigt!</h2>
                            
                            <p>Guten Tag ${booking.firstName} ${booking.lastName},</p>
                            
                            <p>vielen Dank für Ihre Reservierung im Wirtshaus Metzenhof. Wir freuen uns auf Ihren Besuch!</p>
                            
                            <div style="background: white; padding: 20px; border: 1px dashed #bfa678; margin: 20px 0;">
                                <p style="text-align: center; margin-bottom: 10px;"><strong>Ihr Reservierungscode:</strong></p>
                                <p style="text-align: center; font-size: 24px; font-weight: bold; color: #507d71; letter-spacing: 3px;">${confirmationCode}</p>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Datum:</strong></td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${formattedDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Uhrzeit:</strong></td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${formattedTime} Uhr</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Personen:</strong></td>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #ddd;">${booking.guests}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0;"><strong>Tisch:</strong></td>
                                    <td style="padding: 10px 0;">${booking.table}</td>
                                </tr>
                            </table>
                            
                            ${booking.notes ? `<p style="margin-top: 20px;"><strong>Ihre Anmerkungen:</strong><br>${booking.notes}</p>` : ''}
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                            
                            <p><strong>Öffnungszeiten:</strong><br>
                            Donnerstag - Samstag: 11:00 - 20:00 Uhr<br>
                            Sonntag: 11:00 - 16:00 Uhr</p>
                            
                            <p>Bei Änderungen oder Stornierungen kontaktieren Sie uns bitte rechtzeitig unter:<br>
                            E-Mail: <a href="mailto:wirtshaus@metzenhof.at">wirtshaus@metzenhof.at</a></p>
                            
                            <p>Mit freundlichen Grüßen,<br>
                            <strong>Ihr Team vom Wirtshaus Metzenhof</strong></p>
                        </div>
                        
                        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                            <p style="margin: 0;">© 2025 Wirtshaus Metzenhof | <a href="https://www.metzenhof.at" style="color: #bfa678;">www.metzenhof.at</a></p>
                        </div>
                    </div>
                `
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: booking.email
                    }
                }
            ]
        },
        saveToSentItems: true
    };

    await client
        .api(`/users/${WIRTSHAUS_EMAIL}/sendMail`)
        .post(email);
}

/**
 * E-Mail an Wirtshaus senden
 */
async function sendWirtshausEmail(client, booking, confirmationCode, startDateTime, endDateTime) {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = startDateTime.toLocaleDateString('de-AT', dateOptions);

    const email = {
        message: {
            subject: `Neue Reservierung: ${booking.table} - ${booking.firstName} ${booking.lastName} (${formattedDate})`,
            body: {
                contentType: 'HTML',
                content: `
                    <div style="font-family: Arial, sans-serif;">
                        <h2 style="color: #507d71;">Neue Tischreservierung eingegangen</h2>
                        
                        <p><strong>Bestätigungscode:</strong> ${confirmationCode}</p>
                        
                        <table style="border-collapse: collapse; margin: 20px 0;">
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Datum</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${formattedDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Uhrzeit</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${booking.time} Uhr</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Tisch</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${booking.table}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Personen</strong></td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${booking.guests}</td>
                            </tr>
                        </table>
                        
                        <h3>Kundendaten:</h3>
                        <ul>
                            <li><strong>Name:</strong> ${booking.firstName} ${booking.lastName}</li>
                            <li><strong>E-Mail:</strong> <a href="mailto:${booking.email}">${booking.email}</a></li>
                            <li><strong>Telefon:</strong> <a href="tel:${booking.phone}">${booking.phone}</a></li>
                        </ul>
                        
                        ${booking.notes ? `<p><strong>Anmerkungen vom Kunden:</strong><br>${booking.notes}</p>` : ''}
                    </div>
                `
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: WIRTSHAUS_EMAIL
                    }
                }
            ]
        },
        saveToSentItems: false
    };

    await client
        .api(`/users/${WIRTSHAUS_EMAIL}/sendMail`)
        .post(email);
}

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

