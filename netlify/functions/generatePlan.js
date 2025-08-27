const fetch = require('node-fetch');
const admin = require('firebase-admin');

// --- FIREBASE ADMIN SDK INITIALISIERUNG ---
const db = () => admin.firestore();

// --- PROMPT-ERSTELLUNG (PERFEKTIONIERT) ---
const createPrompt = (userProfile) => {
    let expertPersona;
    const sportLowerCase = userProfile.sport.toLowerCase();

    if (sportLowerCase.includes('allgemeine fitness')) {
        expertPersona = "einem zertifizierten Personal Trainer, der auf ganzheitliche Fitness, Kraftaufbau und Wohlbefinden spezialisiert ist";
    } else if (sportLowerCase.includes('fußball') || sportLowerCase.includes('soccer')) {
        expertPersona = "einem High-End Athletik- und Fitnesstrainer für Profifußballer";
    } else if (sportLowerCase.includes('bodybuilding')) {
        expertPersona = "einem professionellen Bodybuilding-Coach mit Wettkampferfahrung";
    } else if (sportLowerCase.includes('laufen') || sportLowerCase.includes('running')) {
        expertPersona = "einem erfahrenen Lauftrainer, der Athleten auf Marathons vorbereitet";
    } else if (sportLowerCase.includes('basketball')) {
        expertPersona = "einem auf Sprungkraft und Agilität spezialisierten Basketball-Performance-Coach";
    } else {
        expertPersona = `einem weltklasse Experten für ${userProfile.sport}`;
    }

    const specializationInstruction = userProfile.sport === 'Allgemeine Fitness'
        ? 'Der Plan MUSS auf allgemeine Fitness ausgerichtet sein und eine ausgewogene Mischung aus Krafttraining, Cardio und Flexibilität für den ganzen Körper bieten, um das Hauptziel des Nutzers zu erreichen.'
        : `Der Plan MUSS absolut spezifisch für die Hauptsportart "${userProfile.sport}" sein. Die Übungen sollen die Leistung in dieser Sportart direkt verbessern (z.B. Sprungkraft für Basketball, Rumpfstabilität für Fußball, Maximalkraft für Bodybuilding).`;

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
        - Hauptziel: ${userProfile.goal}
        - Hauptsportart: ${userProfile.sport}
        - Feste Trainingstage für Hauptsportart: ${userProfile.sportDays}
        - Fitnessniveau: ${userProfile.fitnessLevel}
        - Gewünschte zusätzliche Trainingseinheiten: ${userProfile.frequency}

        **ANPASSUNG AN FITNESSLEVEL (SEHR WICHTIG):**
        Analysiere das Fitnesslevel "${userProfile.fitnessLevel}" und passe den Plan wie folgt an:
        - **Anfänger - Niedrige Körperliche Fitness:** Fokussiere dich auf Grundübungen mit einfachen Bewegungsmustern (z.B. Kniebeugen ohne Gewicht, Rudern am Band). Geringes Volumen (2-3 Sätze) und niedrige Intensität. Das Hauptziel ist, die Technik zu erlernen und eine Trainingsroutine aufzubauen.
        - **Fortgeschritten - Durchschnittliche Fitness:** Integriere komplexere Übungen (z.B. Langhantel-Kniebeugen, Klimmzüge mit Unterstützung). Erhöhe das Volumen (3-4 Sätze) und die Intensität moderat. Führe das Prinzip der progressiven Überlastung ein.
        - **Sportlich - Überdurchschnittliche Fitness:** Der Plan sollte anspruchsvoll sein. Nutze fortgeschrittene Techniken wie Supersätze oder Dropsätze. Das Volumen und die Intensität sind hoch. Die Übungsauswahl ist sehr spezifisch auf die Leistungssteigerung im Zielbereich ausgerichtet.
        - **Extrem Sportlich - Herausragende Fitness:** Gehe von einer sehr hohen Belastbarkeit aus. Der Plan muss extrem fordernd sein und kann Techniken wie Periodisierung, hohe Frequenzen und sehr hohe Intensitäten (z.B. Training bis zum Muskelversagen) beinhalten. Die Übungen sind komplex und auf die absolute Leistungsmaximierung ausgelegt.

        **WEITERE KRITISCHE ANWEISUNGEN:**
        1.  **Spezialisierung:** ${specializationInstruction}
        2.  **Persona übernehmen:** Formuliere die Titel und Details so, wie es ${expertPersona} tun würde – professionell, motivierend und fachkundig.
        3.  **Integration fester Termine:** Die Tage unter "Feste Trainingstage" sind FIX. Plane die zusätzlichen Workouts und Ruhetage intelligent UM diese Termine herum, um Übertraining zu vermeiden und die Regeneration zu maximieren.
        4.  **KI-Frequenz:** Wenn "Gewünschte zusätzliche Trainingseinheiten" "KI-Empfehlung" ist, bestimme DU die optimale Anzahl basierend auf allen anderen Daten.
        5.  **HTML-Formatierung:** Achte auf sauberes und lesbares HTML in den \`workoutDetails\`.

        Gib NUR das JSON-Objekt zurück, ohne jeglichen zusätzlichen Text oder Markdown-Formatierung.
    `;
};


// --- NETLIFY FUNCTION HANDLER ---
exports.handler = async (event, context) => {
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
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(firebaseServiceAccountKey);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }

        const idToken = event.headers.authorization?.split('Bearer ')[1];
        if (!idToken) throw new Error('Kein Token bereitgestellt.');
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userDocRef = db().collection('users').doc(uid);

        const doc = await userDocRef.get();
        if (!doc.exists || !doc.data().profile) {
            throw new Error("Benutzerprofil nicht in der Datenbank gefunden.");
        }
        const userProfile = doc.data().profile;

        const prompt = createPrompt(userProfile);
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

        await userDocRef.update({
            plan: planData
        });

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
