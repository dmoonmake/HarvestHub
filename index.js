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

  console.log(`Register attempt with email: ${email}, password: ${password}, plot_size: ${plotSize}`);

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
        "INSERT INTO waitings (user_id, request_date, plot_size) VALUES ($1, CURRENT_TIMESTAMP, $2)",
        [newUserId, plotSize]
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
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    console.log(result.rows);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedPassword = user.password;

      if (password === storedPassword) {

        if (user.is_admin) {
          // Fetch waiting list for the user from the database
          const waitingsResult = await db.query(`
          SELECT waitings.*, users.email, users.first_name, users.last_name 
          FROM waitings 
          JOIN users ON waitings.user_id = users.user_id
          ORDER BY waitings.request_date ASC`);
          // console.log(waitingsResult.rows);
          const waitings = waitingsResult.rows;

          // Fetch assign list for the user from the database
          const assignsResult = await db.query(`
          SELECT plots.plot_location, plots.plot_id, plots.plot_size, assignments.*, users.email, users.first_name, users.last_name
          FROM plots
          LEFT JOIN assignments ON plots.plot_id = assignments.plot_id
          LEFT JOIN users ON assignments.user_id = users.user_id
          ORDER BY plots.plot_location ASC
        `);
          // console.log(assignsResult.rows);
          const assigns = assignsResult.rows;
          
          // Render the user.ejs template with user details, waiting list, and assign list
          res.render("admin.ejs", { user, waitings, assigns });

        } else {
          // Fetch waiting list for the user from the database
          const waitingsResult = await db.query("SELECT * FROM waitings WHERE user_id = $1", [user.user_id]);
          console.log(waitingsResult.rows);
          const waitings = waitingsResult.rows;

          // Fetch assign list for the user from the database
          const assignsResult = await db.query("SELECT * FROM assignments WHERE user_id = $1",[user.user_id]);
          console.log(assignsResult.rows);
          const assigns = assignsResult.rows;

          // Render the user.ejs template with user details, waiting list, and assign list
          res.render("user.ejs", { user, waitings, assigns });
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

app.post("/assign-plot", async (req, res) => {
  const { plot_location, admin_email, user_id } = req.body;

  try {
    // Get plot ID based on plot location
    const plotResult = await db.query("SELECT plot_id FROM plots WHERE plot_location = $1", [plot_location]);
    const plot_id = plotResult.rows[0].plot_id;
    const result = await db.query("SELECT * FROM users WHERE email = $1", [admin_email]);
    const user = result.rows[0];
    console.log(user);

    // Insert assignment into the database
    await db.query("INSERT INTO assignments (plot_id, user_id, status) VALUES ($1, $2, 'Pending')", [plot_id, user_id]);

    // Remove user from waiting list
    await db.query("DELETE FROM waitings WHERE user_id = $1", [user_id]);

    // // Fetch updated user
    //     const users = await db.query(`
    //     SELECT waitings.*, users.email, users.first_name, users.last_name 
    //     FROM waitings 
    //     JOIN users ON waitings.user_id = users.user_id
    //     ORDER BY waitings.request_date ASC`);
    // const waitings = waitingsResult.rows;

    // Fetch updated list of waitings
        const waitingsResult = await db.query(`
        SELECT waitings.*, users.email, users.first_name, users.last_name 
        FROM waitings 
        JOIN users ON waitings.user_id = users.user_id
        ORDER BY waitings.request_date ASC`);
      const waitings = waitingsResult.rows;

    // Fetch updated list of assignments
    const assignsResult = await db.query(`
      SELECT plots.plot_location, plots.plot_size, assignments.*, users.email, users.first_name, users.last_name
      FROM plots
      LEFT JOIN assignments ON plots.plot_id = assignments.plot_id
      LEFT JOIN users ON assignments.user_id = users.user_id
      ORDER BY plots.plot_location ASC
    `);
    const assigns = assignsResult.rows;

    res.render("admin.ejs", { user, waitings, assigns });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error assigning plot" });
  }
});

// app.get("/admin", async (req, res) => {
//   try {
//     // Fetch waiting list for the admin from the database
//     const waitingsResult = await db.query(`
//     SELECT waitings.*, users.email, users.first_name, users.last_name 
//     FROM waitings 
//     JOIN users ON waitings.user_id = users.user_id
//     ORDER BY waitings.request_date ASC`);
//     // console.log(waitingsResult.rows);
//     const waitings = waitingsResult.rows;

//     // Fetch assign list for the admin from the database
//     const assignsResult = await db.query(`
//     SELECT plots.plot_location, plots.plot_id, plots.plot_size, assignments.*, users.email, users.first_name, users.last_name
//     FROM plots
//     LEFT JOIN assignments ON plots.plot_id = assignments.plot_id
//     LEFT JOIN users ON assignments.user_id = users.user_id
//     ORDER BY plots.plot_location ASC
//   `);
//     // console.log(assignsResult.rows);
//     const assigns = assignsResult.rows;

//     // Render the admin.ejs template with admin details, waiting list, and assign list
//     res.render("admin.ejs", { user: req.user, waitings, assigns });
//   } catch (err) {
//     console.log(err);
//     res.send("Error loading admin dashboard");
//   }
// });

app.get("/admin", async (req, res) => {
  try {
    // Fetch admin user details (assuming you have a table named 'users' where you store admin details)
    const adminResult = await db.query("SELECT * FROM users WHERE is_admin = true");
    const admin = adminResult.rows[0];

    // Fetch waiting list for the admin from the database
    const waitingsResult = await db.query(`
      SELECT waitings.*, users.email, users.first_name, users.last_name 
      FROM waitings 
      JOIN users ON waitings.user_id = users.user_id
      ORDER BY waitings.request_date ASC
    `);
    const waitings = waitingsResult.rows;

    // Fetch assign list for the admin from the database
    const assignsResult = await db.query(`
      SELECT plots.plot_location, plots.plot_size, assignments.*, users.email, users.first_name, users.last_name
      FROM plots
      LEFT JOIN assignments ON plots.plot_id = assignments.plot_id
      LEFT JOIN users ON assignments.user_id = users.user_id
      ORDER BY plots.plot_location ASC
    `);
    const assigns = assignsResult.rows;

    // Render the admin.ejs template with admin details, waiting list, and assign list
    res.render("admin.ejs", { admin, waitings, assigns });
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});






app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
