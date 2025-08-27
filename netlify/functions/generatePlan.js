const fetch = require('node-fetch');
const admin = require('firebase-admin');

const db = () => admin.firestore();

// --- PROMPT-ERSTELLUNG (ANGEPASST FÜR DYNAMISCHE TAGE) ---
const createPrompt = (userProfile, weekNumber, totalWeeks, startDayName, numberOfDays) => {
    let expertPersona;
    const sportLowerCase = userProfile.sport.toLowerCase();

    if (sportLowerCase.includes('allgemeine fitness')) {
        expertPersona = "einem zertifizierten Personal Trainer, der auf ganzheitliche Fitness, Kraftaufbau und Wohlbefinden spezialisiert ist";
    } else if (sportLowerCase.includes('fußball') || sportLowerCase.includes('soccer')) {
        expertPersona = "einem High-End Athletik- und Fitnesstrainer für Profifußballer";
    } else if (sportLowerCase.includes('bodybuilding')) {
        expertPersona = "einem professionellen Bodybuilding-Coach mit Wettkampferfahrung";
    } else {
        expertPersona = `einem weltklasse Experten für ${userProfile.sport}`;
    }

    const specializationInstruction = userProfile.sport === 'Allgemeine Fitness'
        ? 'Der Plan MUSS auf allgemeine Fitness ausgerichtet sein und eine ausgewogene Mischung aus Krafttraining, Cardio und Flexibilität für den ganzen Körper bieten, um das Hauptziel des Nutzers zu erreichen.'
        : `Der Plan MUSS absolut spezifisch für die Hauptsportart "${userProfile.sport}" sein. Die Übungen sollen die Leistung in dieser Sportart direkt verbessern.`;

    let progressionInstruction = '';
    if (totalWeeks > 1) {
        progressionInstruction = `
        **PROGRESSION:** Dies ist Woche ${weekNumber} von insgesamt ${totalWeeks} Wochen. Gestalte den Plan so, dass er eine logische Steigerung zur Vorwoche darstellt (z.B. durch mehr Gewicht, mehr Wiederholungen, komplexere Übungen oder weniger Pausenzeit), um das Prinzip der progressiven Überlastung zu gewährleisten.
        `;
    }

    return `
        **DEINE ROLLE:** Du bist ${expertPersona}. Deine Aufgabe ist es, einen hochgradig personalisierten, effektiven und sicheren Trainingsplan zu erstellen.

        **AUFGABE:** Erstelle einen detaillierten, ${numberOfDays}-tägigen Trainingsplan für diesen spezifischen Zeitraum.
        ${progressionInstruction}

        **AUSGABEFORMAT (KRITISCH):**
        Die Ausgabe MUSS ein valides JSON-Objekt sein, das exakt dieser Struktur folgt: {"weeklyPlan": [...]}.
        - "weeklyPlan" MUSS ein Array mit genau ${numberOfDays} Objekten sein.
        - **Der ${numberOfDays}-Tage-Zyklus MUSS mit einem ${startDayName} beginnen und die Tage entsprechend korrekt benennen.**
        - Jedes Tagesobjekt MUSS die Struktur haben: {"day": "TAG_NAME", "workoutTitle": "TITEL", "workoutDetails": "HTML_DETAILS"}.
        - Die "workoutDetails" MÜSSEN als formatierter HTML-String (z.B. mit <ul>, <li>, <strong>) bereitgestellt werden.

        **NUTZERDATEN ZUR ANALYSE:**
        - Geschlecht: ${userProfile.gender}, Alter: ${userProfile.age} Jahre
        - Größe: ${userProfile.height} cm, Gewicht: ${userProfile.weight} kg
        - Hauptsportart: ${userProfile.sport}
        - Feste Trainingstage für Hauptsportart: ${userProfile.sportDays}
        - Fitnessniveau: ${userProfile.fitnessLevel}
        - Gewünschte Trainingseinheiten pro Woche: ${userProfile.frequency}

        **ANPASSUNG AN FITNESSLEVEL (SEHR WICHTIG):**
        Analysiere das Fitnesslevel "${userProfile.fitnessLevel}" und passe den Plan wie folgt an:
        - **Anfänger:** Grundübungen, einfache Bewegungsmuster, Fokus auf Technik. Geringes Volumen (2-3 Sätze).
        - **Fortgeschritten:** Komplexere Übungen, moderate Steigerung von Volumen (3-4 Sätze) und Intensität.
        - **Sportlich:** Anspruchsvolle Übungen, fortgeschrittene Techniken (z.B. Supersätze). Hohes Volumen und hohe Intensität.
        - **Extrem Sportlich:** Extrem fordernder Plan mit Periodisierung, hohen Frequenzen und sehr hoher Intensität.

        **WEITERE KRITISCHE ANWEISUNGEN:**
        1.  **Spezialisierung:** ${specializationInstruction}
        2.  **Integration fester Termine:** Die Tage unter "Feste Trainingstage" sind FIX. Plane die zusätzlichen Workouts intelligent UM diese Termine herum.
        3.  **KI-Frequenz:** Wenn "Gewünschte Trainingseinheiten" "KI-Empfehlung" ist, bestimme DU die optimale Anzahl.

        Gib NUR das JSON-Objekt zurück, ohne zusätzlichen Text.
    `;
};

// --- NETLIFY FUNCTION HANDLER (KORRIGIERT) ---
exports.handler = async (event, context) => {
    const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!firebaseServiceAccountKey || !geminiApiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "Server-Konfigurationsfehler: API-Schlüssel fehlen." }) };
    }

    try {
        if (!admin.apps.length) {
            const serviceAccount = JSON.parse(firebaseServiceAccountKey);
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
        if (!doc.exists) throw new Error("Benutzerprofil nicht gefunden.");
        
        const userData = doc.data();
        const userProfile = userData.profile;
        const planInfo = userData.plan;

        if (!planInfo || !planInfo.startDate || !planInfo.endDate) {
             throw new Error("Plandaten (Start/Ende) nicht im Nutzerprofil gefunden.");
        }

        const startDate = new Date(planInfo.startDate);
        const endDate = new Date(planInfo.endDate);
        
        const allWeeklyPlans = {};
        const weekSegments = [];
        let currentStartDate = new Date(startDate);

        // Den gesamten Zeitraum in logische Wochenabschnitte unterteilen
        while (currentStartDate <= endDate) {
            const weekStartDate = new Date(currentStartDate);
            // getDay(): Sonntag = 0, Montag = 1, ..., Samstag = 6
            const dayOfWeek = weekStartDate.getDay();
            
            let weekEndDate = new Date(weekStartDate);
            
            // Tage bis zum nächsten Sonntag berechnen (Sonntag ist Tag 0)
            const daysUntilSunday = (7 - dayOfWeek) % 7;
            weekEndDate.setDate(weekStartDate.getDate() + daysUntilSunday); 
            
            if (weekEndDate > endDate) {
                weekEndDate = new Date(endDate);
            }

            weekSegments.push({ start: weekStartDate, end: weekEndDate });

            // Das Startdatum für den nächsten Abschnitt auf den Montag nach dem Ende des aktuellen setzen.
            currentStartDate = new Date(weekEndDate);
            currentStartDate.setDate(currentStartDate.getDate() + 1);
        }

        const totalWeeks = weekSegments.length;
        const daysOfWeek = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

        for (let i = 0; i < totalWeeks; i++) {
            const segment = weekSegments[i];
            const weekStartDate = segment.start;
            
            const startDayIndex = weekStartDate.getDay();
            const startDayName = daysOfWeek[startDayIndex];
            
            // Anzahl der Tage in diesem spezifischen Wochenabschnitt berechnen
            const numberOfDays = Math.round((segment.end.getTime() - segment.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            if (numberOfDays <= 0) continue;

            const prompt = createPrompt(userProfile, i + 1, totalWeeks, startDayName, numberOfDays);
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
                console.error(`API Fehler in Woche ${i+1}:`, errorBody);
                continue; 
            }

            const result = await apiResponse.json();
            if (result.candidates && result.candidates[0] && result.candidates[0].content) {
                const rawJson = result.candidates[0].content.parts[0].text;
                const planData = JSON.parse(rawJson);
                // Als Schlüssel das Startdatum des Segments verwenden
                allWeeklyPlans[weekStartDate.toISOString().split('T')[0]] = planData;
            }
        }
        
        await userDocRef.update({
            'plan.weeklyPlans': allWeeklyPlans
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Alle Wochenpläne erfolgreich erstellt." })
        };

    } catch (error) {
        console.error('Fehler in der Netlify Function:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Ein interner Serverfehler ist aufgetreten.' })
        };
    }
};
