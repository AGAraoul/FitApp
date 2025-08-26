const fetch = require('node-fetch');
// Firebase Admin SDK für die sichere Server-Kommunikation
const admin = require('firebase-admin');

// --- FIREBASE ADMIN SDK INITIALISIERUNG ---
// Hole die Service-Account-Daten aus der Netlify Environment Variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialisiere die Admin-App, falls noch nicht geschehen
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// --- PROMPT-ERSTELLUNG (ausgelagert für Sauberkeit) ---
const createPrompt = (userProfile) => {
    return `
        Erstelle einen detaillierten, personalisierten Trainingsplan und berechne den täglichen Kalorienbedarf.
        Die Ausgabe MUSS ein valides JSON-Objekt sein, das genau dieser Struktur folgt: {"calories": "ca. XXXX kcal", "weeklyPlan": [...]}.
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

// --- NETLIFY FUNCTION HANDLER ---
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        // 1. Authentifizierung prüfen
        const idToken = event.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Kein Token bereitgestellt.' }) };
        }
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Daten aus dem Request holen
        const { userProfile } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY ist nicht konfiguriert.');

        // 3. Plan mit Gemini API generieren
        const prompt = createPrompt(userProfile);
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
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
            throw new Error(`Fehler bei der Kommunikation mit der KI: ${errorBody}`);
        }

        const result = await apiResponse.json();
        const rawJson = result.candidates[0].content.parts[0].text;
        const planData = JSON.parse(rawJson);

        // 4. Generierten Plan in Firestore speichern
        const userDocRef = db.collection('users').doc(uid);
        await userDocRef.set({
            profile: userProfile,
            plan: planData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 5. Plan an das Frontend zurücksenden
        return {
            statusCode: 200,
            body: JSON.stringify(planData)
        };

    } catch (error) {
        console.error('Fehler in der Netlify Function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Ein interner Serverfehler ist aufgetreten.' })
        };
    }
};
