const SERVICE_UUID = "12345678-1234-1234-1234-123456789abc";
const CHARACTERISTIC_UUID = "87654321-4321-4321-4321-cba987654321";

const connectBtn = document.getElementById("connectBtn");
const connectionStatus = document.getElementById("connectionStatus");

const blinkValue = document.getElementById("blinkValue");
const heartValue = document.getElementById("heartValue");
const movementValue = document.getElementById("movementValue");

const fatigueLevel = document.getElementById("fatigueLevel");
const fatigueScore = document.getElementById("fatigueScore");

let notificationSent = false;
let bluetoothDevice = null;

connectBtn.addEventListener("click", connectBLE);

async function connectBLE() {
    try {
        connectionStatus.textContent = "Ricerca dispositivo...";
        connectionStatus.style.color = "#facc15"; // Giallo attesa

        // Modifica chiave: ricerca diretta per nome per evitare problemi di filtro su Windows/PC
        const device = await navigator.bluetooth.requestDevice({
            filters: [{
                name: "FatigueMonitor"
            }],
            optionalServices: [SERVICE_UUID]
        });

        bluetoothDevice = device;
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        connectionStatus.textContent = "Connessione in corso...";

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

        await characteristic.startNotifications();
        characteristic.addEventListener("characteristicvaluechanged", handleIncomingData);

        connectionStatus.textContent = "Arduino connesso";
        connectionStatus.style.color = "#4ade80"; // Verde successo

        await requestNotificationPermission();

    } catch (error) {
        console.error("Errore BLE:", error);
        connectionStatus.textContent = "Connessione fallita";
        connectionStatus.style.color = "#ef4444"; // Rosso errore
    }
}

// Gestione automatica della disconnessione
function onDisconnected() {
    connectionStatus.textContent = "Disconnesso";
    connectionStatus.style.color = "#ef4444";

    blinkValue.textContent = "--";
    heartValue.textContent = "--";
    movementValue.textContent = "--";
    fatigueScore.textContent = "Punteggio: 0";
    
    fatigueLevel.textContent = "BASSO";
    fatigueLevel.className = "level low";
    
    notificationSent = false;
}

function handleIncomingData(event) {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(event.target.value);

    try {
        const data = JSON.parse(jsonString);
        updateDashboard(data);
    } catch (err) {
        console.error("Errore nel parsing del JSON ricevuto:", err, jsonString);
    }
}

function updateDashboard(data) {
    const blink = Number(data.blink) || 0;
    const heart = Number(data.heartRate) || 70;
    const movement = Number(data.movement) || 0;

    blinkValue.textContent = blink;
    heartValue.textContent = heart + " BPM";
    movementValue.textContent = movement + "%";

    calculateFatigue(blink, heart, movement);
}

function calculateFatigue(blink, heart, movement) {
    let score = 0;

    if (blink > 25) score += 40;
    else if (blink > 18) score += 20;

    if (heart > 105) score += 30;
    else if (heart > 90) score += 15;

    if (movement < 20) score += 30;
    else if (movement < 40) score += 15;

    fatigueScore.textContent = "Punteggio: " + score;

    let level = "";
    let cssClass = "";

    if (score < 25) {
        level = "BASSO";
        cssClass = "low";
        notificationSent = false;
    } else if (score < 50) {
        level = "MODERATO";
        cssClass = "medium";
        notificationSent = false;
    } else if (score < 75) {
        level = "ALTO";
        cssClass = "high";

        if (!notificationSent) {
            sendNotification("Livello di affaticamento alto. Consigliata una pausa.");
            notificationSent = true;
        }
    } else {
        level = "CRITICO";
        cssClass = "critical";

        if (!notificationSent) {
            sendNotification("ATTENZIONE: livello di affaticamento critico.");
            notificationSent = true;
        }
    }

    fatigueLevel.textContent = level;
    fatigueLevel.className = "level " + cssClass;
}

async function requestNotificationPermission() {
    if (Notification.permission !== "granted") {
        await Notification.requestPermission();
    }
}

function sendNotification(message) {
    if (Notification.permission === "granted") {
        new Notification("Fatigue Monitor", {
            body: message,
            icon: "icon.png"
        });
    }
}