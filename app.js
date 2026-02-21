
let goals = JSON.parse(localStorage.getItem("goals")) || [];

function save() {
    localStorage.setItem("goals", JSON.stringify(goals));
}

function createGoal() {
    const title = prompt("Goal title:");
    if (!title) return;
    goals.push({
        id: Date.now(),
        title,
        deadline: "No deadline",
        tasks: []
    });
    save();
    render();
}

function addTask(goalId, value) {
    if (!value.trim()) return;
    const goal = goals.find(g => g.id == goalId);
    goal.tasks.push({ text: value, done: false });
    save();
    render();
}

function toggleTask(goalId, index) {
    const goal = goals.find(g => g.id == goalId);
    goal.tasks[index].done = !goal.tasks[index].done;
    save();
    render();
}

function deleteGoal(id) {
    goals = goals.filter(g => g.id != id);
    save();
    render();
}

function calculateProgress(goal) {
    if (goal.tasks.length === 0) return 0;
    const done = goal.tasks.filter(t => t.done).length;
    return Math.round((done / goal.tasks.length) * 100);
}

function render() {
    const container = document.getElementById("goalsContainer");
    container.innerHTML = "";

    goals.forEach(goal => {
        const progress = calculateProgress(goal);

        const card = document.createElement("div");
        card.className = "goal-card";

        card.innerHTML = `
            <div class="goal-top">
                <div>
                    <div class="goal-title">${goal.title}</div>
                    <div class="goal-meta">${goal.deadline}</div>
                </div>
                <div class="progress-ring" style="--progress:${progress}">
                    ${progress}%
                </div>
            </div>

            <div class="goal-tasks">
                ${goal.tasks.map((t,i)=>
                    `<div class="task-item">
                        <input type="checkbox" ${t.done?"checked":""}
                        onclick="toggleTask(${goal.id},${i})"/>
                        ${t.text}
                    </div>`).join("")}
            </div>

            <input class="task-input" placeholder="Add a task..."
            onkeydown="if(event.key==='Enter') addTask(${goal.id}, this.value)">

            <div class="goal-actions">
                <button class="delete-btn" onclick="deleteGoal(${goal.id})">Delete</button>
            </div>
        `;

        container.appendChild(card);
    });
}

render();
