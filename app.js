// ===== Configuration =====
const CONFIG = {
    // Azure Function URL - hier nach dem Deployment die URL eintragen
    API_URL: 'https://metzenhof-booking.azurewebsites.net/api',
    
    // Tische mit Kapazität (werden automatisch zugewiesen)
    tables: [
        { id: 'R1', capacity: 6 },
        { id: 'R3', capacity: 6 },
        { id: 'R5', capacity: 6 },
        { id: 'R6', capacity: 6 },
        { id: 'R7', capacity: 6 },
        { id: 'R8', capacity: 6 },
        { id: 'R9', capacity: 10 },
        { id: 'R10', capacity: 10 },
        { id: 'R11', capacity: 6 }
    ],
    
    // Öffnungszeiten
    openingHours: {
        0: { open: '11:00', close: '16:00' }, // Sonntag
        4: { open: '11:00', close: '20:00' }, // Donnerstag
        5: { open: '11:00', close: '20:00' }, // Freitag
        6: { open: '11:00', close: '20:00' }  // Samstag
    },
    
    // Reservierungsdauer in Stunden
    reservationDuration: 3,
    
    // Buchungsintervall in Minuten
    bookingInterval: 30
};

// ===== State =====
let bookingData = {};

// ===== DOM Elements =====
const form = document.getElementById('bookingForm');
const dateInput = document.getElementById('date');
const timeSelect = document.getElementById('time');
const guestsSelect = document.getElementById('guests');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', function() {
    initializeDatePicker();
    initializeFormNavigation();
    initializeFormSubmission();
});

// ===== Date Picker =====
function initializeDatePicker() {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);
    
    dateInput.min = formatDateForInput(today);
    dateInput.max = formatDateForInput(maxDate);
    
    dateInput.addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const dayOfWeek = selectedDate.getDay();
        
        if (!CONFIG.openingHours[dayOfWeek]) {
            showError('An diesem Tag haben wir leider geschlossen. Bitte wählen Sie Donnerstag bis Sonntag.');
            this.value = '';
            timeSelect.innerHTML = '<option value="">Bitte zuerst Datum wählen</option>';
            timeSelect.disabled = true;
            return;
        }
        
        generateTimeSlots(dayOfWeek);
        timeSelect.disabled = false;
    });
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function generateTimeSlots(dayOfWeek) {
    const hours = CONFIG.openingHours[dayOfWeek];
    if (!hours) return;
    
    const [openHour, openMin] = hours.open.split(':').map(Number);
    const [closeHour] = hours.close.split(':').map(Number);
    
    const lastBookingHour = closeHour - CONFIG.reservationDuration;
    
    timeSelect.innerHTML = '<option value="">Bitte wählen</option>';
    
    let currentHour = openHour;
    let currentMin = openMin;
    
    while (currentHour < lastBookingHour || (currentHour === lastBookingHour && currentMin === 0)) {
        const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = timeString;
        option.textContent = `${timeString} Uhr`;
        timeSelect.appendChild(option);
        
        currentMin += CONFIG.bookingInterval;
        if (currentMin >= 60) {
            currentMin = 0;
            currentHour++;
        }
    }
}

// ===== Automatische Tischauswahl =====
function selectBestTable(guests, bookedTables = []) {
    // Passende Tische finden (Kapazität >= Gästeanzahl)
    const suitableTables = CONFIG.tables
        .filter(table => table.capacity >= guests && !bookedTables.includes(table.id))
        .sort((a, b) => a.capacity - b.capacity); // Kleinster passender Tisch zuerst
    
    if (suitableTables.length === 0) {
        return null;
    }
    
    return suitableTables[0].id;
}

async function checkAvailabilityAndSelectTable() {
    const date = dateInput.value;
    const time = timeSelect.value;
    const guests = parseInt(guestsSelect.value);
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/check-availability?date=${date}&time=${time}`);
        
        if (response.ok) {
            const data = await response.json();
            return selectBestTable(guests, data.bookedTables || []);
        }
    } catch (error) {
        console.warn('API nicht verfügbar, wähle Tisch ohne Verfügbarkeitsprüfung');
    }
    
    // Fallback: Tisch ohne Verfügbarkeitsprüfung wählen
    return selectBestTable(guests, []);
}

// ===== Form Navigation =====
function initializeFormNavigation() {
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', function() {
            const nextStep = parseInt(this.dataset.next);
            
            // Validierung vor Schritt 2
            if (nextStep === 2) {
                if (!dateInput.value || !timeSelect.value || !guestsSelect.value) {
                    showError('Bitte füllen Sie alle Pflichtfelder aus.');
                    return;
                }
            }
            
            // Validierung vor Schritt 3
            if (nextStep === 3) {
                const firstName = document.getElementById('firstName').value;
                const lastName = document.getElementById('lastName').value;
                const email = document.getElementById('email').value;
                const phone = document.getElementById('phone').value;
                
                if (!firstName || !lastName || !email || !phone) {
                    showError('Bitte füllen Sie alle Pflichtfelder aus.');
                    return;
                }
                
                if (!isValidEmail(email)) {
                    showError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
                    return;
                }
                
                updateSummary();
            }
            
            goToStep(nextStep);
        });
    });
    
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', function() {
            const backStep = parseInt(this.dataset.back);
            goToStep(backStep);
        });
    });
}

function goToStep(step) {
    document.querySelectorAll('.form-step').forEach(s => {
        s.classList.remove('active');
    });
    
    const targetStep = document.querySelector(`[data-step="${step}"]`);
    if (targetStep) {
        targetStep.classList.add('active');
        window.scrollTo({ top: targetStep.offsetTop - 100, behavior: 'smooth' });
    }
}

function updateSummary() {
    const date = new Date(dateInput.value);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    
    document.getElementById('summaryDate').textContent = date.toLocaleDateString('de-AT', options);
    document.getElementById('summaryTime').textContent = timeSelect.value + ' Uhr';
    document.getElementById('summaryGuests').textContent = guestsSelect.value + ' Person(en)';
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    document.getElementById('summaryName').textContent = firstName + ' ' + lastName;
    document.getElementById('summaryEmail').textContent = document.getElementById('email').value;
    document.getElementById('summaryPhone').textContent = document.getElementById('phone').value;
    
    const notes = document.getElementById('notes').value;
    if (notes) {
        document.getElementById('summaryNotesRow').style.display = 'flex';
        document.getElementById('summaryNotes').textContent = notes;
    } else {
        document.getElementById('summaryNotesRow').style.display = 'none';
    }
}

// ===== Form Submission =====
function initializeFormSubmission() {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!document.getElementById('privacy').checked) {
            showError('Bitte akzeptieren Sie die Datenschutzerklärung.');
            return;
        }
        
        showLoading(true);
        
        // Automatische Tischauswahl
        const selectedTable = await checkAvailabilityAndSelectTable();
        
        if (!selectedTable) {
            showLoading(false);
            showError('Leider ist zu diesem Zeitpunkt kein passender Tisch verfügbar. Bitte wählen Sie eine andere Uhrzeit.');
            return;
        }
        
        // Buchungsdaten sammeln
        bookingData = {
            date: dateInput.value,
            time: timeSelect.value,
            guests: parseInt(guestsSelect.value),
            table: selectedTable,
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            notes: document.getElementById('notes').value
        };
        
        try {
            const response = await fetch(`${CONFIG.API_URL}/create-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            });
            
            if (!response.ok) {
                throw new Error('Buchung konnte nicht erstellt werden');
            }
            
            const result = await response.json();
            
            const params = new URLSearchParams({
                code: result.confirmationCode || generateConfirmationCode(),
                date: bookingData.date,
                time: bookingData.time,
                guests: bookingData.guests,
                name: bookingData.firstName + ' ' + bookingData.lastName,
                email: bookingData.email
            });
            
            window.location.href = `confirmation.html?${params.toString()}`;
            
        } catch (error) {
            console.error('Buchungsfehler:', error);
            
            // Demo-Modus
            const confirmationCode = generateConfirmationCode();
            const params = new URLSearchParams({
                code: confirmationCode,
                date: bookingData.date,
                time: bookingData.time,
                guests: bookingData.guests,
                name: bookingData.firstName + ' ' + bookingData.lastName,
                email: bookingData.email,
                demo: 'true'
            });
            
            window.location.href = `confirmation.html?${params.toString()}`;
        }
    });
}

function generateConfirmationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'MH-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ===== Utility Functions =====
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.add('active');
}

function closeErrorModal() {
    errorModal.classList.remove('active');
}

window.closeErrorModal = closeErrorModal;


