const fetch = require('node-fetch');
const admin = require('firebase-admin');

// --- FIREBASE ADMIN SDK INITIALISIERUNG ---
// Die Initialisierung erfolgt jetzt sicher innerhalb des Handlers.

const db = () => admin.firestore();

// --- PROMPT-ERSTELLUNG (ÜBERARBEITET) ---
const createPrompt = (userProfile) => {
    // NEU: Dynamische Bestimmung der Experten-Persona basierend auf der Sportart
    let expertPersona = `einem weltklasse Experten für ${userProfile.sport}`;
    const sportLowerCase = userProfile.sport.toLowerCase();

    if (sportLowerCase.includes('fußball') || sportLowerCase.includes('soccer')) {
        expertPersona = "einem High-End Athletik- und Fitnesstrainer für Profifußballer";
    } else if (sportLowerCase.includes('bodybuilding')) {
        expertPersona = "einem professionellen Bodybuilding-Coach mit Wettkampferfahrung";
    } else if (sportLowerCase.includes('laufen') || sportLowerCase.includes('running')) {
        expertPersona = "einem erfahrenen Lauftrainer, der Athleten auf Marathons vorbereitet";
    } else if (sportLowerCase.includes('basketball')) {
        expertPersona = "einem auf Sprungkraft und Agilität spezialisierten Basketball-Performance-Coach";
    }

    return `
        **DEINE ROLLE:** Du bist ein weltklasse Personal Trainer und agierst als ${expertPersona}. Deine Aufgabe ist es, einen hochgradig personalisierten, effektiven und sicheren Trainingsplan zu erstellen, der exakt auf die Bedürfnisse des Nutzers zugeschnitten ist.

        **AUFGABE:** Erstelle einen detaillierten, 7-tägigen Trainingsplan. Berücksichtige dabei JEDES Detail aus den Nutzerdaten, um den Plan optimal anzupassen.

        **AUSGABEFORMAT (KRITISCH):**
        Die Ausgabe MUSS ein valides JSON-Objekt sein, das exakt dieser Struktur folgt: {"weeklyPlan": [...]}.
        - "weeklyPlan" MUSS ein Array mit genau 7 Objekten sein (Montag bis Sonntag).
        - Jedes Tagesobjekt MUSS die Struktur haben: {"day": "TAG_NAME", "workoutTitle": "TITEL", "workoutDetails": "HTML_DETAILS"}.
        - Die "workoutDetails" MÜSSEN als formatierter HTML-String (z.B. mit <ul>, <li>, <strong>) bereitgestellt werden und detaillierte Übungsanweisungen, Satz- und Wiederholungszahlen enthalten.

        **NUTZERDATEN ZUR ANALYSE:**
        - Geschlecht: ${userProfile.gender}
        - Alter: ${userProfile.age} Jahre
        - Größe: ${userProfile.height} cm
        - Gewicht: ${userProfile.weight} kg
        - Hauptziel: ${userProfile.goal} (z.B. Abnehmen, Muskelaufbau)
        - Hauptsportart: ${userProfile.sport}
        - Feste Trainingstage für Hauptsportart: ${userProfile.sportDays}
        - Fitnessniveau: ${userProfile.fitnessLevel}
        - Gewünschte zusätzliche Trainingseinheiten: ${userProfile.frequency}

        **KRITISCHE ANWEISUNGEN FÜR DEN PLAN:**
        1.  **Spezialisierung:** Der Plan MUSS absolut spezifisch für die Hauptsportart "${userProfile.sport}" sein. Die Übungen sollen die Leistung in dieser Sportart direkt verbessern (z.B. Sprungkraft für Basketball, Rumpfstabilität für Fußball, Maximalkraft für Bodybuilding).
        2.  **Persona übernehmen:** Formuliere die Titel und Details so, wie es ${expertPersona} tun würde – professionell, motivierend und fachkundig.
        3.  **Integration fester Termine:** Die Tage unter "Feste Trainingstage" sind FIX. Plane die zusätzlichen Workouts und Ruhetage intelligent UM diese Termine herum, um Übertraining zu vermeiden und die Regeneration zu maximieren.
        4.  **Anpassung an Niveau & Ziel:** Passe die Komplexität der Übungen, das Volumen und die Intensität exakt an das Fitnessniveau "${userProfile.fitnessLevel}" und das Hauptziel "${userProfile.goal}" an.
        5.  **KI-Frequenz:** Wenn "Gewünschte zusätzliche Trainingseinheiten" "KI-Empfehlung" ist, bestimme DU die optimale Anzahl basierend auf allen anderen Daten.
        6.  **HTML-Formatierung:** Achte auf sauberes und lesbares HTML in den \`workoutDetails\`.

        Gib NUR das JSON-Objekt zurück, ohne jeglichen zusätzlichen Text oder Markdown-Formatierung.
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
        // KORREKTUR: Der Modellname wurde von 'gemini-flash-1.5' zu 'gemini-1.5-flash' korrigiert.
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
