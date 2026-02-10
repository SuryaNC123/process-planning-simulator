// State
let processes = [];
let timeQuantum = 2;
let selectedAlgorithm = "FCFS";

// DOM Elements
const numProcessesInput = document.getElementById("num-processes");
const pidInput = document.getElementById("pid");
const arrivalInput = document.getElementById("arrival-time");
const burstInput = document.getElementById("burst-time");
const priorityInput = document.getElementById("priority");
const addBtn = document.getElementById("add-btn");
const processListBody = document.getElementById("process-list-body");
const algorithmSelect = document.getElementById("algorithm");
const timeQuantumBox = document.getElementById("time-quantum-box");
const timeQuantumInput = document.getElementById("time-quantum");
const runBtn = document.getElementById("run-btn");
const resetBtn = document.getElementById("reset-btn");
const resultsContainer = document.getElementById("results-container");
const inputError = document.getElementById("input-error");
const algoDescription = document.getElementById("algo-description");
const logsPanel = document.getElementById("logs-panel");
const toggleLogsBtn = document.getElementById("toggle-logs-btn");
const logsSection = document.getElementById("logs-section");

// Descriptions
const descriptions = {
    "FCFS": "First Come First Serve: Executes processes in the order they arrive. Simple and fair but can lead to the convoy effect.",
    "SJF": "Shortest Job First (Non-Preemptive): Selects the process with the shortest burst time. Minimizes average waiting time but can cause starvation for long processes.",
    "SRTF": "Shortest Remaining Time First (Preemptive SJF): Preempts the current process if a new one arrives with a shorter remaining time.",
    "Priority": "Priority (Non-Preemptive): Selects the process with the highest priority (lower number = higher priority). Can cause starvation.",
    "PriorityPreemptive": "Priority (Preemptive): Preempts the current process if a new one arrives with higher priority.",
    "RR": "Round Robin: Assigns a fixed time quantum to each process in a cyclic order. Fair and responsive, good for time-sharing systems."
};

// Event Listeners
addBtn.addEventListener("click", addProcess);
runBtn.addEventListener("click", runSimulation);
resetBtn.addEventListener("click", resetSimulation);
algorithmSelect.addEventListener("change", handleAlgorithmChange);
timeQuantumInput.addEventListener("change", (e) => timeQuantum = parseInt(e.target.value));
toggleLogsBtn.addEventListener("click", toggleLogs);

// Initialization
renderProcessList();

// Functions

function toggleLogs() {
    if (logsSection.style.display === "none") {
        logsSection.style.display = "block";
        toggleLogsBtn.textContent = "Hide Execution Logs";
    } else {
        logsSection.style.display = "none";
        toggleLogsBtn.textContent = "Show Execution Logs";
    }
}

function handleAlgorithmChange() {
    selectedAlgorithm = algorithmSelect.value;
    algoDescription.textContent = descriptions[selectedAlgorithm];
    
    if (selectedAlgorithm === "RR") {
        timeQuantumBox.style.display = "block";
    } else {
        timeQuantumBox.style.display = "none";
    }
}

function addProcess() {
    const pid = pidInput.value.trim();
    const arrival = parseInt(arrivalInput.value);
    const burst = parseInt(burstInput.value);
    const priority = parseInt(priorityInput.value);
    const maxProcesses = parseInt(numProcessesInput.value);

    // Validation
    if (processes.length >= maxProcesses) {
        showError(`Limit reached. You specified a maximum of ${maxProcesses} processes.`);
        return;
    }
    if (!pid || isNaN(arrival) || isNaN(burst) || isNaN(priority)) {
        showError("Please fill all fields correctly.");
        return;
    }
    if (arrival < 0 || burst < 1 || priority < 0) {
        showError("Values must be positive. Burst time must be > 0.");
        return;
    }
    if (processes.some(p => p.id === pid)) {
        showError("Process ID must be unique.");
        return;
    }

    processes.push({ id: pid, arrivalTime: arrival, burstTime: burst, priority: priority });
    processes.sort((a, b) => a.arrivalTime - b.arrivalTime); // Keep sorted by arrival for cleaner list
    
    // Auto-increment default PID
    const nextNum = processes.length + 1;
    pidInput.value = `P${nextNum}`;
    
    showError(""); // Clear error
    renderProcessList();
}

function removeProcess(index) {
    processes.splice(index, 1);
    renderProcessList();
}

function renderProcessList() {
    processListBody.innerHTML = "";
    processes.forEach((p, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.arrivalTime}</td>
            <td>${p.burstTime}</td>
            <td>${p.priority}</td>
            <td><button class="delete-btn" onclick="window.removeProcessGlobal(${index})">Remove</button></td>
        `;
        processListBody.appendChild(row);
    });
}
// Hack to make function accessible from inline onclick
window.removeProcessGlobal = removeProcess;

function showError(msg) {
    inputError.textContent = msg;
}

function resetSimulation() {
    processes = [];
    pidInput.value = "P1";
    renderProcessList();
    resultsContainer.style.display = "none";
    clearLogs();
    logsSection.style.display = "none";
    toggleLogsBtn.textContent = "Show Execution Logs";
}

function clearLogs() {
    logsPanel.innerHTML = "";
}

function log(time, message) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="log-time">[Time ${time}]</span> ${message}`;
    logsPanel.appendChild(entry);
}

function runSimulation() {
    if (processes.length === 0) {
        showError("No processes to run.");
        return;
    }
    showError("");
    resultsContainer.style.display = "block";
    clearLogs();

    let result;
    // Clone processes to avoid modifying original input
    const procCopy = JSON.parse(JSON.stringify(processes));

    // Validate TQ for RR
    if (selectedAlgorithm === "RR") {
        if (isNaN(timeQuantum) || timeQuantum <= 0) {
            showError("Time Quantum must be a positive number.");
            return;
        }
    }

    switch (selectedAlgorithm) {
        case "FCFS":
            result = runFCFS(procCopy);
            break;
        case "SJF":
            result = runSJF(procCopy);
            break;
        case "SRTF":
            result = runSRTF(procCopy);
            break;
        case "Priority":
            result = runPriority(procCopy);
            break;
        case "PriorityPreemptive":
            result = runPriorityPreemptive(procCopy);
            break;
        case "RR":
            result = runRR(procCopy);
            break;
        default:
            result = runFCFS(procCopy);
    }

    renderResults(result);
}

// ---------------- ALGORITHMS ----------------

function runFCFS(procs) {
    procs.sort((a, b) => a.arrivalTime - b.arrivalTime);
    let currentTime = 0, completed = [], gantt = [], idleTime = 0, contextSwitches = 0, lastProcessId = null;
    let queue = [...procs];
    while (queue.length > 0) {
        if (queue[0].arrivalTime > currentTime) {
            let gap = queue[0].arrivalTime - currentTime;
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + gap, duration: gap });
            log(currentTime, "CPU is Idle");
            idleTime += gap;
            currentTime += gap;
            lastProcessId = "IDLE";
        }
        let p = queue.shift();
        if (lastProcessId !== null && lastProcessId !== "IDLE" && lastProcessId !== p.id) contextSwitches++;
        lastProcessId = p.id;
        log(currentTime, `Starting Process ${p.id}`);
        let start = currentTime, end = start + p.burstTime;
        gantt.push({ id: p.id, start: start, end: end, duration: p.burstTime });
        p.completionTime = end;
        p.turnaroundTime = p.completionTime - p.arrivalTime;
        p.waitingTime = p.turnaroundTime - p.burstTime;
        p.responseTime = p.waitingTime;
        currentTime = end;
        log(currentTime, `Completed Process ${p.id}`);
        completed.push(p);
    }
    return { completed, gantt, idleTime, contextSwitches };
}

function runSJF(procs) {
    let currentTime = 0, completed = 0, n = procs.length, isCompleted = new Array(n).fill(false), gantt = [], idleTime = 0, contextSwitches = 0, lastProcessId = null;
    while (completed < n) {
        let idx = -1, minBurst = Infinity;
        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (procs[i].burstTime < minBurst) { minBurst = procs[i].burstTime; idx = i; }
                else if (procs[i].burstTime === minBurst) { if (procs[i].arrivalTime < procs[idx].arrivalTime) idx = i; }
            }
        }
        if (idx !== -1) {
            let p = procs[idx];
            if (lastProcessId !== null && lastProcessId !== "IDLE" && lastProcessId !== p.id) contextSwitches++;
            lastProcessId = p.id;
            log(currentTime, `Starting Process ${p.id} (Burst: ${p.burstTime})`);
            gantt.push({ id: p.id, start: currentTime, end: currentTime + p.burstTime, duration: p.burstTime });
            p.completionTime = currentTime + p.burstTime;
            p.turnaroundTime = p.completionTime - p.arrivalTime;
            p.waitingTime = p.turnaroundTime - p.burstTime;
            p.responseTime = p.waitingTime;
            currentTime += p.burstTime;
            log(currentTime, `Completed Process ${p.id}`);
            isCompleted[idx] = true; completed++;
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++; currentTime++; lastProcessId = "IDLE";
        }
    }
    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runSRTF(procs) {
    let currentTime = 0, completed = 0, n = procs.length, remainingTime = procs.map(p => p.burstTime), isCompleted = new Array(n).fill(false), gantt = [], idleTime = 0, contextSwitches = 0, lastProcessId = null;
    let firstResponse = new Array(n).fill(-1);
    while (completed < n) {
        let idx = -1, minRem = Infinity;
        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (remainingTime[i] < minRem) { minRem = remainingTime[i]; idx = i; }
            }
        }
        if (idx !== -1) {
            let p = procs[idx];
            if (lastProcessId !== null && lastProcessId !== "IDLE" && lastProcessId !== p.id) {
                contextSwitches++;
                log(currentTime, `Context Switch to Process ${p.id}`);
            }
            if (lastProcessId !== p.id) {
                if (firstResponse[idx] === -1) {
                    firstResponse[idx] = currentTime;
                    p.responseTime = currentTime - p.arrivalTime;
                    log(currentTime, `Process ${p.id} started/responded first time`);
                }
            }
            lastProcessId = p.id;
            gantt.push({ id: p.id, start: currentTime, end: currentTime + 1, duration: 1 });
            remainingTime[idx]--; currentTime++;
            if (remainingTime[idx] === 0) {
                p.completionTime = currentTime;
                p.turnaroundTime = p.completionTime - p.arrivalTime;
                p.waitingTime = p.turnaroundTime - p.burstTime;
                isCompleted[idx] = true; completed++;
                log(currentTime, `Process ${p.id} completed`);
            }
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++; currentTime++; lastProcessId = "IDLE";
        }
    }
    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runPriority(procs) {
    let currentTime = 0, completed = 0, n = procs.length, isCompleted = new Array(n).fill(false), gantt = [], idleTime = 0, contextSwitches = 0, lastProcessId = null;
    while (completed < n) {
        let idx = -1, bestPriority = Infinity;
        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (procs[i].priority < bestPriority) { bestPriority = procs[i].priority; idx = i; }
                else if (procs[i].priority === bestPriority) { if (procs[i].arrivalTime < procs[idx].arrivalTime) idx = i; }
            }
        }
        if (idx !== -1) {
            let p = procs[idx];
            if (lastProcessId !== null && lastProcessId !== "IDLE" && lastProcessId !== p.id) contextSwitches++;
            lastProcessId = p.id;
            log(currentTime, `Starting Process ${p.id} (Priority: ${p.priority})`);
            gantt.push({ id: p.id, start: currentTime, end: currentTime + p.burstTime, duration: p.burstTime });
            p.completionTime = currentTime + p.burstTime;
            p.turnaroundTime = p.completionTime - p.arrivalTime;
            p.waitingTime = p.turnaroundTime - p.burstTime;
            p.responseTime = p.waitingTime;
            currentTime += p.burstTime;
            isCompleted[idx] = true; completed++;
            log(currentTime, `Completed Process ${p.id}`);
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++; currentTime++; lastProcessId = "IDLE";
        }
    }
    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runPriorityPreemptive(procs) {
    let currentTime = 0, completed = 0, n = procs.length, remainingTime = procs.map(p => p.burstTime), isCompleted = new Array(n).fill(false), gantt = [], idleTime = 0, contextSwitches = 0, lastProcessId = null;
    let firstResponse = new Array(n).fill(-1);
    while (completed < n) {
        let idx = -1, bestPriority = Infinity;
        for(let i=0; i<n; i++){
            if(procs[i].arrivalTime <= currentTime && !isCompleted[i]){
                if(procs[i].priority < bestPriority){ bestPriority = procs[i].priority; idx = i; }
                else if(procs[i].priority === bestPriority) { if(idx === -1 || procs[i].arrivalTime < procs[idx].arrivalTime) idx = i; }
            }
        }
        if (idx !== -1) {
            let p = procs[idx];
            if (lastProcessId !== null && lastProcessId !== "IDLE" && lastProcessId !== p.id) {
                contextSwitches++;
                log(currentTime, `Preempting/Switching to ${p.id}`);
            }
            if(firstResponse[idx] === -1){ firstResponse[idx] = currentTime; p.responseTime = currentTime - p.arrivalTime; }
            lastProcessId = p.id;
            gantt.push({ id: p.id, start: currentTime, end: currentTime + 1, duration: 1 });
            remainingTime[idx]--; currentTime++;
            if (remainingTime[idx] === 0) {
                p.completionTime = currentTime;
                p.turnaroundTime = p.completionTime - p.arrivalTime;
                p.waitingTime = p.turnaroundTime - p.burstTime;
                isCompleted[idx] = true; completed++;
                log(currentTime, `Process ${p.id} completed`);
            }
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++; currentTime++; lastProcessId = "IDLE";
        }
    }
    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runRR(procs) {
    let currentTime = 0, completed = 0, n = procs.length, remainingTime = procs.map(p => p.burstTime), isCompleted = new Array(n).fill(false), gantt = [], idleTime = 0, contextSwitches = 0, lastProcessId = null;
    let firstResponse = new Array(n).fill(-1), queue = [], visited = new Array(n).fill(false);
    function checkNewArrivals(time) {
        let arrivals = [];
        for(let i=0; i<n; i++) { if(procs[i].arrivalTime <= time && !visited[i]) arrivals.push(i); }
        arrivals.sort((a,b) => procs[a].arrivalTime - procs[b].arrivalTime);
        arrivals.forEach(idx => { queue.push(idx); visited[idx] = true; log(time, `Process ${procs[idx].id} arrived`); });
    }
    checkNewArrivals(currentTime);
    while (completed < n) {
        if (queue.length > 0) {
            let idx = queue.shift(), p = procs[idx];
            if (lastProcessId !== null && lastProcessId !== "IDLE" && lastProcessId !== p.id) contextSwitches++;
            if(firstResponse[idx] === -1){ firstResponse[idx] = currentTime; p.responseTime = currentTime - p.arrivalTime; }
            lastProcessId = p.id;
            let execTime = Math.min(timeQuantum, remainingTime[idx]);
            log(currentTime, `Executing ${p.id} for ${execTime} units`);
            gantt.push({ id: p.id, start: currentTime, end: currentTime + execTime, duration: execTime });
            for (let t = 1; t <= execTime; t++) { currentTime++; remainingTime[idx]--; checkNewArrivals(currentTime); }
            if (remainingTime[idx] === 0) {
                p.completionTime = currentTime;
                p.turnaroundTime = p.completionTime - p.arrivalTime;
                p.waitingTime = p.turnaroundTime - p.burstTime;
                isCompleted[idx] = true; completed++;
                log(currentTime, `Process ${p.id} completed`);
            } else {
                queue.push(idx);
                log(currentTime, `Process ${p.id} re-queued`);
            }
        } else {
            let nextArrival = Infinity;
            for(let i=0; i<n; i++) { if(!visited[i] && procs[i].arrivalTime < nextArrival) nextArrival = procs[i].arrivalTime; }
            if (nextArrival === Infinity) break;
            let idleDur = nextArrival - currentTime;
            gantt.push({ id: "IDLE", start: currentTime, end: nextArrival, duration: idleDur });
            log(currentTime, `CPU Idle`);
            idleTime += idleDur; currentTime = nextArrival;
            checkNewArrivals(currentTime); lastProcessId = "IDLE";
        }
    }
    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function mergeGanttBlocks(gantt) {
    if (gantt.length === 0) return [];
    let merged = [gantt[0]];
    for (let i = 1; i < gantt.length; i++) {
        let prev = merged[merged.length - 1];
        let curr = gantt[i];
        if (prev.id === curr.id) { prev.end = curr.end; prev.duration += curr.duration; }
        else { merged.push(curr); }
    }
    return merged;
}

function renderResults(result) {
    const tbody = document.getElementById("result-body");
    tbody.innerHTML = "";
    let totalTat = 0, totalWt = 0, totalBurst = 0;
    result.completed.forEach(p => {
        totalTat += p.turnaroundTime; totalWt += p.waitingTime; totalBurst += p.burstTime;
        const row = document.createElement("tr");
        row.innerHTML = `<td>${p.id}</td><td>${p.arrivalTime}</td><td>${p.burstTime}</td><td>${p.priority}</td><td>${p.completionTime}</td><td>${p.turnaroundTime}</td><td>${p.waitingTime}</td><td>${p.responseTime}</td>`;
        tbody.appendChild(row);
    });
    const ganttContainer = document.getElementById("gantt-chart");
    const timeAxis = document.getElementById("gantt-time-axis");
    ganttContainer.innerHTML = ""; timeAxis.innerHTML = "";
    const totalTime = result.gantt[result.gantt.length - 1].end;
    result.gantt.forEach(block => {
        const div = document.createElement("div");
        div.className = `gantt-block ${block.id === "IDLE" ? "idle" : ""}`;
        if(block.id !== "IDLE") { const num = parseInt(block.id.replace(/\D/g, '')) || 0; div.classList.add(`p-color-${(num - 1) % 5}`); }
        const width = (block.duration / totalTime) * 100;
        div.style.width = `${width}%`; div.textContent = block.id; div.title = `${block.id}: ${block.start} - ${block.end}`;
        ganttContainer.appendChild(div);
        const mark = document.createElement("div");
        mark.className = "time-mark"; mark.style.left = `${(block.start / totalTime) * 100}%`; mark.textContent = block.start;
        timeAxis.appendChild(mark);
    });
    const finalMark = document.createElement("div");
    finalMark.className = "time-mark"; finalMark.style.left = "100%"; finalMark.textContent = totalTime;
    timeAxis.appendChild(finalMark);
    document.getElementById("avg-tat").textContent = (totalTat / result.completed.length).toFixed(2);
    document.getElementById("avg-wt").textContent = (totalWt / result.completed.length).toFixed(2);
    document.getElementById("cpu-util").textContent = `${((totalBurst / totalTime) * 100).toFixed(2)}%`;
    document.getElementById("context-switches").textContent = result.contextSwitches;
    document.getElementById("idle-time").textContent = result.idleTime;
}
