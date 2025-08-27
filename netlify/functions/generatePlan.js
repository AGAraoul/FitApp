const fetch = require('node-fetch');
const admin = require('firebase-admin');

// --- FIREBASE ADMIN SDK INITIALISIERUNG ---
// Die Initialisierung erfolgt jetzt sicher innerhalb des Handlers.

const db = () => admin.firestore();

// --- PROMPT-ERSTELLUNG (AKTUALISIERT) ---
const createPrompt = (userProfile) => {
    // GEÄNDERT: Die Anforderung zur Kalorienberechnung wurde entfernt.
    return `
        Erstelle einen detaillierten, personalisierten Trainingsplan mit genauer Rücksicht auf die angegebenen Daten des Nutzers.
        Die Ausgabe MUSS ein valides JSON-Objekt sein, das genau dieser Struktur folgt: {"weeklyPlan": [...]}.
        "weeklyPlan" MUSS ein Array mit genau 7 Objekten sein, eines für jeden Tag von Montag bis Sonntag.
        Jedes Tagesobjekt MUSS diese Struktur haben: {"day": "TAG_NAME", "workoutTitle": "TITEL", "workoutDetails": "HTML_DETAILS"}.
        
        **Benutzerdaten:**
        - Geschlecht: ${userProfile.gender}
        - Alter: ${userProfile.age} Jahre
        - Größe: ${userProfile.height} cm
        - Gewicht: ${userProfile.weight} kg
        - Ziel: ${userProfile.goal}
        - Hauptsportart: ${userProfile.sport}
        - Bestehende Trainingstage: ${userProfile.sportDays}
        - Fitnessniveau: ${userProfile.fitnessLevel}
        - Gewünschte zusätzliche Trainingseinheiten: ${userProfile.frequency}

        **KRITISCHE ANWEISUNGEN:**
        1.  **Feste Termine:** Die Tage unter "Bestehende Trainingstage" sind FIXE Termine. Trage diese exakt an den angegebenen Tagen in den Plan ein.
        2.  **KI-Häufigkeit:** Wenn "Gewünschte zusätzliche Trainingseinheiten" "KI-Empfehlung" ist, bestimme DU die optimale Anzahl.
        3.  **Intelligente Platzierung:** Plane die zusätzlichen Workouts und Ruhetage intelligent UM die festen Termine herum.
        4.  **Anpassung an Niveau:** Passe die Komplexität der Übungen an das Fitnessniveau an.

        Gib NUR das JSON-Objekt zurück, ohne zusätzlichen Text oder Markdown.
    `;
};

// --- NETLIFY FUNCTION HANDLER (VERBESSERT) ---
exports.handler = async (event, context) => {
    // **NEU: Verbesserte Fehlerbehandlung für Umgebungsvariablen**
    // Prüft direkt am Anfang, ob alle notwendigen Schlüssel vorhanden sind.
    const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!firebaseServiceAccountKey || !geminiApiKey) {
        const errorMessage = "Server-Konfigurationsfehler: Notwendige API-Schlüssel (Firebase oder Gemini) sind nicht in den Umgebungsvariablen von Netlify gesetzt.";
        console.error(errorMessage);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: errorMessage })
        };
    }

    try {
        // **NEU: Sichere Initialisierung von Firebase Admin**
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(firebaseServiceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }

        // 1. Nutzer authentifizieren
        const idToken = event.headers.authorization?.split('Bearer ')[1];
        if (!idToken) throw new Error('Kein Token bereitgestellt.');
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userDocRef = db().collection('users').doc(uid);

        // 2. Nutzerprofil aus Firestore lesen
        const doc = await userDocRef.get();
        if (!doc.exists || !doc.data().profile) {
            throw new Error("Benutzerprofil nicht in der Datenbank gefunden.");
        }
        const userProfile = doc.data().profile;

        // 3. Plan mit Gemini API generieren
        const prompt = createPrompt(userProfile);
        // KORREKTUR: Der Tippfehler in der Variable wurde behoben (geminiApikey -> geminiApiKey).
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        };
        
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Gemini API Fehler:", errorBody);
            throw new Error(`Fehler bei der Kommunikation mit der KI: ${errorBody}`);
        }

        const result = await apiResponse.json();

        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
            console.error("Ungültige API-Antwort von Gemini:", JSON.stringify(result));
            throw new Error("Die KI hat keine gültigen Daten zurückgegeben. Dies liegt oft an den Sicherheitseinstellungen der API.");
        }

        const rawJson = result.candidates[0].content.parts[0].text;
        const planData = JSON.parse(rawJson);

        // 4. Generierten Plan in das Dokument des Nutzers schreiben
        await userDocRef.update({
            plan: planData
        });

        // 5. Erfolgsmeldung zurücksenden
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Plan erfolgreich erstellt und gespeichert." })
        };

    } catch (error) {
        console.error('Fehler in der Netlify Function:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Ein interner Serverfehler ist aufgetreten.' })
        };
    }
};
