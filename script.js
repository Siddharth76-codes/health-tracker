(() => {
    const $ = (selector) => document.querySelector(selector);
    const habitTable = $("#habitTable");
    const progressBar = $("#progress");
    if (!habitTable || !progressBar) return;

    const HABITS_KEY = "habit-tracker-habits-v1";
    const LOG_KEY = "habit-tracker-daily-log-v1";
    const THEME_KEY = "habit-tracker-theme-v1";
    const defaultHabits = ["Drink water", "Move your body", "Read for 20 minutes", "Get 8 hours of sleep"];
    const encouragements = [
        "You don't have to be perfect. Just keep showing up.",
        "Tiny routines can grow into remarkable change.",
        "Consistency beats intensity. You're building something good.",
        "Make today a small win your future self will thank you for.",
        "Progress is progress, no matter how small.",
        "You are one good choice away from a better day.",
        "Keep your promises to yourself. You're worth the effort.",
    ];

    function readStoredValue(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    }

    function writeStoredValue(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Keep the tracker usable for this session if storage is unavailable.
        }
    }

    function dateKey(date) {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    }

    function dateAtOffset(offset) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - offset);
        return date;
    }

    const today = dateAtOffset(0);
    const todayKey = dateKey(today);
    const progressKey = `habit-tracker-progress-${todayKey}`;
    const monthHeading = $("#month");
    if (monthHeading) {
        monthHeading.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        }).format(today);
    }

    let habits = readStoredValue(HABITS_KEY, null);
    if (!Array.isArray(habits)) {
        habits = defaultHabits.map((name, index) => ({ id: `habit-${index + 1}`, name }));
    }
    habits = habits.filter((habit) => habit && typeof habit.id === "string" && typeof habit.name === "string");
    const storedCompleted = readStoredValue(progressKey, {});
    let completed = storedCompleted && typeof storedCompleted === "object" && !Array.isArray(storedCompleted) ? storedCompleted : {};
    let dailyLog = readStoredValue(LOG_KEY, {});
    if (!dailyLog || typeof dailyLog !== "object" || Array.isArray(dailyLog)) dailyLog = {};

    function saveHabits() {
        writeStoredValue(HABITS_KEY, habits);
    }

    function saveProgress() {
        writeStoredValue(progressKey, completed);
        dailyLog[todayKey] = {
            done: habits.filter((habit) => completed[habit.id]).map((habit) => habit.id),
            total: habits.length,
        };
        writeStoredValue(LOG_KEY, dailyLog);
    }

    function makeHabitForm() {
        const form = document.createElement("form");
        form.className = "habit-form";
        const input = document.createElement("input");
        input.type = "text";
        input.name = "habit";
        input.placeholder = "Add a new habit…";
        input.maxLength = 60;
        input.setAttribute("aria-label", "New habit name");
        input.required = true;

        const addButton = document.createElement("button");
        addButton.type = "submit";
        addButton.className = "add-habit-button";
        addButton.innerHTML = '<span aria-hidden="true">＋</span> Add a habit';
        form.append(input, addButton);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const name = input.value.trim();
            if (!name || habits.some((habit) => habit.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
                input.setCustomValidity(name ? "That habit is already on your list." : "Enter a habit name.");
                input.reportValidity();
                return;
            }
            input.setCustomValidity("");
            habits.push({ id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name });
            saveHabits();
            saveProgress();
            render();
            $(".habit-form input")?.focus();
        });
        input.addEventListener("input", () => input.setCustomValidity(""));
        return form;
    }

    function makeHabitTable() {
        if (habits.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.innerHTML = '<span aria-hidden="true">🌱</span><h3>A fresh start</h3><p>Add your first habit and start growing.</p>';
            return empty;
        }

        const table = document.createElement("table");
        const tableHead = document.createElement("thead");
        const headingRow = document.createElement("tr");
        ["Habit", "Done", ""].forEach((label) => {
            const heading = document.createElement("th");
            heading.scope = "col";
            heading.textContent = label;
            headingRow.append(heading);
        });
        tableHead.append(headingRow);

        const tableBody = document.createElement("tbody");
        habits.forEach((habit) => {
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            nameCell.className = "habit-name";
            nameCell.textContent = habit.name;

            const checkboxCell = document.createElement("td");
            checkboxCell.className = "habit-check-cell";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(completed[habit.id]);
            checkbox.setAttribute("aria-label", `Mark ${habit.name} as complete`);
            checkbox.addEventListener("change", () => {
                const wasComplete = habits.length > 0 && habits.every((item) => completed[item.id]);
                completed[habit.id] = checkbox.checked;
                saveProgress();
                updateDashboard();
                const isComplete = habits.length > 0 && habits.every((item) => completed[item.id]);
                if (!wasComplete && isComplete) celebrate();
            });
            checkboxCell.append(checkbox);

            const actionCell = document.createElement("td");
            actionCell.className = "habit-action-cell";
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-habit";
            removeButton.textContent = "×";
            removeButton.setAttribute("aria-label", `Remove ${habit.name}`);
            removeButton.title = `Remove ${habit.name}`;
            removeButton.addEventListener("click", () => {
                habits = habits.filter((item) => item.id !== habit.id);
                delete completed[habit.id];
                saveHabits();
                saveProgress();
                render();
                $(".habit-form input")?.focus();
            });
            actionCell.append(removeButton);
            row.append(nameCell, checkboxCell, actionCell);
            tableBody.append(row);
        });

        table.append(tableHead, tableBody);
        return table;
    }

    function getDayRecord(date) {
        const key = dateKey(date);
        const record = dailyLog[key];
        if (record && Array.isArray(record.done) && Number.isFinite(record.total)) return record;
        const oldProgress = readStoredValue(`habit-tracker-progress-${key}`, null);
        if (oldProgress && typeof oldProgress === "object" && !Array.isArray(oldProgress)) {
            return { done: habits.filter((habit) => oldProgress[habit.id]).map((habit) => habit.id), total: habits.length };
        }
        return { done: [], total: habits.length };
    }

    function updateWeekChart() {
        const chart = $("#weekChart");
        if (!chart) return;
        chart.replaceChildren();
        for (let offset = 6; offset >= 0; offset -= 1) {
            const date = dateAtOffset(offset);
            const record = getDayRecord(date);
            const percentage = record.total ? Math.round((record.done.length / record.total) * 100) : 0;
            const day = document.createElement("div");
            day.className = "week-day";
            day.setAttribute("aria-label", `${new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date)}: ${percentage}% complete`);
            const value = document.createElement("span");
            value.className = "week-value";
            value.textContent = `${percentage}%`;
            const track = document.createElement("div");
            track.className = "week-bar-track";
            const fill = document.createElement("span");
            fill.className = "week-bar-fill";
            fill.style.height = `${percentage}%`;
            track.append(fill);
            const label = document.createElement("span");
            label.className = "week-label";
            label.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
            if (offset === 0) day.classList.add("is-today");
            day.append(value, track, label);
            chart.append(day);
        }
    }

    function updateStreak() {
        const streakElement = $("#streakValue");
        if (!streakElement) return;
        let offset = getDayRecord(today).total > 0 && getDayRecord(today).done.length >= getDayRecord(today).total ? 0 : 1;
        let streak = 0;
        while (offset < 366) {
            const record = getDayRecord(dateAtOffset(offset));
            if (!record.total || record.done.length < record.total) break;
            streak += 1;
            offset += 1;
        }
        streakElement.textContent = String(streak);
    }

    function updateDashboard() {
        const total = habits.length;
        const done = habits.filter((habit) => completed[habit.id]).length;
        const percentage = total ? Math.round((done / total) * 100) : 0;
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute("role", "progressbar");
        progressBar.setAttribute("aria-label", "Today's habit progress");
        progressBar.setAttribute("aria-valuemin", "0");
        progressBar.setAttribute("aria-valuemax", "100");
        progressBar.setAttribute("aria-valuenow", String(percentage));
        $("#progressText").textContent = `${percentage}%`;
        $("#todayValue").textContent = `${done}/${total}`;
        $("#habitCount").textContent = String(total);
        $("#progressMessage").textContent = total === 0
            ? "Add a habit to get your day started."
            : percentage === 100
                ? "You showed up for yourself. Brilliant work!"
                : done === 0
                    ? "A fresh day is full of possibilities."
                    : `${total - done} more ${total - done === 1 ? "habit" : "habits"} to your daily win.`;
        updateStreak();
        updateWeekChart();
    }

    function celebrate() {
        const celebration = $("#celebration");
        if (!celebration) return;
        const colors = ["#f1c96a", "#6eae80", "#e89071", "#8c9fe8", "#d889bd"];
        celebration.replaceChildren();
        for (let index = 0; index < 42; index += 1) {
            const piece = document.createElement("span");
            const angle = (Math.PI * 2 * index) / 42;
            const distance = 90 + Math.random() * 220;
            piece.className = "confetti-piece";
            piece.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
            piece.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
            piece.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
            piece.style.setProperty("--confetti-color", colors[index % colors.length]);
            piece.style.setProperty("--delay", `${Math.random() * 180}ms`);
            celebration.append(piece);
        }
        $("#liveMessage").textContent = "Amazing! You completed all your habits today.";
        window.setTimeout(() => celebration.replaceChildren(), 1800);
    }

    function setupThemeToggle() {
        const button = $("#themeToggle");
        if (!button) return;
        const savedTheme = readStoredValue(THEME_KEY, null);
        if (savedTheme === "light" || savedTheme === "dark") document.documentElement.dataset.theme = savedTheme;

        function updateButton() {
            const isDark = document.documentElement.dataset.theme === "dark"
                || (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
            button.innerHTML = `<span aria-hidden="true">${isDark ? "☀" : "☾"}</span>`;
            button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
            button.title = `Switch to ${isDark ? "light" : "dark"} theme`;
        }

        updateButton();
        button.addEventListener("click", () => {
            const isCurrentlyDark = document.documentElement.dataset.theme === "dark"
                || (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
            const nextTheme = isCurrentlyDark ? "light" : "dark";
            document.documentElement.dataset.theme = nextTheme;
            writeStoredValue(THEME_KEY, nextTheme);
            updateButton();
        });
        updateButton();
    }

    function render() {
        habitTable.replaceChildren();
        const sectionTitle = document.createElement("div");
        sectionTitle.className = "section-heading habit-section-heading";
        sectionTitle.innerHTML = '<div><p class="eyebrow">MAKE IT HAPPEN</p><h2>Your daily habits</h2></div>';
        habitTable.append(sectionTitle, makeHabitForm(), makeHabitTable());
        updateDashboard();
    }

    const tipElement = $("#dailyTip");
    if (tipElement) tipElement.textContent = encouragements[Math.floor((today.getTime() / 86400000) % encouragements.length)];
    setupThemeToggle();
    saveHabits();
    saveProgress();
    render();
})();
