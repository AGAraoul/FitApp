document.addEventListener('DOMContentLoaded', () => {
    // --- HIER DEINE FIREBASE KONFIGURATION EINFÜGEN ---
    const firebaseConfig = {
  apiKey: "AIzaSyBb0nvgFpiWaOyiiQtU6wFTd5cA4o4NBSk",
  authDomain: "befit-personaltrainer.firebaseapp.com",
  projectId: "befit-personaltrainer",
  storageBucket: "befit-personaltrainer.firebasestorage.app",
  messagingSenderId: "1075828940079",
  appId: "1:1075828940079:web:afb36b6e45217482aa55da",
  measurementId: "G-B5SS4JMZEH"
};

    // Firebase initialisieren
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- DOM-Elemente ---
    const pages = {
        authLoading: document.getElementById('authLoadingPage'),
        registration: document.getElementById('registrationPage'),
        login: document.getElementById('loginPage'),
        dashboard: document.getElementById('dashboardPage'),
    };
    const questionContainer = document.getElementById('questionContainer');
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const planResultContainer = document.getElementById('planResult');
    const detailsModal = document.getElementById('detailsModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    // --- Fragen für Registrierung ---
    const questions = [
        { id: 'email', label: 'Deine Email-Adresse', type: 'email', placeholder: 'deine.email@beispiel.com' },
        { id: 'password', label: 'Wähle ein sicheres Passwort', type: 'password', placeholder: '••••••••' },
        { id: 'gender', label: 'Was ist dein Geschlecht?', type: 'select', options: ['Männlich', 'Weiblich', 'Divers'] },
        { id: 'age', label: 'Wie alt bist du?', type: 'number', placeholder: 'z.B. 25' },
        { id: 'height', label: 'Wie groß bist du (in cm)?', type: 'number', placeholder: 'z.B. 180' },
        { id: 'weight', label: 'Was ist dein aktuelles Gewicht (in kg)?', type: 'number', placeholder: 'z.B. 75' },
        { id: 'sport', label: 'Für welche Hauptsportart möchtest du einen Plan?', type: 'text', placeholder: 'z.B. Bodybuilding, Fußball, Kampfsport' },
        { id: 'sportDays', label: 'An welchen Tagen trainierst du deine Hauptsportart bereits?', type: 'multiselect_days' },
        { id: 'fitnessLevel', label: 'Auf welchem Fitnessniveau befindest du dich?', type: 'select', options: ['Anfänger', 'Fortgeschritten', 'Fit', 'Top Fit'] },
        { id: 'frequency', label: 'Wie oft möchtest du ZUSÄTZLICH im Fitnessstudio trainieren?', type: 'select_with_ai', options: ['1-2 mal', '3-4 mal', '5-6 mal'] },
        { id: 'goal', label: 'Was ist dein Hauptziel?', type: 'select', options: ['Abnehmen', 'Zunehmen (Muskelaufbau)', 'Gewicht halten'] }
    ];

    // --- Funktionen ---

    const showPage = (pageName) => {
        Object.values(pages).forEach(page => page.style.display = 'none');
        if (pages[pageName]) pages[pageName].style.display = 'block';
    };

    const renderQuestions = () => {
        questionContainer.innerHTML = '';
        questions.forEach(question => {
            let inputHtml = '';
            const daysOfWeek = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
            
            switch (question.type) {
                case 'select':
                    inputHtml = `<select id="${question.id}" class="input-field" required>${question.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`;
                    break;
                case 'select_with_ai':
                    inputHtml = `<div class="flex flex-col sm:flex-row items-center gap-4"><select id="${question.id}" class="input-field w-full" required>${question.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select><button type="button" class="ai-recommend-btn btn-primary bg-indigo-600 hover:bg-indigo-500 w-full sm:w-auto whitespace-nowrap px-4 py-3">KI-Empfehlung</button></div>`;
                    break;
                case 'multiselect_days':
                    inputHtml = `<div id="${question.id}" class="grid grid-cols-2 sm:grid-cols-4 gap-3">${daysOfWeek.map(day => `<div><input type="checkbox" id="day-${day}" name="sportDays" value="${day}" class="hidden day-checkbox"><label for="day-${day}" class="day-checkbox-label">${day}</label></div>`).join('')}</div>`;
                    break;
                default:
                    inputHtml = `<input type="${question.type}" id="${question.id}" class="input-field" placeholder="${question.placeholder || ''}" required>`;
            }
            
            questionContainer.innerHTML += `<div><label for="${question.id}" class="block mb-2 text-sm font-medium text-gray-300">${question.label}</label>${inputHtml}</div>`;
        });
    };

    const handleRegistration = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {};
        
        questions.forEach(q => {
            if (q.type === 'multiselect_days') {
                const checkedDays = Array.from(document.querySelectorAll(`input[name="sportDays"]:checked`)).map(cb => cb.value);
                userData[q.id] = checkedDays.length > 0 ? checkedDays.join(', ') : 'Keine';
            } else {
                userData[q.id] = document.getElementById(q.id).value;
            }
        });

        const { email, password, ...userProfile } = userData;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            alert('Konto wird erstellt und Plan generiert... Dies kann einen Moment dauern.');

            const idToken = await user.getIdToken(true);

            const response = await fetch('/.netlify/functions/generatePlan', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ userProfile })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Fehler beim Generieren des Plans.');
            }

            const planData = await response.json();
            displayResults(planData);
            showPage('dashboard');

        } catch (error) {
            console.error("Registrierungsfehler:", error);
            alert(`Fehler: ${error.message}`);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // Der onAuthStateChanged Listener übernimmt den Rest
        } catch (error) {
            console.error("Login-Fehler:", error);
            alert(`Fehler: ${error.message}`);
        }
    };

    const handleLogout = async () => {
        try {
            await auth.signOut();
            // Der onAuthStateChanged Listener übernimmt den Rest
        } catch (error) {
            console.error("Logout-Fehler:", error);
            alert(`Fehler: ${error.message}`);
        }
    };

    const displayResults = (data) => {
        document.getElementById('calorieResult').textContent = data.calories || 'N/A';
        planResultContainer.innerHTML = ''; 

        if (data.weeklyPlan && data.weeklyPlan.length === 7) {
            data.weeklyPlan.forEach(dayPlan => {
                const isWorkout = dayPlan.workoutTitle.toLowerCase() !== 'ruhetag';
                const cellClass = isWorkout ? 'workout' : 'rest';
                const dayElement = document.createElement('div');
                dayElement.className = `day-cell ${cellClass}`;
                dayElement.innerHTML = `<div><p class="font-bold text-lg">${dayPlan.day}</p><p class="text-blue-300">${dayPlan.workoutTitle}</p></div>${isWorkout ? '<p class="text-xs text-gray-400 self-end">Details ansehen &rarr;</p>' : ''}`;
                if (isWorkout) {
                    dayElement.dataset.title = `${dayPlan.day}: ${dayPlan.workoutTitle}`;
                    dayElement.dataset.details = dayPlan.workoutDetails;
                }
                planResultContainer.appendChild(dayElement);
            });
        } else {
            planResultContainer.innerHTML = '<p>Kein Plan gefunden. Bitte neu registrieren, falls ein Fehler aufgetreten ist.</p>';
        }
    };

    const openModal = (title, details) => {
        modalTitle.textContent = title;
        modalContent.innerHTML = details;
        detailsModal.classList.add('open');
    };
    const closeModal = () => detailsModal.classList.remove('open');

    // --- Event Listener ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            // User ist eingeloggt
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                displayResults(userData.plan);
                document.getElementById('userEmailDisplay').textContent = user.email;
                showPage('dashboard');
            } else {
                // Sollte nicht passieren, wenn Registrierung klappt
                showPage('registration');
            }
        } else {
            // User ist ausgeloggt
            showPage('registration');
        }
    });

    registrationForm.addEventListener('submit', handleRegistration);
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    showLoginBtn.addEventListener('click', () => showPage('login'));
    showRegisterBtn.addEventListener('click', () => showPage('registration'));

    planResultContainer.addEventListener('click', (e) => {
        const clickedDay = e.target.closest('.day-cell.workout');
        if (clickedDay) openModal(clickedDay.dataset.title, clickedDay.dataset.details);
    });

    questionContainer.addEventListener('click', e => {
        if (e.target.classList.contains('ai-recommend-btn')) {
            const selectElement = e.target.previousElementSibling;
            const aiOptionValue = "KI-Empfehlung";
            if (!selectElement.querySelector(`option[value="${aiOptionValue}"]`)) {
                 const aiOption = new Option('KI-Empfehlung', aiOptionValue, true, true);
                 selectElement.add(aiOption);
            }
            selectElement.value = aiOptionValue;
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) closeModal(); });

    // --- Initialisierung ---
    renderQuestions();
    showPage('authLoading'); // Starte mit Ladeanzeige, bis Auth-Status klar ist
});
