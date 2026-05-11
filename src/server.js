require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Import route modules
const indexRoutes = require("./routes/index");
const authRoutes = require("./routes/auth");
const productsRoutes = require("./routes/products");
const blogsRoutes = require("./routes/blogs");
const subscribersRoutes = require("./routes/subscribers");

const app = express();

app.use(cors());
app.use(express.json());

// Mount routes
app.use("/", indexRoutes);
app.use("/", authRoutes);
app.use("/products", productsRoutes);
app.use("/blogs", blogsRoutes);
app.use("/", subscribersRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("Server running");
});
