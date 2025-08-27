document.addEventListener('DOMContentLoaded', () => {
    // --- HIER DEINE FIREBASE KONFIGURATION EINFÜGEN ---
    const firebaseConfig = {
        apiKey: "AIzaSyBb0nvgFpiWaOyiiQtU6wFTd5cA4o4NBSk",
        authDomain: "befit-personaltrainer.firebaseapp.com",
        projectId: "befit-personaltrainer",
        storageBucket: "befit-personaltrainer.appspot.com",
        messagingSenderId: "1075828940079",
        appId: "1:1075828940079:web:afb36b6e45217482aa55da",
        measurementId: "G-B5SS4JMZEH"
    };


    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- DOM-Elemente ---
    const pages = {
        authLoading: document.getElementById('authLoadingPage'),
        registration: document.getElementById('registrationPage'),
        login: document.getElementById('loginPage'),
        planCreationLoading: document.getElementById('planCreationLoadingPage'),
        dashboard: document.getElementById('dashboardPage'),
        updatePlan: document.getElementById('updatePlanPage'),
    };
    const registrationStartView = document.getElementById('registrationStartView');
    const registrationFormWrapper = document.getElementById('registrationFormWrapper');
    const startRegistrationProcessBtn = document.getElementById('startRegistrationProcessBtn');
    const registrationForm = document.getElementById('registrationForm');
    const formStepsContainer = document.getElementById('form-steps');
    const progressBar = document.getElementById('progressBar');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const loginForm = document.getElementById('loginForm');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const newPlanBtn = document.getElementById('newPlanBtn');
    const planResultContainer = document.getElementById('planResult');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const updateFormStepsContainer = document.getElementById('update-form-steps');
    const updateProgressBar = document.getElementById('updateProgressBar');
    const updateNextBtn = document.getElementById('updateNextBtn');
    const updatePrevBtn = document.getElementById('updatePrevBtn');
    const cancelUpdateBtn = document.getElementById('cancelUpdateBtn');
    const detailsModal = document.getElementById('detailsModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // --- Anwendungsstatus ---
    let planListener = null;
    let currentRegStep = 0;
    let currentUpdateStep = 0;
    const regUserData = {};
    const updateUserData = {};

    // --- Fragen in Schritten gruppiert (ÜBERARBEITET) ---
    const registrationSteps = [
        {
            title: "Erstelle dein Konto",
            questions: [
                { id: 'email', label: 'Deine Email-Adresse', type: 'email', placeholder: 'deine.email@beispiel.com' },
                { id: 'password', label: 'Wähle ein sicheres Passwort', type: 'password', placeholder: '••••••••' },
                { id: 'passwordConfirm', label: 'Bestätige dein Passwort', type: 'password', placeholder: '••••••••' },
            ]
        },
        {
            title: "Erzähl uns etwas über dich",
            questions: [
                { id: 'username', label: 'Dein Benutzername', type: 'text', placeholder: 'z.B. Max Power' },
                { id: 'gender', label: 'Was ist dein Geschlecht?', type: 'select', options: ['Männlich', 'Weiblich', 'Divers'] },
                { id: 'age', label: 'Wie alt bist du?', type: 'number', placeholder: 'z.B. 25' },
            ]
        },
        {
            title: "Deine körperlichen Daten",
            questions: [
                { id: 'height', label: 'Wie groß bist du (in cm)?', type: 'number', placeholder: 'z.B. 180' },
                { id: 'weight', label: 'Was ist dein aktuelles Gewicht (in kg)?', type: 'number', placeholder: 'z.B. 75' },
            ]
        },
        {
            title: "Deine sportlichen Ziele",
            questions: [
                // NEU: Checkbox für allgemeine Fitness
                { id: 'noSpecificSport', label: 'Ich möchte an meiner allgemeinen Fitness arbeiten (kein sportartspezifischer Plan).', type: 'checkbox' },
                { id: 'sport', label: 'Für welche Hauptsportart möchtest du einen Plan?', type: 'text', placeholder: 'z.B. Bodybuilding, Fußball' },
                { id: 'sportDays', label: 'An welchen Tagen trainierst du diese Sportart bereits?', type: 'multiselect_days' },
                { id: 'fitnessLevel', label: 'Auf welchem Fitnessniveau befindest du dich?', type: 'select', options: ['Anfänger', 'Fortgeschritten', 'Fit', 'Top Fit'] },
            ]
        },
        {
            title: "Dein Trainingspensum",
            questions: [
                { id: 'frequency', label: 'Wie oft möchtest du ZUSÄTZLICH im Fitnessstudio trainieren?', type: 'select_with_ai', options: ['1-2 mal', '3-4 mal', '5-6 mal'] },
                { id: 'goal', label: 'Was ist dein Hauptziel?', type: 'select', options: ['Abnehmen', 'Zunehmen (Muskelaufbau)', 'Gewicht halten'] }
            ]
        }
    ];

    const updatePlanSteps = registrationSteps.slice(1).map(step => {
        return {
            ...step,
            questions: step.questions.filter(q => q.id !== 'username')
        };
    });

    // --- Allgemeine Multi-Step Formular Funktionen ---
    const buildFormSteps = (steps, container, idPrefix = '') => {
        container.innerHTML = '';
        steps.forEach((step) => {
            const stepElement = document.createElement('div');
            stepElement.classList.add('form-step', 'space-y-6');
            let stepHtml = `<h2 class="text-2xl font-bold text-center">${step.title}</h2>`;
            step.questions.forEach(q => {
                const questionId = `${q.id}${idPrefix}`;
                let inputHtml = '';
                const daysOfWeek = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
                switch (q.type) {
                    case 'select': inputHtml = `<select id="${questionId}" class="input-field" required>${q.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select>`; break;
                    case 'select_with_ai': inputHtml = `<div class="flex flex-col sm:flex-row items-center gap-4"><select id="${questionId}" class="input-field w-full" required>${q.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select><button type="button" class="ai-recommend-btn btn-primary bg-indigo-600 hover:bg-indigo-500 w-full sm:w-auto whitespace-nowrap px-4 py-3">KI-Empfehlung</button></div>`; break;
                    case 'multiselect_days': inputHtml = `<div id="${questionId}" class="grid grid-cols-2 sm:grid-cols-4 gap-3">${daysOfWeek.map(day => `<div><input type="checkbox" id="day-${day}${idPrefix}" name="sportDays${idPrefix}" value="${day}" class="hidden day-checkbox"><label for="day-${day}${idPrefix}" class="day-checkbox-label">${day}</label></div>`).join('')}</div>`; break;
                    // NEU: HTML für die Checkbox
                    case 'checkbox': inputHtml = `<div class="flex items-center"><input id="${questionId}" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600"><label for="${questionId}" class="ml-3 block text-sm text-gray-300">${q.label}</label></div>`; break;
                    default: inputHtml = `<input type="${q.type}" id="${questionId}" class="input-field" placeholder="${q.placeholder || ''}" required>`;
                }
                // NEU: Wrapper für Sportart und Trainingstage, um sie gemeinsam zu steuern
                if (q.id === 'sport' || q.id === 'sportDays') {
                     stepHtml += `<div data-dependency="noSpecificSport${idPrefix}">${q.id === 'sport' ? `<label for="${questionId}" class="block mb-2 text-sm font-medium text-gray-300">${q.label}</label>` : ''}${inputHtml}</div>`;
                } else {
                     stepHtml += `<div><label for="${questionId}" class="block mb-2 text-sm font-medium text-gray-300">${q.label}</label>${inputHtml}</div>`;
                }
            });
            stepElement.innerHTML = stepHtml.replace(/<label.*?>.*?<\/label>/, (match, offset) => stepHtml.indexOf(match) === offset ? match : ''); // Remove duplicate labels
            container.appendChild(stepElement);
        });
    };

    const renderStep = (stepIndex, container) => {
        container.childNodes.forEach((step, index) => {
            step.classList.remove('active', 'prev', 'next');
            if (index === stepIndex) step.classList.add('active');
            else if (index < stepIndex) step.classList.add('prev');
            else step.classList.add('next');
        });
    };

    const validateStep = (stepIndex, steps, idPrefix = '') => {
        for (const question of steps[stepIndex].questions) {
            const inputElement = document.getElementById(`${question.id}${idPrefix}`);
            if (inputElement && inputElement.hasAttribute('required') && !inputElement.value) {
                alert(`Bitte fülle das Feld "${question.label}" aus.`);
                return false;
            }
            if (question.id === 'passwordConfirm') {
                const password = document.getElementById('password').value;
                if (inputElement.value !== password) {
                    alert('Die Passwörter stimmen nicht überein.');
                    return false;
                }
            }
        }
        return true;
    };

    // ÜBERARBEITET: Speichert die Daten unter Berücksichtigung der Checkbox
    const saveStepData = (stepIndex, steps, dataObject, idPrefix = '') => {
        const noSpecificSportCheckbox = document.getElementById(`noSpecificSport${idPrefix}`);
        const isGeneralFitness = noSpecificSportCheckbox && noSpecificSportCheckbox.checked;

        steps[stepIndex].questions.forEach(q => {
            if (q.id === 'passwordConfirm' || q.id === 'noSpecificSport') return;

            if (isGeneralFitness && (q.id === 'sport' || q.id === 'sportDays')) {
                return; // Überspringe das Speichern dieser Felder
            }

            const questionId = `${q.id}${idPrefix}`;
            if (q.type === 'multiselect_days') {
                const checkedDays = Array.from(document.querySelectorAll(`input[name="sportDays${idPrefix}"]:checked`)).map(cb => cb.value);
                dataObject[q.id] = checkedDays.length > 0 ? checkedDays.join(', ') : 'Keine';
            } else {
                 const element = document.getElementById(questionId);
                 if(element) dataObject[q.id] = element.value;
            }
        });
        
        if (isGeneralFitness) {
            dataObject['sport'] = 'Allgemeine Fitness';
            dataObject['sportDays'] = 'Keine';
        }
    };

    // --- Spezifische Anwendungslogik ---
    const showPage = (pageName) => {
        Object.values(pages).forEach(page => page.style.display = 'none');
        if (pages[pageName]) {
            if (pages[pageName].classList.contains('auth-container')) {
                pages[pageName].style.display = 'flex';
            } else {
                pages[pageName].style.display = 'block';
            }
        }
    };

    const handleRegistration = async () => {
        const { email, password, ...userProfile } = regUserData;
        try {
            showPage('planCreationLoading');
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await db.collection('users').doc(user.uid).set({
                profile: userProfile,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Registrierungsfehler:", error);
            alert(`Fehler: ${error.message}`);
            showPage('registration');
        }
    };

    const handlePlanUpdate = async () => {
        const user = auth.currentUser;
        if (!user) return alert("Fehler: Nicht angemeldet.");
        try {
            showPage('planCreationLoading');
            const userDocRef = db.collection('users').doc(user.uid);
            const doc = await userDocRef.get();
            if (!doc.exists) throw new Error("Benutzerprofil nicht gefunden.");

            const existingProfile = doc.data().profile;
            const newProfile = { ...existingProfile, ...updateUserData };

            await userDocRef.update({
                profile: newProfile,
                plan: firebase.firestore.FieldValue.delete()
            });
        } catch (error) {
            console.error("Fehler beim Aktualisieren des Plans:", error);
            alert(`Fehler: ${error.message}`);
            showPage('dashboard');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            alert(`Fehler: ${error.message}`);
        }
    };

    const handleLogout = () => auth.signOut();

    const displayResults = (data) => {
        planResultContainer.innerHTML = '';
        if (data.weeklyPlan && data.weeklyPlan.length === 7) {
            data.weeklyPlan.forEach((dayPlan, index) => {
                const isWorkout = dayPlan.workoutTitle.toLowerCase() !== 'ruhetag';
                const cellClass = isWorkout ? 'workout' : 'rest';
                const dayElement = document.createElement('div');
                dayElement.className = `day-cell ${cellClass}`;
                dayElement.style.animationDelay = `${index * 100}ms`; // Animation
                dayElement.innerHTML = `
                    <div>
                        <p class="day-name">${dayPlan.day}</p>
                        <p class="workout-title">${dayPlan.workoutTitle}</p>
                    </div>
                    ${isWorkout ? '<p class="view-details">Details &rarr;</p>' : ''}
                `;
                if (isWorkout) {
                    dayElement.dataset.title = `${dayPlan.day}: ${dayPlan.workoutTitle}`;
                    dayElement.dataset.details = dayPlan.workoutDetails;
                }
                planResultContainer.appendChild(dayElement);
            });
        } else {
            planResultContainer.innerHTML = '<p>Kein Plan gefunden.</p>';
        }
    };

    const openModal = (title, details) => {
        modalTitle.textContent = title;
        modalContent.innerHTML = details;
        detailsModal.classList.add('open');
    };
    const closeModal = () => detailsModal.classList.remove('open');

    // --- Event Listener ---
    auth.onAuthStateChanged(user => {
        if (planListener) planListener();
        if (user) {
            const userDocRef = db.collection('users').doc(user.uid);
            planListener = userDocRef.onSnapshot(async (doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    usernameDisplay.textContent = userData.profile.username || user.email;

                    if (userData.plan) {
                        displayResults(userData.plan);
                        showPage('dashboard');
                    } else if (userData.profile) {
                        showPage('dashboard');
                        planResultContainer.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center p-8"><div class="loader mb-4"></div><p class="text-lg font-semibold">Dein persönlicher Plan wird generiert...</p><p class="text-gray-400">Das kann bis zu 30 Sekunden dauern.</p></div>`;
                        const idToken = await user.getIdToken(true);
                        fetch('/.netlify/functions/generatePlan', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${idToken}` }
                        }).catch(err => console.error("Fehler beim Aufrufen der generatePlan Funktion:", err));
                    }
                } else {
                    showPage('registration');
                }
            });
        } else {
            showPage('registration');
        }
    });

    startRegistrationProcessBtn.addEventListener('click', () => {
        registrationStartView.style.transform = 'translateX(-100%)';
        registrationStartView.style.opacity = '0';
        registrationFormWrapper.style.display = 'block';
        registrationFormWrapper.style.transform = 'translateX(100%)';
        registrationFormWrapper.style.opacity = '0';
        setTimeout(() => {
            registrationFormWrapper.style.transform = 'translateX(0)';
            registrationFormWrapper.style.opacity = '1';
        }, 10);
        setTimeout(() => {
            registrationStartView.style.display = 'none';
        }, 400);
        currentRegStep = 0;
        renderStep(currentRegStep, formStepsContainer);
        progressBar.style.width = '0%';
        nextBtn.textContent = 'Weiter';
    });

    nextBtn.addEventListener('click', () => {
        if (!validateStep(currentRegStep, registrationSteps)) return;
        saveStepData(currentRegStep, registrationSteps, regUserData);
        if (currentRegStep < registrationSteps.length - 1) {
            currentRegStep++;
            renderStep(currentRegStep, formStepsContainer);
            progressBar.style.width = `${(currentRegStep / (registrationSteps.length - 1)) * 100}%`;
            if (currentRegStep === registrationSteps.length - 1) nextBtn.textContent = 'Plan generieren';
        } else {
            handleRegistration();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentRegStep > 0) {
            currentRegStep--;
            renderStep(currentRegStep, formStepsContainer);
            progressBar.style.width = `${(currentRegStep / (registrationSteps.length - 1)) * 100}%`;
            nextBtn.textContent = 'Weiter';
        } else {
            registrationFormWrapper.style.transform = 'translateX(100%)';
            registrationFormWrapper.style.opacity = '0';
            registrationStartView.style.display = 'block';
            registrationStartView.style.transform = 'translateX(-100%)';
            registrationStartView.style.opacity = '0';
            setTimeout(() => {
                registrationStartView.style.transform = 'translateX(0)';
                registrationStartView.style.opacity = '1';
            }, 10);
            setTimeout(() => {
                registrationFormWrapper.style.display = 'none';
            }, 400);
        }
    });

    updateNextBtn.addEventListener('click', () => {
        if (!validateStep(currentUpdateStep, updatePlanSteps, '_update')) return;
        saveStepData(currentUpdateStep, updatePlanSteps, updateUserData, '_update');
        if (currentUpdateStep < updatePlanSteps.length - 1) {
            currentUpdateStep++;
            renderStep(currentUpdateStep, updateFormStepsContainer);
            updateProgressBar.style.width = `${(currentUpdateStep / (updatePlanSteps.length - 1)) * 100}%`;
            updatePrevBtn.disabled = false;
            if (currentUpdateStep === updatePlanSteps.length - 1) updateNextBtn.textContent = 'Neuen Plan generieren';
        } else {
            handlePlanUpdate();
        }
    });
    updatePrevBtn.addEventListener('click', () => {
        if (currentUpdateStep > 0) {
            currentUpdateStep--;
            renderStep(currentUpdateStep, updateFormStepsContainer);
            updateProgressBar.style.width = `${(currentUpdateStep / (updatePlanSteps.length - 1)) * 100}%`;
            updateNextBtn.textContent = 'Weiter';
            if (currentUpdateStep === 0) updatePrevBtn.disabled = true;
        }
    });

    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    showLoginBtn.addEventListener('click', () => showPage('login'));
    showRegisterBtn.addEventListener('click', () => {
        showPage('registration');
        registrationFormWrapper.style.display = 'none';
        registrationFormWrapper.style.transform = 'translateX(100%)';
        registrationStartView.style.display = 'block';
        registrationStartView.style.transform = 'translateX(0)';
        registrationStartView.style.opacity = '1';
    });
    newPlanBtn.addEventListener('click', () => {
        currentUpdateStep = 0;
        Object.keys(updateUserData).forEach(key => delete updateUserData[key]);
        renderStep(currentUpdateStep, updateFormStepsContainer);
        updateProgressBar.style.width = '0%';
        updatePrevBtn.disabled = true;
        updateNextBtn.textContent = 'Weiter';
        showPage('updatePlan');
    });
    cancelUpdateBtn.addEventListener('click', () => showPage('dashboard'));
    planResultContainer.addEventListener('click', (e) => {
        const clickedDay = e.target.closest('.day-cell.workout');
        if (clickedDay) openModal(clickedDay.dataset.title, clickedDay.dataset.details);
    });
    
    // NEU: Event-Delegation für die Checkbox-Logik
    document.body.addEventListener('change', (e) => {
        const idPrefix = e.target.id.includes('_update') ? '_update' : '';
        if (e.target.id === `noSpecificSport${idPrefix}`) {
            const isChecked = e.target.checked;
            const sportInput = document.getElementById(`sport${idPrefix}`);
            const sportDaysContainer = document.getElementById(`sportDays${idPrefix}`);
            const dependentElements = [sportInput, sportDaysContainer];

            dependentElements.forEach(el => {
                if (el) {
                    el.closest('[data-dependency]').classList.toggle('disabled-look', isChecked);
                    el.querySelectorAll('input, select').forEach(input => input.disabled = isChecked);
                    if(sportInput) sportInput.required = !isChecked;
                }
            });
        }
    });

    document.body.addEventListener('click', e => {
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
    buildFormSteps(registrationSteps, formStepsContainer);
    renderStep(currentRegStep, formStepsContainer);
    buildFormSteps(updatePlanSteps, updateFormStepsContainer, '_update');
    renderStep(currentUpdateStep, updateFormStepsContainer);
    showPage('authLoading');
});
