```javascript
let authMode = "login";

function openAuth(mode) {
    authMode = mode;

    const overlay = document.getElementById("auth-overlay");
    const nameField = document.getElementById("name-field");
    const title = document.getElementById("auth-title");
    const description = document.getElementById("auth-description");
    const submit = document.getElementById("auth-submit");
    const switchText = document.getElementById("auth-switch");
    const password = document.getElementById("auth-password");
    const name = document.getElementById("auth-name");
    const message = document.getElementById("auth-message");

    overlay.classList.add("active");
    message.textContent = "";

    if (mode === "register") {
        title.textContent = "Create Your Account 💗";
        description.textContent = "Join the PinkCarts family!";
        submit.textContent = "Create Account";
        nameField.hidden = false;
        name.required = true;
        password.autocomplete = "new-password";
        switchText.innerHTML =
            'Already have an account? <button type="button" onclick="openAuth(\'login\')">Login</button>';
    } else {
        title.textContent = "Welcome Back 💗";
        description.textContent = "Login to your PinkCarts account";
        submit.textContent = "Login";
        nameField.hidden = true;
        name.required = false;
        password.autocomplete = "current-password";
        switchText.innerHTML =
            'New to PinkCarts? <button type="button" onclick="openAuth(\'register\')">Create Account</button>';
    }
}

function closeAuth() {
    document.getElementById("auth-overlay").classList.remove("active");
}

document.getElementById("auth-overlay").addEventListener("click", function (event) {
    if (event.target === this) closeAuth();
});

document.getElementById("auth-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const message = document.getElementById("auth-message");
    const submit = document.getElementById("auth-submit");

    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim();

    if (authMode === "register" && !name) {
        message.textContent = "Please enter your full name.";
        return;
    }

    submit.disabled = true;
    message.textContent = "Please wait...";

    try {
        const endpoint = authMode === "register"
            ? "/api/auth/register"
            : "/api/auth/login";

        const body = authMode === "register"
            ? { name, email, password }
            : { email, password };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || "Request failed.");
        }

        if (data.token) {
            localStorage.setItem("pinkcarts_token", data.token);
        }

        message.textContent = data.message ||
            (authMode === "register"
                ? "Account created successfully!"
                : "Login successful!");

        // Update the header after successful login or registration.
        const accountButtons = document.querySelector(".account-buttons");

        if (data.user && accountButtons) {
            accountButtons.innerHTML = `
                <span class="welcome-user">Hi, ${
                    String(data.user.name || "Shopper")
                        .replace(/[&<>"']/g, "")
                } 💗</span>
                <button class="account-button" onclick="logout()">Logout</button>
            `;
        }

        setTimeout(closeAuth, 1200);
    } catch (error) {
        message.textContent = error.message ||
            "Unable to connect. Check that your server is running.";
    } finally {
        submit.disabled = false;
    }
});

function logout() {
    localStorage.removeItem("pinkcarts_token");
    location.reload();
}
```
