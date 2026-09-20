const $ = (id) =>
    document.getElementById(id);

let token =
    localStorage.getItem("p2p_token");

let currentUser = null;


/* ================= API ================= */

async function api(url, options = {}) {

    options.headers =
        options.headers || {};

    if (token) {

        options.headers.Authorization =
            `Bearer ${token}`;
    }

    const response =
        await fetch(url, options);

    const contentType =
        response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {

        data = await response.json();

    } else {

        data = {
            message: await response.text()
        };
    }

    if (!response.ok) {

        throw new Error(
            data.message || "Request failed"
        );
    }

    return data;
}


/* ================= PAGE ================= */

function page(name) {

    document
        .querySelectorAll(".page")
        .forEach(section => {
            section.hidden = true;
        });

    const selected =
        $(name);

    if (selected) {
        selected.hidden = false;
    }


    if (name === "mine") {

        loadMyReports();
    }


    if (name === "admin") {

        loadAdminDashboard();
    }


    if (name === "colleges") {

        filterColleges();
    }
}


/* ================= LOGIN ================= */

async function login() {

    try {

        const email =
            $("email").value.trim();

        const password =
            $("password").value;

        if (!email || !password) {

            throw new Error(
                "Email and password required"
            );
        }


        const data =
            await api(
                "/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );


        token = data.token;

        currentUser =
            data.user;

        localStorage.setItem(
            "p2p_token",
            token
        );


        openApp();

    } catch (error) {

        showMessage(
            "authMsg",
            error.message,
            true
        );
    }
}


/* ================= REGISTER ================= */

async function registerStudent() {

    try {

        const name =
            $("regName").value.trim();

        const email =
            $("regEmail").value.trim();

        const password =
            $("regPassword").value;


        const data =
            await api(
                "/api/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        name,
                        email,
                        password
                    })
                }
            );


        token =
            data.token;

        currentUser =
            data.user;


        localStorage.setItem(
            "p2p_token",
            token
        );


        openApp();

    } catch (error) {

        showMessage(
            "authMsg",
            error.message,
            true
        );
    }
}


/* ================= OPEN APP ================= */

async function openApp() {

    try {

        if (!currentUser) {

            const data =
                await api("/api/me");

            currentUser =
                data.user;
        }


        $("loginView").hidden = true;

        $("appView").hidden = false;


        $("adminNav").hidden =
            currentUser.role !== "admin";


        page("home");

    } catch (error) {

        logout();
    }
}


/* ================= LOGOUT ================= */

function logout() {

    localStorage.removeItem(
        "p2p_token"
    );

    location.reload();
}


/* ================= SUBMIT REPORT ================= */

async function submitReport() {

    try {

        const formData =
            new FormData();


        formData.append(
            "title",
            $("rTitle").value.trim()
        );


        formData.append(
            "description",
            $("rDesc").value.trim()
        );


        formData.append(
            "location",
            $("rLocation").value.trim()
        );


        formData.append(
            "reach",
            $("rReach").value
        );


        const image =
            $("rImage").files[0];


        if (image) {

            formData.append(
                "image",
                image
            );
        }


        const data =
            await api(
                "/api/reports",
                {
                    method: "POST",
                    body: formData
                }
            );


        showMessage(
            "reportMsg",
            `Report submitted successfully! Category: ${data.report.category} | Priority: ${data.report.priority}`,
            false
        );


        $("rTitle").value = "";

        $("rDesc").value = "";

        $("rLocation").value = "";

        $("rImage").value = "";


    } catch (error) {

        showMessage(
            "reportMsg",
            error.message,
            true
        );
    }
}


/* ================= MY REPORTS ================= */

async function loadMyReports() {

    try {

        const data =
            await api(
                "/api/reports/mine"
            );


        if (!data.reports.length) {

            $("myReports").innerHTML =
                `<div class="card">
                    No reports yet.
                 </div>`;

        } else {

            $("myReports").innerHTML =
                data.reports
                    .map(createReportCard)
                    .join("");
        }


        const notificationData =
            await api(
                "/api/notifications"
            );


        if (!notificationData.notifications.length) {

            $("notifications").innerHTML =
                `<div class="card">
                    No notifications.
                 </div>`;

        } else {

            $("notifications").innerHTML =
                notificationData.notifications
                    .map(notification => `
                        <div class="card">

                            ${escapeHTML(
                                notification.message
                            )}

                            <br>

                            <small>
                                ${escapeHTML(
                                    notification.created_at
                                )}
                            </small>

                        </div>
                    `)
                    .join("");
        }

    } catch (error) {

        $("myReports").innerHTML =
            `<div class="card err">
                ${escapeHTML(
                    error.message
                )}
            </div>`;
    }
}


/* ================= REPORT CARD ================= */

function createReportCard(report) {

    return `

        <div class="report">

            <h3>
                #${report.id}
                —
                ${escapeHTML(
                    report.title
                )}
            </h3>


            <p>
                ${escapeHTML(
                    report.description
                )}
            </p>


            <p>

                <b>Status:</b>
                ${escapeHTML(
                    report.status
                )}

                <br>

                <b>Priority:</b>
                ${escapeHTML(
                    report.priority
                )}

                <br>

                <b>Category:</b>
                ${escapeHTML(
                    report.category
                )}

                <br>

                <b>Department:</b>
                ${escapeHTML(
                    report.department
                )}

                <br>

                <b>Severity:</b>
                ${escapeHTML(
                    report.severity
                )}

            </p>


            ${
                report.image
                ?
                `<p>
                    <b>Evidence:</b><br>
                    <img
                        src="${report.image}"
                        width="250">
                 </p>`
                :
                ""
            }


            ${
                report.proof_image
                ?
                `<p>
                    <b>Resolution Proof:</b><br>
                    <img
                        src="${report.proof_image}"
                        width="250">
                 </p>`
                :
                ""
            }


            ${
                report.proof_note
                ?
                `<p>
                    <b>Proof Note:</b>
                    ${escapeHTML(
                        report.proof_note
                    )}
                 </p>`
                :
                ""
            }

        </div>

    `;
}


/* ================= ADMIN ================= */

async function loadAdminDashboard() {

    try {

        const stats =
            await api(
                "/api/admin/stats"
            );


        $("stats").innerHTML =
            Object.entries(
                stats.stats
            )
            .map(
                ([key, value]) => `

                    <div class="card">

                        <small>
                            ${key.toUpperCase()}
                        </small>

                        <h2>
                            ${value}
                        </h2>

                    </div>

                `
            )
            .join("");


        const data =
            await api(
                "/api/admin/reports"
            );


        $("adminReports").innerHTML =
            data.reports.length
            ?
            data.reports
                .map(createAdminReport)
                .join("")
            :
            `<div class="card">
                No reports available.
             </div>`;


    } catch (error) {

        $("adminReports").innerHTML =
            `<div class="card err">
                ${escapeHTML(
                    error.message
                )}
             </div>`;
    }
}


/* ================= ADMIN REPORT ================= */

function createAdminReport(report) {

    return `

        <div class="report">

            <h3>
                #${report.id}
                —
                ${escapeHTML(
                    report.title
                )}
            </h3>


            <p>
                ${escapeHTML(
                    report.description
                )}
            </p>


            <p>

                <b>Student:</b>
                ${escapeHTML(
                    report.user_name
                )}

                <br>

                <b>Category:</b>
                ${escapeHTML(
                    report.category
                )}

                <br>

                <b>Priority:</b>
                ${escapeHTML(
                    report.priority
                )}

            </p>


            <select
                id="status-${report.id}">

                ${[
                    "Submitted",
                    "Under Review",
                    "In Progress",
                    "Resolved"
                ]
                .map(status => `
                    <option
                        ${
                            status === report.status
                            ? "selected"
                            : ""
                        }>

                        ${status}

                    </option>
                `)
                .join("")}

            </select>


            <input
                id="note-${report.id}"
                placeholder="Admin note">


            <button
                onclick="updateStatus(${report.id})">

                Update Status

            </button>


            <br><br>


            <label>
                Resolution Proof
            </label>


            <input
                id="proof-${report.id}"
                type="file"
                accept="image/*">


            <button
                class="secondary"
                onclick="addProof(${report.id})">

                Add Resolution Proof

            </button>

        </div>

    `;
}


/* ================= UPDATE STATUS ================= */

async function updateStatus(id) {

    try {

        const status =
            $(`status-${id}`).value;

        const note =
            $(`note-${id}`).value;


        await api(
            `/api/admin/reports/${id}`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    status,
                    admin_note: note
                })
            }
        );


        loadAdminDashboard();

    } catch (error) {

        alert(
            error.message
        );
    }
}


/* ================= PROOF ================= */

async function addProof(id) {

    try {

        const formData =
            new FormData();


        const file =
            $(`proof-${id}`).files[0];


        if (file) {

            formData.append(
                "proof",
                file
            );
        }


        formData.append(
            "proof_note",
            "Resolution proof added by admin."
        );


        await api(
            `/api/admin/reports/${id}/proof`,
            {
                method: "POST",
                body: formData
            }
        );


        loadAdminDashboard();

    } catch (error) {

        alert(
            error.message
        );
    }
}


/* ================= COLLEGES ================= */

const colleges = [

    "Government Engineering College Banka",

    "Government Engineering College Bhagalpur",

    "Government Engineering College Gaya",

    "Government Engineering College Jamui",

    "Government Engineering College Jehanabad",

    "Government Engineering College Madhubani",

    "Government Engineering College Nawada",

    "Government Engineering College Siwan",

    "Government Engineering College West Champaran (Bettiah)",

    "Government Engineering College Sheohar",

    "Government Engineering College Vaishali",

    "Shri Phanishwar Nath Renu Engineering College, Araria"

];


function filterColleges() {

    const search =
        (
            $("collegeSearch")?.value ||
            ""
        )
        .toLowerCase();


    const results =
        colleges.filter(
            college =>
                college
                    .toLowerCase()
                    .includes(search)
        );


    $("collegeGrid").innerHTML =
        results
            .map(
                college => `

                    <div class="card">

                        <h3>
                            ${escapeHTML(
                                college
                            )}
                        </h3>

                        <p>
                            B.Tech
                        </p>

                    </div>

                `
            )
            .join("");
}


/* ================= HELPERS ================= */

function showMessage(
    elementId,
    message,
    error
) {

    const element =
        $(elementId);

    element.textContent =
        message;

    element.className =
        error
        ? "err"
        : "ok";
}


function escapeHTML(value) {

    return String(value)
        .replace(
            /[&<>"']/g,
            character => {

                const map = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                };

                return map[character];
            }
        );
}


/* ================= AUTO LOGIN ================= */

if (token) {

    openApp();
}