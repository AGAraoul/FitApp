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
    let fullPlanData = {};
    let currentWeekIndex = 0;


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
                { id: 'noSpecificSport', label: 'Ich möchte an meiner allgemeinen Fitness arbeiten.', type: 'checkbox' },
                { id: 'sport', label: 'Für welche Hauptsportart möchtest du einen Plan?', type: 'text', placeholder: 'z.B. Bodybuilding, Fußball' },
                { id: 'sportDays', label: 'An welchen Tagen trainierst du diese Sportart bereits?', type: 'multiselect_days' },
                { id: 'fitnessLevel', label: 'Auf welchem Fitnessniveau befindest du dich?', type: 'select', options: ['Anfänger - Niedrige Körperliche Fitness', 'Fortgeschritten - Durchschnittliche Fitness', 'Sportlich - Überdurchschnittliche Fitness', 'Extrem Sportlich - Herausragende Fitness'] },
            ]
        },
        {
            title: "Dein Trainingspensum",
            questions: [
                { id: 'frequency', label: 'Wie oft möchtest du im Fitnessstudio trainieren?', type: 'select_with_ai', options: ['1-2 mal', '3-4 mal', '5-6 mal'] },
            ]
        },
        {
            title: "Wähle deinen Trainingszeitraum",
            questions: [
                { id: 'dateRange', type: 'calendar' }
            ]
        }
    ];

    const updatePlanSteps = registrationSteps.slice(1).map(step => {
        return {
            ...step,
            questions: step.questions.filter(q => q.id !== 'username')
        };
    });

    // --- Allgemeine Multi-Step Formular Funktionen (ÜBERARBEITET) ---
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
                    case 'checkbox': inputHtml = `<div class="checkbox-container"><input id="${questionId}" type="checkbox" class="custom-checkbox"><label for="${questionId}" class="custom-checkbox-label">${q.label}</label></div>`; break;
                    case 'calendar': inputHtml = `<div id="calendar-wrapper${idPrefix}" class="calendar-container"></div><p id="selection-info${idPrefix}" class="selection-info-text">Wähle einen Starttag.</p>`; break;
                    default: inputHtml = `<input type="${q.type}" id="${questionId}" class="input-field" placeholder="${q.placeholder || ''}" required>`;
                }
                
                let questionWrapper = '';
                if (q.type === 'checkbox' || q.type === 'calendar') {
                    questionWrapper = inputHtml; 
                } else if (q.id === 'sport' || q.id === 'sportDays') {
                    questionWrapper = `<div data-dependency="noSpecificSport${idPrefix}"><label for="${questionId}" class="block mb-2 text-sm font-medium text-gray-300">${q.label}</label>${inputHtml}</div>`;
                } else {
                    questionWrapper = `<div><label for="${questionId}" class="block mb-2 text-sm font-medium text-gray-300">${q.label}</label>${inputHtml}</div>`;
                }
                stepHtml += questionWrapper;
            });
            stepElement.innerHTML = stepHtml;
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

    const validateStep = (stepIndex, steps, dataObject, idPrefix = '') => {
        for (const question of steps[stepIndex].questions) {
            if (question.type === 'calendar') {
                if (!dataObject.startDate || !dataObject.endDate) {
                    alert('Bitte wähle einen Start- und Endzeitpunkt für deinen Plan aus.');
                    return false;
                }
            }
            const inputElement = document.getElementById(`${question.id}${idPrefix}`);
            if (inputElement && inputElement.hasAttribute('required') && !inputElement.value) {
                alert(`Bitte fülle das Feld "${question.label}" aus.`);
                return false;
            }
            if (question.id === 'passwordConfirm') {
                const password = document.getElementById('password' + idPrefix).value;
                if (inputElement.value !== password) {
                    alert('Die Passwörter stimmen nicht überein.');
                    return false;
                }
            }
        }
        return true;
    };

    const saveStepData = (stepIndex, steps, dataObject, idPrefix = '') => {
        const noSpecificSportCheckbox = document.getElementById(`noSpecificSport${idPrefix}`);
        const isGeneralFitness = noSpecificSportCheckbox && noSpecificSportCheckbox.checked;

        steps[stepIndex].questions.forEach(q => {
            if (q.id === 'passwordConfirm' || q.id === 'noSpecificSport' || q.type === 'calendar') return;

            if (isGeneralFitness && (q.id === 'sport' || q.id === 'sportDays')) {
                return; 
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
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                plan: {
                    startDate: regUserData.startDate,
                    endDate: regUserData.endDate,
                    weeklyPlans: {}
                }
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
            
            if (updateUserData.sport === 'Allgemeine Fitness') {
                existingProfile.sport = 'Allgemeine Fitness';
                existingProfile.sportDays = 'Keine';
            }

            const newProfile = { ...existingProfile, ...updateUserData };

            await userDocRef.update({
                profile: newProfile,
                plan: {
                    startDate: updateUserData.startDate,
                    endDate: updateUserData.endDate,
                    weeklyPlans: {}
                }
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

    const handleLogout = () => {
        auth.signOut().then(() => {
            showPage('login');
        });
    };

    const renderWeek = (weekIndex) => {
        const sortedWeeks = Object.keys(fullPlanData.weeklyPlans).sort();
        const weekKey = sortedWeeks[weekIndex];
        const weekData = fullPlanData.weeklyPlans[weekKey];

        const weekStartDate = new Date(weekKey);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        const formatDate = (date) => `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        let navigatorHTML = `
            <div class="week-navigator">
                <button id="prevWeekBtn" class="week-nav-btn" ${weekIndex === 0 ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <div class="week-info">
                    <h3>Trainingswoche ${weekIndex + 1}</h3>
                    <p class="date-range">${formatDate(weekStartDate)} - ${formatDate(weekEndDate)}</p>
                </div>
                <button id="nextWeekBtn" class="week-nav-btn" ${weekIndex === sortedWeeks.length - 1 ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>
        `;

        let gridHTML = '<div class="plan-grid">';
        weekData.weeklyPlan.forEach((dayPlan) => {
            const isWorkout = dayPlan.workoutTitle.toLowerCase() !== 'ruhetag';
            const cellClass = isWorkout ? 'workout' : 'rest';
            gridHTML += `
                <div class="day-cell ${cellClass}" data-title="${dayPlan.day}: ${dayPlan.workoutTitle}" data-details="${isWorkout ? dayPlan.workoutDetails : ''}">
                    <div>
                        <p class="day-name">${dayPlan.day}</p>
                        <p class="workout-title">${dayPlan.workoutTitle}</p>
                    </div>
                    ${isWorkout ? '<p class="view-details">Details &rarr;</p>' : ''}
                </div>
            `;
        });
        gridHTML += '</div>';

        planResultContainer.innerHTML = navigatorHTML + gridHTML;
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

                    if (userData.plan && userData.plan.weeklyPlans && Object.keys(userData.plan.weeklyPlans).length > 0) {
                        fullPlanData = userData.plan;
                        const sortedWeeks = Object.keys(fullPlanData.weeklyPlans).sort();
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        let foundCurrentWeek = false;
                        for(let i = 0; i < sortedWeeks.length; i++) {
                            const weekStartDate = new Date(sortedWeeks[i]);
                            const weekEndDate = new Date(weekStartDate);
                            weekEndDate.setDate(weekEndDate.getDate() + 6);
                            if (today >= weekStartDate && today <= weekEndDate) {
                                currentWeekIndex = i;
                                foundCurrentWeek = true;
                                break;
                            }
                        }
                        if (!foundCurrentWeek) {
                            currentWeekIndex = 0;
                        }
                        
                        renderWeek(currentWeekIndex);
                        showPage('dashboard');
                    } else if (userData.profile && userData.plan && userData.plan.startDate) {
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
        const card = registrationStartView.closest('.card');
        card.style.minHeight = card.offsetHeight + 'px'; 

        registrationStartView.classList.add('fade-out-left');
        
        setTimeout(() => {
            registrationStartView.style.display = 'none';
            registrationFormWrapper.style.display = 'block';
            registrationFormWrapper.classList.add('fade-in-right');
            card.style.minHeight = ''; 
        }, 400);

        currentRegStep = 0;
        renderStep(currentRegStep, formStepsContainer);
        progressBar.style.width = '0%';
        nextBtn.textContent = 'Weiter';
    });

    nextBtn.addEventListener('click', () => {
        if (!validateStep(currentRegStep, registrationSteps, regUserData)) return;
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
            const card = registrationFormWrapper.closest('.card');
            card.style.minHeight = card.offsetHeight + 'px';

            registrationFormWrapper.classList.remove('fade-in-right');
            registrationFormWrapper.classList.add('fade-out-right');

            setTimeout(() => {
                registrationFormWrapper.style.display = 'none';
                registrationStartView.style.display = 'block';
                registrationStartView.classList.remove('fade-out-left');
                registrationStartView.classList.add('fade-in-left');
                card.style.minHeight = '';
            }, 400);
        }
    });

    updateNextBtn.addEventListener('click', () => {
        if (!validateStep(currentUpdateStep, updatePlanSteps, updateUserData, '_update')) return;
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
        registrationFormWrapper.classList.remove('fade-in-right', 'fade-out-right');
        registrationStartView.style.display = 'block';
        registrationStartView.classList.remove('fade-out-left', 'fade-in-left');
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
        const dayCell = e.target.closest('.day-cell.workout');
        const prevBtn = e.target.closest('#prevWeekBtn');
        const nextBtn = e.target.closest('#nextWeekBtn');

        if (dayCell && dayCell.dataset.details) {
            openModal(dayCell.dataset.title, dayCell.dataset.details);
        }
        if (prevBtn) {
            if (currentWeekIndex > 0) {
                currentWeekIndex--;
                renderWeek(currentWeekIndex);
            }
        }
        if (nextBtn) {
            const sortedWeeks = Object.keys(fullPlanData.weeklyPlans).sort();
            if (currentWeekIndex < sortedWeeks.length - 1) {
                currentWeekIndex++;
                renderWeek(currentWeekIndex);
            }
        }
    });
    
    document.body.addEventListener('change', (e) => {
        const idPrefix = e.target.id.includes('_update') ? '_update' : '';
        if (e.target.id === `noSpecificSport${idPrefix}`) {
            const isChecked = e.target.checked;
            const sportInput = document.getElementById(`sport${idPrefix}`);
            const sportDaysContainer = document.getElementById(`sportDays${idPrefix}`);
            
            if (sportInput) {
                sportInput.closest('[data-dependency]').classList.toggle('disabled-look', isChecked);
                sportInput.disabled = isChecked;
                sportInput.required = !isChecked;
            }
            if (sportDaysContainer) {
                sportDaysContainer.closest('[data-dependency]').classList.toggle('disabled-look', isChecked);
                sportDaysContainer.querySelectorAll('input').forEach(input => input.disabled = isChecked);
            }
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
    
    initCalendar('calendar-wrapper', regUserData, '');
    initCalendar('calendar-wrapper_update', updateUserData, '_update');

    showPage('authLoading');
});

function initCalendar(containerId, dataObject, idPrefix) {
    const calendarWrapper = document.getElementById(containerId);
    if (!calendarWrapper) return;

    let date = new Date();
    let currYear = date.getFullYear();
    let currMonth = date.getMonth();
    let startDate = null;
    let endDate = null;

    const renderCalendar = () => {
        const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
        let firstDayofMonth = new Date(currYear, currMonth, 1).getDay();
        firstDayofMonth = firstDayofMonth === 0 ? 6 : firstDayofMonth - 1;
        let lastDateofMonth = new Date(currYear, currMonth + 1, 0).getDate();
        let lastDayofMonth = new Date(currYear, currMonth, lastDateofMonth).getDay();
        lastDayofMonth = lastDayofMonth === 0 ? 6 : lastDayofMonth - 1;
        let lastDateofLastMonth = new Date(currYear, currMonth, 0).getDate();
        
        let calendarHTML = `
            <div class="calendar-header">
                <button id="prevMonth${idPrefix}" class="calendar-nav-btn">&lt;</button>
                <p id="currentMonthYear">${months[currMonth]} ${currYear}</p>
                <button id="nextMonth${idPrefix}" class="calendar-nav-btn">&gt;</button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-day-name">Mo</div>
                <div class="calendar-day-name">Di</div>
                <div class="calendar-day-name">Mi</div>
                <div class="calendar-day-name">Do</div>
                <div class="calendar-day-name">Fr</div>
                <div class="calendar-day-name">Sa</div>
                <div class="calendar-day-name">So</div>
        `;

        for (let i = firstDayofMonth; i > 0; i--) {
            calendarHTML += `<div class="calendar-day disabled">${lastDateofLastMonth - i + 1}</div>`;
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        for (let i = 1; i <= lastDateofMonth; i++) {
            let dayDate = new Date(currYear, currMonth, i);
            let classes = 'calendar-day';
            if (dayDate < today) {
                classes += ' disabled';
            }
            if (dayDate.getTime() === today.getTime()) {
                classes += ' today';
            }
            if (startDate && endDate && dayDate >= startDate && dayDate <= endDate) {
                classes += ' in-range';
                if (dayDate.getTime() === startDate.getTime()) classes += ' start-range';
                if (dayDate.getTime() === endDate.getTime()) classes += ' end-range';
            } else if (startDate && dayDate.getTime() === startDate.getTime()) {
                classes += ' selected';
            }
            
            calendarHTML += `<div class="${classes}" data-date="${dayDate.toISOString()}">${i}</div>`;
        }
        
        for (let i = lastDayofMonth; i < 6; i++) {
            calendarHTML += `<div class="calendar-day disabled">${i - lastDayofMonth + 1}</div>`
        }
        calendarHTML += `</div>`;
        calendarWrapper.innerHTML = calendarHTML;
    };

    const updateSelectionInfo = () => {
        const infoEl = document.getElementById(`selection-info${idPrefix}`);
        if (!startDate) {
            infoEl.textContent = 'Wähle einen Starttag.';
        } else if (!endDate) {
            infoEl.textContent = 'Wähle einen Endtag.';
        } else {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            infoEl.textContent = `Ausgewählt: ${startDate.toLocaleDateString('de-DE', options)} - ${endDate.toLocaleDateString('de-DE', options)}`;
        }
    };

    calendarWrapper.addEventListener('click', (e) => {
        if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('disabled')) {
            const selectedDate = new Date(e.target.dataset.date);
            if (!startDate || (startDate && endDate)) {
                startDate = selectedDate;
                endDate = null;
            } else {
                if (selectedDate < startDate) {
                    startDate = selectedDate;
                } else {
                    endDate = selectedDate;
                }
            }
            dataObject.startDate = startDate ? startDate.toISOString() : null;
            dataObject.endDate = endDate ? endDate.toISOString() : null;
            renderCalendar();
            updateSelectionInfo();
        } else if (e.target.closest(`#prevMonth${idPrefix}`)) {
            currMonth--;
            if (currMonth < 0) {
                currMonth = 11;
                currYear--;
            }
            renderCalendar();
        } else if (e.target.closest(`#nextMonth${idPrefix}`)) {
            currMonth++;
            if (currMonth > 11) {
                currMonth = 0;
                currYear++;
            }
            renderCalendar();
        }
    });

    renderCalendar();
}
