import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "HavestHub",
  password: "123456",
  port: 5432,
});
db.connect(err => {
  if (err) {
    console.error('Could not connect to the database', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const plotSize = req.body.plotSize;

  console.log(`Register attempt with email: ${email}, password: ${password}, plotSize: ${plotSize}`);

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      res.send("Email already exists. Try logging in.");
    } else {
      const result = await db.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING user_id",
        [email, password]
      );

      const newUserId = result.rows[0].user_id;
      console.log(`New user ID: ${newUserId}`);

      // Insert into the waiting table with the current timestamp
      const waitingResult = await db.query(
        "INSERT INTO waitings (user_id, request_date) VALUES ($1, CURRENT_TIMESTAMP)",
        [newUserId]
      );

      console.log(`Inserted into waiting table: ${waitingResult.rowCount} row(s)`);
      res.render("confirm.ejs");
    }
  } catch (err) {
    console.log(err);
    res.send("Error registering user");
  }
});

app.post("/login", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  console.log(`Login attempt with email: ${email} and password: ${password}`);

  try {
    // Query to get the user by email including the is_admin field
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedPassword = user.password;
      const isAdmin = user.is_admin; 

      if (password === storedPassword) {
        if (isAdmin) {
          res.render("admin.ejs");
        } else {
          res.render("user.ejs");
        }
      } else {
        res.send("Incorrect Password");
      }
    } else {
      res.send("User not found");
    }
  } catch (err) {
    console.log(err);
    res.send("Error during login");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
