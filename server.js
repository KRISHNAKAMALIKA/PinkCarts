
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "purplecart",
  waitForConnections: true,
  connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Please add JWT_SECRET to your .env file");
}

function createToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "2h" });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Please log in again." });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

// Check server and database
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "OK", database: "connected" });
  } catch (error) {
    res.status(500).json({ message: "Database connection failed." });
  }
});

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const [products] = await pool.query(
      "SELECT * FROM products ORDER BY id DESC"
    );
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load products." });
  }
});

// Register a user
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({
      message: "Enter your name, email, and password (at least 8 characters)."
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), hashedPassword]
    );

    const user = {
      id: result.insertId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: "user"
    };

    res.status(201).json({
      token: createToken(user),
      user
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already registered." });
    }
    console.error(error);
    res.status(500).json({ message: "Registration failed." });
  }
});

// Log in
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [String(email || "").trim().toLowerCase()]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(password || "", rows[0].password_hash))
    ) {
      return res.status(401).json({
        message: "Incorrect email or password."
      });
    }

    const row = rows[0];
    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role
    };

    res.json({ token: createToken(user), user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed." });
  }
});

// Get logged-in user
app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Place a demo order
app.post("/api/orders", authenticate, async (req, res) => {
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Your cart is empty." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let total = 0;
    const selectedProducts = [];

    for (const item of items) {
      const id = Number(item.id);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(id) || !Number.isInteger(quantity) ||
          quantity < 1 || quantity > 99) {
        throw new Error("Invalid product or quantity.");
      }

      const [rows] = await connection.query(
        "SELECT id, name, price, stock FROM products WHERE id = ? FOR UPDATE",
        [id]
      );

      if (!rows.length) throw new Error("Product not found.");

      const product = rows[0];

      if (product.stock < quantity) {
        throw new Error("Not enough stock for " + product.name);
      }

      total += Number(product.price) * quantity;
      selectedProducts.push({ ...product, quantity });
    }

    const [order] = await connection.query(
      "INSERT INTO orders (user_id, total) VALUES (?, ?)",
      [req.user.id, total.toFixed(2)]
    );

    for (const product of selectedProducts) {
      await connection.query(
        `INSERT INTO order_items
        (order_id, product_id, product_name, quantity, unit_price)
        VALUES (?, ?, ?, ?, ?)`,
        [
          order.insertId,
          product.id,
          product.name,
          product.quantity,
          product.price
        ]
      );

      await connection.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [product.quantity, product.id]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Demo order placed successfully.",
      orderId: order.insertId,
      total
    });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ message: error.message });
  } finally {
    connection.release();
  }
});

// View your orders
app.get("/api/orders/mine", authenticate, async (req, res) => {
  try {
    const [orders] = await pool.query(
      "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC",
      [req.user.id]
    );

    for (const order of orders) {
      const [items] = await pool.query(
        "SELECT product_name, quantity, unit_price FROM order_items WHERE order_id = ?",
        [order.id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Could not load orders." });
  }
});

// Admin: add a product
app.post("/api/admin/products", authenticate, adminOnly, async (req, res) => {
  const { name, description = "", price, image_url = "", stock = 0 } = req.body;
  const amount = Number(price);
  const quantity = Number(stock);

  if (!name || !Number.isFinite(amount) || amount <= 0 ||
      !Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ message: "Check product details." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO products (name, description, price, image_url, stock)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), description, amount, image_url, quantity]
    );

    res.status(201).json({
      message: "Product added.",
      id: result.insertId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not add product." });
  }
});

// Admin: update order status
app.patch(
  "/api/admin/orders/:id/status",
  authenticate,
  adminOnly,
  async (req, res) => {
    const allowed = [
      "Pending", "Processing", "Shipped", "Delivered", "Cancelled"
    ];

    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    try {
      const [result] = await pool.query(
        "UPDATE orders SET status = ? WHERE id = ?",
        [req.body.status, Number(req.params.id)]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: "Order not found." });
      }

      res.json({ message: "Order status updated." });
    } catch (error) {
      res.status(500).json({ message: "Could not update status." });
    }
  }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`PurpleCart running at http://localhost:${PORT}`);
});
