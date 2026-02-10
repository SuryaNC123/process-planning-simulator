// State
let processes = [
    { id: "P1", arrivalTime: 0, burstTime: 5, priority: 2 },
    { id: "P2", arrivalTime: 1, burstTime: 3, priority: 1 },
    { id: "P3", arrivalTime: 2, burstTime: 8, priority: 3 }
];
let timeQuantum = 2;
let selectedAlgorithm = "FCFS";

// DOM Elements
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

// Initialization
renderProcessList();

// Functions

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

    // Validation
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
    // Sort by arrival time
    procs.sort((a, b) => a.arrivalTime - b.arrivalTime);

    let currentTime = 0;
    let completed = [];
    let gantt = [];
    let idleTime = 0;
    let contextSwitches = 0;
    let lastProcessId = null;

    // We can iterate linearly for FCFS, but let's handle gaps
    let queue = [...procs];
    
    while (queue.length > 0) {
        // Find process that has arrived
        if (queue[0].arrivalTime > currentTime) {
            // Gap
            let gap = queue[0].arrivalTime - currentTime;
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + gap, duration: gap });
            log(currentTime, "CPU is Idle");
            idleTime += gap;
            currentTime += gap;
        }

        let p = queue.shift();
        
        if (lastProcessId !== null && lastProcessId !== p.id) {
            contextSwitches++;
        }
        lastProcessId = p.id;

        log(currentTime, `Starting Process ${p.id}`);
        
        let start = currentTime;
        let end = start + p.burstTime;
        
        gantt.push({ id: p.id, start: start, end: end, duration: p.burstTime });
        
        p.completionTime = end;
        p.turnaroundTime = p.completionTime - p.arrivalTime;
        p.waitingTime = p.turnaroundTime - p.burstTime;
        p.responseTime = p.waitingTime; // For Non-Preemptive, RT = WT
        
        currentTime = end;
        log(currentTime, `Completed Process ${p.id}`);
        completed.push(p);
    }

    return { completed, gantt, idleTime, contextSwitches };
}

function runSJF(procs) {
    // Non-preemptive
    let currentTime = 0;
    let completed = 0;
    let n = procs.length;
    let isCompleted = new Array(n).fill(false);
    let gantt = [];
    let idleTime = 0;
    let contextSwitches = 0;
    let lastProcessId = null;

    while (completed < n) {
        let idx = -1;
        let minBurst = Infinity;

        // Find process arriving <= currentTime with min burst
        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (procs[i].burstTime < minBurst) {
                    minBurst = procs[i].burstTime;
                    idx = i;
                }
                // FCFS tie-breaking implicitly by loop order if sorted by arrival, 
                // but let's explicitly tie break by arrival for stability
                 else if (procs[i].burstTime === minBurst) {
                    if (procs[i].arrivalTime < procs[idx].arrivalTime) {
                        idx = i;
                    }
                }
            }
        }

        if (idx !== -1) {
            let p = procs[idx];
            
            if (lastProcessId !== null && lastProcessId !== p.id) {
                contextSwitches++;
            }
            lastProcessId = p.id;

            log(currentTime, `Starting Process ${p.id} (Burst: ${p.burstTime})`);

            gantt.push({ id: p.id, start: currentTime, end: currentTime + p.burstTime, duration: p.burstTime });
            
            p.completionTime = currentTime + p.burstTime;
            p.turnaroundTime = p.completionTime - p.arrivalTime;
            p.waitingTime = p.turnaroundTime - p.burstTime;
            p.responseTime = p.waitingTime;

            currentTime += p.burstTime;
            log(currentTime, `Completed Process ${p.id}`);
            
            isCompleted[idx] = true;
            completed++;
        } else {
            // Idle
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            // Merge consecutive idle blocks in UI or here? Let's keep simple here.
            idleTime++;
            currentTime++;
        }
    }
    
    // Merge consecutive idle blocks for cleaner Gantt
    gantt = mergeGanttBlocks(gantt);

    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runSRTF(procs) {
    // Preemptive SJF
    let currentTime = 0;
    let completed = 0;
    let n = procs.length;
    let remainingTime = procs.map(p => p.burstTime);
    let isCompleted = new Array(n).fill(false);
    let gantt = [];
    let idleTime = 0;
    let contextSwitches = 0;
    let lastProcessId = null;
    
    // Track first response time
    let firstResponse = new Array(n).fill(-1);

    // Simulation loop - time unit by time unit
    // (Optimization: jump to next event, but unit steps is safer for beginner logic)
    
    while (completed < n) {
        let idx = -1;
        let minRem = Infinity;

        // Find process available with min remaining time
        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (remainingTime[i] < minRem) {
                    minRem = remainingTime[i];
                    idx = i;
                }
            }
        }

        if (idx !== -1) {
            let p = procs[idx];
            
            // Check context switch
            if (lastProcessId !== null && lastProcessId !== p.id) {
                contextSwitches++;
                log(currentTime, `Context Switch to Process ${p.id}`);
            }
            if (lastProcessId !== p.id) {
                // Started or resumed
                if (firstResponse[idx] === -1) {
                    firstResponse[idx] = currentTime;
                    p.responseTime = currentTime - p.arrivalTime;
                    log(currentTime, `Process ${p.id} started/responded first time`);
                }
            }
            lastProcessId = p.id;

            // Execute for 1 unit
            gantt.push({ id: p.id, start: currentTime, end: currentTime + 1, duration: 1 });
            remainingTime[idx]--;
            currentTime++;

            if (remainingTime[idx] === 0) {
                p.completionTime = currentTime;
                p.turnaroundTime = p.completionTime - p.arrivalTime;
                p.waitingTime = p.turnaroundTime - p.burstTime;
                isCompleted[idx] = true;
                completed++;
                log(currentTime, `Process ${p.id} completed`);
            }
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++;
            currentTime++;
            lastProcessId = "IDLE";
        }
    }

    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runPriority(procs) {
    // Non-preemptive, Lower # = Higher Priority
    let currentTime = 0;
    let completed = 0;
    let n = procs.length;
    let isCompleted = new Array(n).fill(false);
    let gantt = [];
    let idleTime = 0;
    let contextSwitches = 0;
    let lastProcessId = null;

    while (completed < n) {
        let idx = -1;
        let bestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (procs[i].priority < bestPriority) {
                    bestPriority = procs[i].priority;
                    idx = i;
                } else if (procs[i].priority === bestPriority) {
                    // FCFS tie break
                    if (procs[i].arrivalTime < procs[idx].arrivalTime) {
                        idx = i;
                    }
                }
            }
        }

        if (idx !== -1) {
            let p = procs[idx];
            
            if (lastProcessId !== null && lastProcessId !== p.id) {
                contextSwitches++;
            }
            lastProcessId = p.id;

            log(currentTime, `Starting Process ${p.id} (Priority: ${p.priority})`);
            
            gantt.push({ id: p.id, start: currentTime, end: currentTime + p.burstTime, duration: p.burstTime });
            
            p.completionTime = currentTime + p.burstTime;
            p.turnaroundTime = p.completionTime - p.arrivalTime;
            p.waitingTime = p.turnaroundTime - p.burstTime;
            p.responseTime = p.waitingTime;

            currentTime += p.burstTime;
            isCompleted[idx] = true;
            completed++;
            log(currentTime, `Completed Process ${p.id}`);
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++;
            currentTime++;
        }
    }

    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runPriorityPreemptive(procs) {
     // Preemptive Priority
    let currentTime = 0;
    let completed = 0;
    let n = procs.length;
    let remainingTime = procs.map(p => p.burstTime);
    let isCompleted = new Array(n).fill(false);
    let gantt = [];
    let idleTime = 0;
    let contextSwitches = 0;
    let lastProcessId = null;
    let firstResponse = new Array(n).fill(-1);

    while (completed < n) {
        let idx = -1;
        let bestPriority = Infinity;

        for (let i = 0; i < n; i++) {
            if (procs[i].arrivalTime <= currentTime && !isCompleted[i]) {
                if (procs[i].priority < bestPriority) {
                    bestPriority = procs[i].priority;
                    idx = i;
                } else if (procs[i].priority === bestPriority) {
                     // FCFS tie break
                     // Wait, if currently running process has same priority, we usually continue running it (no preemption for equal priority)
                     // But here we select the best from ALL available.
                     // Standard logic: if incoming has STRICTLY better priority, preempt.
                     // So we need to track who was running.
                }
            }
        }
        
        // Refine selection for stability/preemption rules
        // If multiple matches, prefer the one already running (idx === lastRunningIndex) to avoid unnecessary context switches?
        // Or strictly strictly follow priority?
        // Let's stick to strict highest priority.
        // If tie, pick one with earliest arrival?
        
        // Re-loop for strict check
        idx = -1;
        bestPriority = Infinity;
        for(let i=0; i<n; i++){
            if(procs[i].arrivalTime <= currentTime && !isCompleted[i]){
                if(procs[i].priority < bestPriority){
                    bestPriority = procs[i].priority;
                    idx = i;
                }
            }
        }
        
        // Tie breaking: If we have a running process and it has the best priority (equal to others), keep it.
        // Else FCFS.
        // Implementation simplified: Just picking smallest index (if input sorted) or arrival.
        // Let's use FCFS on tie.
        if (idx !== -1) {
             for(let i=0; i<n; i++){
                 if(i !== idx && procs[i].arrivalTime <= currentTime && !isCompleted[i] && procs[i].priority === bestPriority){
                     if(procs[i].arrivalTime < procs[idx].arrivalTime) {
                         idx = i;
                     }
                 }
             }
        }


        if (idx !== -1) {
            let p = procs[idx];
            
            if (lastProcessId !== null && lastProcessId !== p.id) {
                contextSwitches++;
                log(currentTime, `Preempting/Switching to ${p.id}`);
            }
            if(firstResponse[idx] === -1){
                firstResponse[idx] = currentTime;
                p.responseTime = currentTime - p.arrivalTime;
            }
            lastProcessId = p.id;

            gantt.push({ id: p.id, start: currentTime, end: currentTime + 1, duration: 1 });
            remainingTime[idx]--;
            currentTime++;

            if (remainingTime[idx] === 0) {
                p.completionTime = currentTime;
                p.turnaroundTime = p.completionTime - p.arrivalTime;
                p.waitingTime = p.turnaroundTime - p.burstTime;
                isCompleted[idx] = true;
                completed++;
                log(currentTime, `Process ${p.id} completed`);
            }
        } else {
            gantt.push({ id: "IDLE", start: currentTime, end: currentTime + 1, duration: 1 });
            idleTime++;
            currentTime++;
            lastProcessId = "IDLE";
        }
    }
    
    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}

function runRR(procs) {
    // Round Robin
    let currentTime = 0;
    let completed = 0;
    let n = procs.length;
    let remainingTime = procs.map(p => p.burstTime);
    let isCompleted = new Array(n).fill(false);
    let gantt = [];
    let idleTime = 0;
    let contextSwitches = 0;
    let lastProcessId = null;
    let firstResponse = new Array(n).fill(-1);

    // Ready Queue (stores indices)
    let queue = [];
    // Map to track if process is in queue to avoid duplicates? 
    // Actually standard RR: add to queue when arrived.
    
    // Sort by arrival initially to push first ones
    // Actually, we need to carefully manage the queue.
    
    // Helper to add newly arrived processes to queue
    let visited = new Array(n).fill(false);
    
    function checkNewArrivals(time) {
        // Sort by arrival time to handle simultaneous arrivals deterministically
        // (Indices are original order, but let's check procs)
        // But procs are unsorted in array?
        // We should iterate through all procs and see if they arrived <= time and not visited
        // And push them to queue in Arrival Order.
        
        let arrivals = [];
        for(let i=0; i<n; i++) {
            if(procs[i].arrivalTime <= time && !visited[i]) {
                arrivals.push(i);
            }
        }
        // Sort arrivals by arrival time, then ID
        arrivals.sort((a,b) => procs[a].arrivalTime - procs[b].arrivalTime);
        
        arrivals.forEach(idx => {
            queue.push(idx);
            visited[idx] = true;
            log(time, `Process ${procs[idx].id} arrived and added to queue`);
        });
    }

    // Initial check
    checkNewArrivals(currentTime);

    while (completed < n) {
        if (queue.length > 0) {
            let idx = queue.shift();
            let p = procs[idx];

            if (lastProcessId !== null && lastProcessId !== p.id) {
                contextSwitches++;
            }
            if(firstResponse[idx] === -1){
                firstResponse[idx] = currentTime;
                p.responseTime = currentTime - p.arrivalTime;
            }
            lastProcessId = p.id;
            
            // Execute for time quantum or remaining time
            let execTime = Math.min(timeQuantum, remainingTime[idx]);
            
            log(currentTime, `Executing ${p.id} for ${execTime} units`);
            gantt.push({ id: p.id, start: currentTime, end: currentTime + execTime, duration: execTime });
            
            // Critical: Check for new arrivals DURING execution? 
            // Standard RR: New processes arrive while P is running. They go to queue.
            // P finishes quantum. If P not done, P goes to END of queue.
            // But WHEN exactly do we add new arrivals? 
            // Usually at the exact time unit they arrive.
            // If we jump `execTime`, we might miss the exact order if P is re-added.
            // Correct order: 
            // 1. Run P for execTime.
            // 2. Clock ticks... 
            // 3. At end of execTime, check arrivals up to (currentTime + execTime).
            // 4. Add them.
            // 5. Then re-add P if not finished.
            
            // Let's do step-by-step for correctness if needed, or jump if safe.
            // Jump is safe for "checkNewArrivals" logic if we pass end time.
            
            for (let t = 1; t <= execTime; t++) {
                currentTime++;
                remainingTime[idx]--;
                checkNewArrivals(currentTime);
            }

            if (remainingTime[idx] === 0) {
                p.completionTime = currentTime;
                p.turnaroundTime = p.completionTime - p.arrivalTime;
                p.waitingTime = p.turnaroundTime - p.burstTime;
                isCompleted[idx] = true;
                completed++;
                log(currentTime, `Process ${p.id} completed`);
            } else {
                queue.push(idx); // Re-queue
                log(currentTime, `Process ${p.id} time slice expired, re-queued`);
            }

        } else {
            // Idle
            // Jump to next arrival?
            let nextArrival = Infinity;
            for(let i=0; i<n; i++) {
                if(!visited[i] && procs[i].arrivalTime < nextArrival) {
                    nextArrival = procs[i].arrivalTime;
                }
            }
            
            if (nextArrival === Infinity) {
                // Should not happen if completed < n
                break; 
            }
            
            let idleDur = nextArrival - currentTime;
            gantt.push({ id: "IDLE", start: currentTime, end: nextArrival, duration: idleDur });
            log(currentTime, `CPU Idle until ${nextArrival}`);
            idleTime += idleDur;
            currentTime = nextArrival;
            checkNewArrivals(currentTime);
            lastProcessId = "IDLE";
        }
    }

    gantt = mergeGanttBlocks(gantt);
    return { completed: procs, gantt, idleTime, contextSwitches };
}


// ---------------- UTILS ----------------

function mergeGanttBlocks(gantt) {
    if (gantt.length === 0) return [];
    
    let merged = [gantt[0]];
    for (let i = 1; i < gantt.length; i++) {
        let prev = merged[merged.length - 1];
        let curr = gantt[i];
        
        if (prev.id === curr.id) {
            prev.end = curr.end;
            prev.duration += curr.duration;
        } else {
            merged.push(curr);
        }
    }
    return merged;
}

function renderResults(result) {
    // Render Table
    const tbody = document.getElementById("result-body");
    tbody.innerHTML = "";
    
    let totalTat = 0;
    let totalWt = 0;
    let totalBurst = 0;

    result.completed.forEach(p => {
        totalTat += p.turnaroundTime;
        totalWt += p.waitingTime;
        totalBurst += p.burstTime;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.arrivalTime}</td>
            <td>${p.burstTime}</td>
            <td>${p.priority}</td>
            <td>${p.completionTime}</td>
            <td>${p.turnaroundTime}</td>
            <td>${p.waitingTime}</td>
            <td>${p.responseTime}</td>
        `;
        tbody.appendChild(row);
    });

    // Gantt Chart
    const ganttContainer = document.getElementById("gantt-chart");
    const timeAxis = document.getElementById("gantt-time-axis");
    ganttContainer.innerHTML = "";
    timeAxis.innerHTML = "";
    
    const totalTime = result.gantt[result.gantt.length - 1].end;
    
    result.gantt.forEach(block => {
        const div = document.createElement("div");
        div.className = `gantt-block ${block.id === "IDLE" ? "idle" : ""}`;
        
        // Dynamic colors for P1, P2...
        if(block.id !== "IDLE") {
             // Simple hash for color
             const num = parseInt(block.id.replace(/\D/g, '')) || 0;
             div.classList.add(`p-color-${(num - 1) % 5}`);
        }
        
        // Width percentage
        const width = (block.duration / totalTime) * 100;
        div.style.width = `${width}%`;
        div.textContent = block.id;
        div.title = `${block.id}: ${block.start} - ${block.end}`;
        
        ganttContainer.appendChild(div);
        
        // Time marker
        const mark = document.createElement("div");
        mark.className = "time-mark";
        mark.style.left = `${(block.start / totalTime) * 100}%`;
        mark.textContent = block.start;
        timeAxis.appendChild(mark);
    });
    
    // Final time mark
    const finalMark = document.createElement("div");
    finalMark.className = "time-mark";
    finalMark.style.left = "100%";
    finalMark.textContent = totalTime;
    timeAxis.appendChild(finalMark);

    // Metrics
    const avgTat = (totalTat / result.completed.length).toFixed(2);
    const avgWt = (totalWt / result.completed.length).toFixed(2);
    const util = ((totalBurst / totalTime) * 100).toFixed(2);

    document.getElementById("avg-tat").textContent = avgTat;
    document.getElementById("avg-wt").textContent = avgWt;
    document.getElementById("cpu-util").textContent = `${util}%`;
    document.getElementById("context-switches").textContent = result.contextSwitches;
    document.getElementById("idle-time").textContent = result.idleTime;
}
