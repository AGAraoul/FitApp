document.addEventListener('DOMContentLoaded', () => {
    // --- DOM-Elemente ---
    const pages = {
        login: document.getElementById('loginPage'),
        dataCollection: document.getElementById('dataCollectionPage'),
        loading: document.getElementById('loadingPage'),
        dashboard: document.getElementById('dashboardPage'),
    };
    const loginForm = document.getElementById('loginForm');
    const questionContainer = document.getElementById('questionContainer');
    const progressBar = document.getElementById('progressBar');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const resetBtn = document.getElementById('resetBtn');
    const planResultContainer = document.getElementById('planResult');
    const detailsModal = document.getElementById('detailsModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeModalBtn = document.getElementById('closeModalBtn');

    // --- Anwendungsstatus ---
    let currentQuestionIndex = 0;
    const userData = {};

    // --- Fragen ---
    const questions = [
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

    function showPage(pageName) {
        Object.values(pages).forEach(page => page.style.display = 'none');
        pages[pageName].style.display = 'block';
    }

    function displayQuestion() {
        const question = questions[currentQuestionIndex];
        let inputHtml = '';
        const daysOfWeek = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

        switch (question.type) {
            case 'select':
                inputHtml = `<select id="${question.id}" class="input-field">
                    ${question.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>`;
                break;
            case 'number':
            case 'text':
                inputHtml = `<input type="${question.type}" id="${question.id}" class="input-field" placeholder="${question.placeholder || ''}" required>`;
                break;
            case 'select_with_ai':
                inputHtml = `
                    <div class="flex flex-col sm:flex-row items-center gap-4">
                        <select id="${question.id}" class="input-field w-full">
                            ${question.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                        <button type="button" id="aiRecommendBtn" class="btn-primary bg-indigo-600 hover:bg-indigo-500 w-full sm:w-auto whitespace-nowrap px-4 py-3">
                            KI-Empfehlung
                        </button>
                    </div>`;
                break;
            case 'multiselect_days':
                inputHtml = `<div id="${question.id}" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    ${daysOfWeek.map(day => `
                        <div>
                            <input type="checkbox" id="day-${day}" name="sportDays" value="${day}" class="hidden day-checkbox">
                            <label for="day-${day}" class="day-checkbox-label">${day}</label>
                        </div>
                    `).join('')}
                </div>`;
                break;
        }

        questionContainer.innerHTML = `
            <div class="text-center transition-opacity duration-500" style="opacity:0;" id="question-wrapper">
                <label class="block mb-4 text-xl font-medium text-gray-200">${question.label}</label>
                ${inputHtml}
            </div>
        `;
        setTimeout(() => { document.getElementById('question-wrapper').style.opacity = '1'; }, 50);

        updateProgressBar();
        updateNavButtons();
    }
    
    function updateProgressBar() {
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        progressBar.style.width = `${progress}%`;
    }

    function updateNavButtons() {
        prevBtn.disabled = currentQuestionIndex === 0;
        nextBtn.textContent = currentQuestionIndex === questions.length - 1 ? 'Plan erstellen' : 'Weiter';
    }
    
    function saveAnswer() {
        const question = questions[currentQuestionIndex];
        if (question.type === 'multiselect_days') {
            const checkedDays = Array.from(document.querySelectorAll(`input[name="sportDays"]:checked`)).map(cb => cb.value);
            userData[question.id] = checkedDays.length > 0 ? checkedDays.join(', ') : 'Keine';
            return true;
        }
        
        const inputElement = document.getElementById(question.id);
        if (inputElement && inputElement.value && inputElement.value.trim() !== '') {
            userData[question.id] = inputElement.value;
            return true;
        }
        if (inputElement) {
            inputElement.classList.add('border-red-500', 'animate-pulse');
            setTimeout(() => inputElement.classList.remove('border-red-500', 'animate-pulse'), 1500);
        }
        return false;
    }

    function createPrompt() {
        // Diese Funktion bleibt gleich, da der Prompt auf dem Server erstellt wird.
        // Wir übergeben einfach die Rohdaten.
        return userData;
    }

    async function generatePlan() {
        showPage('loading');
        const userProfile = createPrompt();
        
        try {
            // Der API-Aufruf geht jetzt an unsere eigene Serverless Function
            const response = await fetch('/.netlify/functions/generatePlan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userProfile }) // Sende die Benutzerdaten an die Funktion
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server-Fehler: ${response.statusText}`);
            }

            const parsedData = await response.json();
            displayResults(parsedData);

        } catch (error) {
            console.error("Fehler beim Abrufen des Plans:", error);
            alert("Entschuldigung, es gab ein Problem bei der Erstellung deines Plans: " + error.message);
            showPage('dataCollection');
        }
    }
    
    function displayResults(data) {
        document.getElementById('calorieResult').textContent = data.calories || 'N/A';
        planResultContainer.innerHTML = ''; 

        if (data.weeklyPlan && data.weeklyPlan.length === 7) {
            data.weeklyPlan.forEach(dayPlan => {
                const isWorkout = dayPlan.workoutTitle.toLowerCase() !== 'ruhetag';
                const cellClass = isWorkout ? 'workout' : 'rest';

                const dayElement = document.createElement('div');
                dayElement.className = `day-cell ${cellClass}`;
                dayElement.innerHTML = `
                    <div>
                        <p class="font-bold text-lg">${dayPlan.day}</p>
                        <p class="text-blue-300">${dayPlan.workoutTitle}</p>
                    </div>
                    ${isWorkout ? '<p class="text-xs text-gray-400 self-end">Details ansehen &rarr;</p>' : ''}
                `;
                
                if (isWorkout) {
                    dayElement.dataset.title = `${dayPlan.day}: ${dayPlan.workoutTitle}`;
                    dayElement.dataset.details = dayPlan.workoutDetails;
                }
                
                planResultContainer.appendChild(dayElement);
            });
        } else {
            planResultContainer.innerHTML = '<p>Trainingsplan konnte nicht im korrekten Format geladen werden.</p>';
        }
        
        showPage('dashboard');
    }

    function openModal(title, details) {
        modalTitle.textContent = title;
        modalContent.innerHTML = details;
        detailsModal.classList.add('open');
    }

    function closeModal() {
        detailsModal.classList.remove('open');
    }

    // --- Event Listener ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showPage('dataCollection');
        displayQuestion();
    });

    nextBtn.addEventListener('click', () => {
        if (saveAnswer()) {
            if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                displayQuestion();
            } else {
                generatePlan();
            }
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    });
    
    resetBtn.addEventListener('click', () => {
        currentQuestionIndex = 0;
        Object.keys(userData).forEach(key => delete userData[key]);
        showPage('login');
    });

    planResultContainer.addEventListener('click', (e) => {
        const clickedDay = e.target.closest('.day-cell.workout');
        if (clickedDay) {
            openModal(clickedDay.dataset.title, clickedDay.dataset.details);
        }
    });

    questionContainer.addEventListener('click', e => {
        if (e.target.id === 'aiRecommendBtn') {
            const selectElement = document.getElementById(questions[currentQuestionIndex].id);
            const aiOptionValue = "KI-Empfehlung";
            
            if (!selectElement.querySelector(`option[value="${aiOptionValue}"]`)) {
                 const aiOption = new Option('KI-Empfehlung', aiOptionValue, true, true);
                 selectElement.add(aiOption);
            }
            selectElement.value = aiOptionValue;
            
            e.target.textContent = "KI gewählt!";
            e.target.disabled = true;
            setTimeout(() => {
                 e.target.textContent = "KI-Empfehlung";
                 e.target.disabled = false;
            }, 2000);
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            closeModal();
        }
    });

    // --- Initialisierung ---
    showPage('login');
});
