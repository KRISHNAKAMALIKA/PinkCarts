
async function submitAuth(event, mode) {
    event.preventDefault();

    const message = document.getElementById("message");
    const button = event.submitter;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const body = { email, password };

    if (mode === "register") {
        body.name = document.getElementById("name").value.trim();
    }

    message.textContent = "Please wait...";
    button.disabled = true;

    try {
        const response = await fetch(`/api/auth/${mode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || data.error || "Unable to continue."
            );
        }

        if (!data.token) {
            throw new Error("The server did not return a login token.");
        }

        localStorage.setItem("pinkcarts_token", data.token);

        message.textContent =
            mode === "register"
                ? "Account created! Opening PinkCarts..."
                : "Login successful! Opening PinkCarts...";

        window.location.href = "index.html";

    } catch (error) {
        message.textContent =
            error.message || "Server connection failed.";
    } finally {
        button.disabled = false;
    }
}

document.getElementById("login-form")?.addEventListener(
    "submit",
    event => submitAuth(event, "login")
);

document.getElementById("register-form")?.addEventListener(
    "submit",
    event => submitAuth(event, "register")
);

function googleLogin() {
    document.getElementById("message").textContent =
        "Google login needs Google OAuth setup. It is not connected yet.";
}
