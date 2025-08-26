// Wichtig: Du musst 'node-fetch' installieren, damit dies funktioniert.
// Führe im Terminal deines Projekts 'npm install node-fetch' aus.
const fetch = require('node-fetch');

// Die Handler-Funktion ist der Einstiegspunkt für die Netlify Function.
exports.handler = async (event, context) => {
    // Erlaube nur POST-Anfragen
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        // Hole die Benutzerdaten aus dem Request-Body
        const { userProfile } = JSON.parse(event.body);
        
        // Hole den API-Key sicher aus den Netlify Environment Variables
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('API-Key ist nicht konfiguriert.');
        }

        // Erstelle den Prompt hier auf dem Server, basierend auf den empfangenen Daten
        const prompt = `
            Erstelle einen detaillierten, personalisierten Trainingsplan und berechne den täglichen Kalorienbedarf.
            Die Ausgabe MUSS ein valides JSON-Objekt sein, das genau dieser Struktur folgt: {"calories": "ca. XXXX kcal", "weeklyPlan": [...]}.
            "weeklyPlan" MUSS ein Array mit genau 7 Objekten sein, eines für jeden Tag von Montag bis Sonntag.
            Jedes Tagesobjekt MUSS diese Struktur haben: {"day": "TAG_NAME", "workoutTitle": "TITEL", "workoutDetails": "HTML_DETAILS"}.
            - "workoutTitle": Kurzer Titel (z.B. "Krafttraining: Oberkörper", "Fußballtraining", "Aktive Erholung", "Ruhetag").
            - "workoutDetails": Gut formatierter HTML-String mit den Details.

            **Benutzerdaten:**
            - Geschlecht: ${userProfile.gender}
            - Alter: ${userProfile.age} Jahre
            - Größe: ${userProfile.height} cm
            - Gewicht: ${userProfile.weight} kg
            - Ziel: ${userProfile.goal}
            - Hauptsportart: ${userProfile.sport}
            - Bestehende Trainingstage (Hauptsportart): ${userProfile.sportDays}
            - Fitnessniveau: ${userProfile.fitnessLevel}
            - Gewünschte zusätzliche Trainingseinheiten im Fitnessstudio: ${userProfile.frequency}

            **KRITISCHE ANWEISUNGEN FÜR DIE PLANUNG:**
            1.  **Feste Termine:** Die Tage unter "Bestehende Trainingstage" sind FIXE Termine für die Hauptsportart. Trage diese exakt an den angegebenen Tagen in den Plan ein (z.B. bei "Dienstag, Donnerstag" -> "workoutTitle": "${userProfile.sport} Training" an diesen Tagen).
            2.  **KI-Häufigkeit:** Wenn bei "Gewünschte zusätzliche Trainingseinheiten" der Wert "KI-Empfehlung" steht, bestimme DU die optimale Anzahl an zusätzlichen Trainingstagen (1 bis 4), basierend auf allen anderen Daten. Ansonsten nutze die vom Benutzer gewählte Anzahl.
            3.  **Intelligente Platzierung:** Plane die zusätzlichen Fitnessstudio-Workouts und die notwendigen Ruhetage intelligent UM die festen Termine herum. Vermeide es, schwere Krafteinheiten direkt vor oder nach intensiven Trainingstagen der Hauptsportart zu legen.
            4.  **Anpassung an Niveau:** Passe die Komplexität und das Volumen der Übungen im "workoutDetails" an das angegebene Fitnessniveau an.
            5.  **Kalorien:** Passe den Kalorienbedarf an das Ziel an.

            Gib NUR das JSON-Objekt zurück, ohne zusätzlichen Text, Erklärungen oder Markdown-Formatierung.
        `;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        };

        // Rufe die externe Gemini-API auf
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error('Google API Error:', errorBody);
            throw new Error(`Fehler bei der Kommunikation mit der KI: ${apiResponse.statusText}`);
        }

        const result = await apiResponse.json();
        const rawJson = result.candidates[0].content.parts[0].text;
        const parsedData = JSON.parse(rawJson);

        // Sende das Ergebnis zurück an das Frontend
        return {
            statusCode: 200,
            body: JSON.stringify(parsedData)
        };

    } catch (error) {
        console.error('Fehler in der Netlify Function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Ein interner Serverfehler ist aufgetreten.' })
        };
    }
};
