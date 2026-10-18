
const products = [
    { id: 1, name: "Pink Handbag", price: 799, emoji: "👜" },
    { id: 2, name: "Cute Sneakers", price: 1299, emoji: "👟" },
    { id: 3, name: "Beauty Kit", price: 599, emoji: "💄" },
    { id: 4, name: "Classic Watch", price: 999, emoji: "⌚" },
    { id: 5, name: "Headphones", price: 1499, emoji: "🎧" },
    { id: 6, name: "Teddy Bear", price: 499, emoji: "🧸" },
    { id: 7, name: "Stylish Sunglasses", price: 399, emoji: "🕶️" },
    { id: 8, name: "Gift Box", price: 699, emoji: "🎁" }
];

let cart = JSON.parse(localStorage.getItem("pinkcart-cart") || "[]");

function renderProducts() {
    const grid = document.getElementById("products-grid");

    grid.innerHTML = products.map(product => `
        <article class="product-card">
            <div class="product-image">${product.emoji}</div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>₹${product.price.toLocaleString("en-IN")}</p>
                <button class="add-button"
                    onclick="addToCart(${product.id})">
                    Add to Cart +
                </button>
            </div>
        </article>
    `).join("");
}

function saveCart() {
    localStorage.setItem("pinkcart-cart", JSON.stringify(cart));
    renderCart();
}

function addToCart(id) {
    const item = cart.find(product => product.id === id);

    if (item) {
        item.quantity++;
    } else {
        const product = products.find(product => product.id === id);
        cart.push({ ...product, quantity: 1 });
    }

    saveCart();
    alert("Product added to your cart!");
}

function changeQuantity(id, amount) {
    const item = cart.find(product => product.id === id);

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        cart = cart.filter(product => product.id !== id);
    }

    saveCart();
}

function renderCart() {
    const container = document.getElementById("cart-items");
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
    );

    document.getElementById("cart-count").textContent = count;
    document.getElementById("cart-total").textContent =
        total.toLocaleString("en-IN");

    if (cart.length === 0) {
        container.innerHTML = "<p>Your cart is empty. Start shopping! 💗</p>";
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div>
                <strong>${item.emoji} ${item.name}</strong>
                <p>₹${item.price.toLocaleString("en-IN")} each</p>
            </div>
            <div class="quantity-controls">
                <button onclick="changeQuantity(${item.id}, -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="changeQuantity(${item.id}, 1)">+</button>
            </div>
        </div>
    `).join("");
}

function toggleCart() {
    document.getElementById("cart-panel").classList.add("open");
    document.getElementById("cart-overlay").classList.add("show");
}

function closeCart() {
    document.getElementById("cart-panel").classList.remove("open");
    document.getElementById("cart-overlay").classList.remove("show");
}

function checkout() {
    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
    );

    alert(
        "Demo order placed successfully! 💗\n" +
        "Total: ₹" + total.toLocaleString("en-IN") +
        "\nThis is a frontend demo, not a real order."
    );

    cart = [];
    saveCart();
    closeCart();
}

renderProducts();
renderCart();
