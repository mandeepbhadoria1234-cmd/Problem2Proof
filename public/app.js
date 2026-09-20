const $ = (id) => document.getElementById(id);

let token = localStorage.getItem("p2p_token");
let user = null;

async function api(url, options = {}) {
    options.headers = options.headers || {};

    if (token) {
        options.headers.Authorization = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, options);

        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error("Server returned an invalid response.");
        }

        if (!response.ok) {
            throw new Error(data.message || "Request failed");
        }

        return data;

    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

async function doLogin() {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (!email || !password) {
        $("msg").textContent = "Enter email and password.";
        return;
    }

    $("msg").textContent = "Logging in...";

    try {
        const data = await api("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        token = data.token;
        localStorage.setItem("p2p_token", token);

        await openApp();

    } catch (error) {
        $("msg").textContent = error.message;
    }
}

async function registerStudent() {
    const name = $("name").value.trim();
    const email = $("re").value.trim();
    const password = $("rp").value;

    if (!name || !email || !password) {
        alert("Fill all student registration fields.");
        return;
    }

    try {
        await api("/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        alert("Student account created. Now login.");

        $("name").value = "";
        $("re").value = "";
        $("rp").value = "";

    } catch (error) {
        alert(error.message);
    }
}

async function openApp() {
    try {
        user = await api("/api/auth/me");
    } catch (error) {
        localStorage.removeItem("p2p_token");
        token = null;
        return;
    }

    $("login").style.display = "none";
    $("app").style.display = "block";

    $("welcome").textContent =
        `Logged in as ${user.name} (${user.role})`;

    if (user.role === "admin") {
        $("ab").style.display = "inline-block";
        page("admin");
    } else {
        page("home");
    }
}

function page(pageName) {
    document.querySelectorAll(".page").forEach((element) => {
        element.style.display = "none";
    });

    $(pageName).style.display = "block";

    if (pageName === "reports") {
        loadMine();
    }

    if (pageName === "notifications") {
        loadNotes();
    }

    if (pageName === "admin") {
        loadAdmin();
    }
}

async function submitReport() {
    const title = $("title").value.trim();
    const description = $("desc").value.trim();
    const location = $("loc").value.trim();
    const photo = $("photo");

    if (!title || !description) {
        alert("Title and description are required.");
        return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("description", description);
    formData.append("location", location);

    if (photo.files.length > 0) {
        formData.append("photo", photo.files[0]);
    }

    try {
        const data = await api("/api/reports", {
            method: "POST",
            body: formData
        });

        $("reportMsg").innerHTML =
            `Submitted successfully! Category: <b>${data.report.category}</b>
            | Department: <b>${data.report.department}</b>
            | Priority: <b>${data.report.priority}</b>`;

        $("title").value = "";
        $("desc").value = "";
        $("loc").value = "";
        $("photo").value = "";

    } catch (error) {
        alert(error.message);
    }
}

function safe(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[character];
    });
}

async function loadMine() {
    try {
        const reports = await api("/api/reports/mine");

        $("mine").innerHTML = reports.length
            ? reports.map((report) => `
                <div class="report">
                    <h3>#${report.id} ${safe(report.title)}</h3>
                    <p>${safe(report.description)}</p>
                    <span class="badge">${safe(report.category)}</span>
                    <span class="badge">${safe(report.status)}</span>
                    <p>Priority: <b>${report.priority}</b></p>
                    <p>${safe(report.ai_analysis)}</p>
                    ${
                        report.image
                        ? `<img src="${report.image}" width="300">`
                        : ""
                    }
                    ${
                        report.proof_image
                        ? `<p>Resolution Proof</p>
                           <img src="${report.proof_image}" width="300">`
                        : ""
                    }
                </div>
            `).join("")
            : "<p>No reports yet.</p>";

    } catch (error) {
        $("mine").innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadNotes() {
    try {
        const notifications = await api("/api/notifications");

        $("notes").innerHTML = notifications.length
            ? notifications.map((notification) => `
                <div class="report">
                    <p>${safe(notification.message)}</p>
                    <small>${safe(notification.created_at)}</small>
                </div>
            `).join("")
            : "<p>No notifications.</p>";

    } catch (error) {
        $("notes").innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadAdmin() {
    try {
        const stats = await api("/api/stats");
        const reports = await api("/api/reports");

        $("stats").innerHTML = `
            <div class="stats">
                <div><b>${stats.total}</b><br>Total</div>
                <div><b>${stats.pending}</b><br>Pending</div>
                <div><b>${stats.resolved}</b><br>Resolved</div>
            </div>
        `;

        $("all").innerHTML = reports.length
            ? reports.map((report) => `
                <div class="report">
                    <h3>#${report.id} ${safe(report.title)}</h3>
                    <p>${safe(report.description)}</p>

                    <p>
                        Student:
                        <b>${safe(report.student_name)}</b>
                    </p>

                    <span class="badge">${safe(report.category)}</span>
                    <span class="badge">${safe(report.department)}</span>
                    <span class="badge">${safe(report.status)}</span>

                    <p>
                        Priority:
                        <b>${report.priority}</b>
                    </p>

                    ${
                        report.image
                        ? `<img src="${report.image}" width="300"><br>`
                        : ""
                    }

                    ${
                        report.status !== "Resolved"
                        ? `
                            <button onclick="statusUpdate(${report.id})">
                                Start Work
                            </button>

                            <button onclick="resolveReport(${report.id})">
                                Resolve
                            </button>
                        `
                        : "<b>✓ Resolved</b>"
                    }
                </div>
            `).join("")
            : "<p>No reports yet.</p>";

    } catch (error) {
        $("all").innerHTML = `<p>${error.message}</p>`;
    }
}

async function statusUpdate(id) {
    try {
        await api(`/api/reports/${id}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: "In Progress"
            })
        });

        loadAdmin();

    } catch (error) {
        alert(error.message);
    }
}

async function resolveReport(id) {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";

    input.onchange = async function () {
        const formData = new FormData();

        if (input.files.length > 0) {
            formData.append("proof", input.files[0]);
        }

        try {
            await api(`/api/reports/${id}/resolve`, {
                method: "POST",
                body: formData
            });

            alert("Report resolved successfully.");
            loadAdmin();

        } catch (error) {
            alert(error.message);
        }
    };

    input.click();
}

function logout() {
    localStorage.removeItem("p2p_token");
    token = null;
    location.reload();
}

if (token) {
    openApp();
}