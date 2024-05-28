import express from "express";
import pg from "pg";

const app = express();
const port = 3000;

// DB Configurations
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "HarvestHub",
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

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Helper function to fetch user by email
const fetchUserByEmail = async (email) => {
  const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0];
};

// Helper function to fetch user by user_id
const fetchUserByUserID = async (user_id) => {
  const result = await db.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
  return result.rows[0];
};

// Helper function to fetch waitings by user
const fetchWaitingsByUser = async (user_id) => {
  try {
    const result = await db.query("SELECT * FROM waitings WHERE user_id = $1 ORDER BY request_date ASC", [user_id]);
    const waitings = result.rows;
    
    // Fetch all waitings to calculate the rank correctly
    const allWaitingsResult = await db.query("SELECT * FROM waitings ORDER BY request_date ASC");
    const allWaitings = allWaitingsResult.rows;

    // Calculate rank for each waiting and update the waitings array
    const rankedWaitings = waitings.map(waiting => ({
      ...waiting,
      rank: calculateRank(waiting.plot_size, allWaitings).find(w => w.waiting_id === waiting.waiting_id).rank
    }));

    return rankedWaitings;
  } catch (err) {
    console.error(err);
    throw new Error("Error fetching waitings by user ID");
  }
};

// Helper function to fetch ALL waitings by user
const fetchAllWaitingsByUser = async () => {
  try {
    const result = await db.query(`

      SELECT waitings.*, users.email, users.first_name, users.last_name, assignments.assignment_id, assignments.user_id AS assignment_user_id, assignments.assigned_date, assignments.status, plots.plot_location
      FROM waitings
      LEFT JOIN users ON waitings.user_id = users.user_id
      LEFT JOIN assignments ON waitings.user_id = assignments.user_id AND (assignments.status = 'Pending' OR assignments.status IS NULL)
      LEFT JOIN plots ON assignments.plot_id = plots.plot_id
      ORDER BY waitings.request_date ASC;
  ` );
    const waitings = result.rows;

    // Fetch all waitings to calculate the rank correctly
    const allWaitingsResult = await db.query("SELECT * FROM waitings ORDER BY request_date ASC");
    const allWaitings = allWaitingsResult.rows;

    // Calculate rank for each waiting and update the waitings array
    const rankedWaitings = waitings.map(waiting => ({
      ...waiting,
      rank: calculateRank(waiting.plot_size, allWaitings).find(w => w.waiting_id === waiting.waiting_id).rank
    }));

    return rankedWaitings;
  } catch (err) {
    console.error(err);
    throw new Error("Error fetching waitings by user ID");
  }
}; 

// Helper function to fetch assignments by user
const fetchAssignmentsByUser = async (user_id) => {
  const result = await db.query("SELECT assignments.*, plots.plot_location FROM assignments LEFT JOIN plots on plots.plot_id = assignments.plot_id WHERE user_id = $1", [user_id]);
  return result.rows;
};

// Helper function to fetch ALL assignments by user and plot 
const fetchAllAssignmentsByUser = async () => {
  const result = await db.query(`
    SELECT plots.plot_location, plots.plot_size, assignments.*, users.email, users.first_name, users.last_name, users.user_id
    FROM plots
    LEFT JOIN assignments ON plots.plot_id = assignments.plot_id
    LEFT JOIN users ON assignments.user_id = users.user_id
    ORDER BY plots.plot_location ASC
  `);
  return result.rows;
};

// Helper function to categorise waitings by plot size
const categoriseWaitingsByPlotSize = (waitings) => {
  const smallWaitings = waitings.filter(waiting => waiting.plot_size === 'small');
  const mediumWaitings = waitings.filter(waiting => waiting.plot_size === 'medium');
  const largeWaitings = waitings.filter(waiting => waiting.plot_size === 'large');
  return { smallWaitings, mediumWaitings, largeWaitings };
};

// Helper function to calculate rank by plot size
const calculateRank = (plot_size, allWaitings) => {
  const filteredWaitings = allWaitings.filter(waiting => waiting.plot_size === plot_size);
  return filteredWaitings.map((waiting, index) => ({
    ...waiting,
    rank: index + 1
  }));
};

// Function to render user or admin page based on the user type
async function renderUserPage(user, res) {
  if (user.is_admin) {
    // Fetch waitings and assignments for admin
    const waitings = await fetchAllWaitingsByUser();
    const { smallWaitings, mediumWaitings, largeWaitings } = categoriseWaitingsByPlotSize(waitings);
    const assigns = await fetchAllAssignmentsByUser();

    res.render("admin.ejs", { user, waitings, smallWaitings, mediumWaitings, largeWaitings, assigns });
  
  } else {
    // Fetch waitings and assignments for regular user
    const waitings = await fetchWaitingsByUser(user.user_id);
    const assigns = await fetchAssignmentsByUser(user.user_id);

    res.render("user.ejs", { user, waitings, assigns });
  }
};

// Route to render homepage
app.get("/", (req, res) => {
  res.render("home.ejs", { user: req.user });
});


// Route to render register page
app.get("/register", (req, res) => {
  res.render("register.ejs", { user: req.user });
});

// Route to render login page
app.get("/login", (req, res) => {
  res.render("login.ejs", { user: req.user });
});

// Route to render admin page
app.get("/admin", async (req, res) => {
  try {
    const adminResult = await db.query("SELECT * FROM users WHERE is_admin = true");
    const admin = adminResult.rows[0];

    const waitings = await fetchAllWaitingsByUser();
    const { smallWaitings, mediumWaitings, largeWaitings } = categoriseWaitingsByPlotSize(waitings);
    const assigns = await fetchAllAssignmentsByUser();

    res.render("admin.ejs", { admin, user: req.user, waitings, smallWaitings, mediumWaitings, largeWaitings, assigns });
    
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});

// Route for user registration
app.post("/register", async (req, res) => {
  const first_name = req.body.first_name;
  const last_name = req.body.last_name;
  const email = req.body.email;
  const password = req.body.password;
  const plot_size = req.body.plot_size;

  console.log(`Register attempt with first name: ${first_name}, last name: ${last_name}, email: ${email}, password: ${password}, plot_size: ${plot_size}`);

  try {
    const existingUser = await fetchUserByEmail(email);

    if (existingUser) {
      res.send("Email already exists. Try logging in.");
    } else {
      const result = await db.query(
        "INSERT INTO users (first_name, last_name, email, password) VALUES ($1, $2, $3, $4) RETURNING user_id",
        [first_name, last_name, email, password]
      );

      const newUserId = result.rows[0].user_id;
      console.log(`New user ID: ${newUserId}`);

      await db.query(
        "INSERT INTO waitings (user_id, request_date, plot_size) VALUES ($1, CURRENT_TIMESTAMP, $2)",
        [newUserId, plot_size]
      );

      console.log(`Inserted into waiting table`);
      res.render("confirm.ejs");
    }
  } catch (err) {
    console.log(err);
    res.send("Error registering user");
  }
});

// Route for user login
app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  console.log(`Login attempt with email: ${email} and password: ${password}`);

  try {
    const user = await fetchUserByEmail(email);

    if (user) {
      if (password === user.password) {
        await renderUserPage(user, res);
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

// Route for user logout
app.get("/logout", (req, res) => {
  res.clearCookie('user'); 
  res.redirect("/");
});


// Route for user update email
app.post("/update-email", async (req, res) => {
  const new_email = req.body.new_email;
  const user_id = req.body.user_id;

  console.log(`Update email attempt with user_id: ${user_id}, new email: ${new_email}`);

  try {
    const user = await fetchUserByUserID(user_id);
    const checkedResult = await db.query(
      "SELECT * FROM users WHERE email = $1", [new_email]);

    // Check if email is already exists.
    if (new_email === user.email) {
      res.send("Email already exists. Try with a new email.");
    } else if (checkedResult.length > 0 ) {
      res.send("Email already exists. Try with a new email.");
    } else {
      await db.query("UPDATE users SET email = $1 WHERE user_id = $2", [new_email, user_id]);
      console.log(`Email is updated`);
      res.render("confirm.ejs");
    }
  } catch (err) {
    console.log(err);
    res.send("Error on update user email");
  }
});

// Route for user create waiting request
app.post("/create-waiting", async (req, res) => {
  const email = req.body.email;
  const plot_size = req.body.plot_size;

  console.log(`Register a plot attempt with email: ${email}, plot_size: ${plot_size}`);

  try {
    const user = await fetchUserByEmail(email);

    // Check if there is already a request for the same plot size
    const existingRequest = await db.query(
      "SELECT * FROM waitings WHERE user_id = $1 AND plot_size = $2",
      [user.user_id, plot_size]
    );

    if (existingRequest.rows.length > 0) {
      console.log(`User already has a request for a ${plot_size} plot`);
      res.send(`You already have a request for a ${plot_size} plot.`);
    } else {
      // Insert new waiting request if no existing request found
      await db.query(
        "INSERT INTO waitings (user_id, request_date, plot_size) VALUES ($1, CURRENT_TIMESTAMP, $2)",
        [user.user_id, plot_size]
      );
      console.log(`Inserted into waiting table`);

      await renderUserPage(user, res);
    }
  } catch (err) {
    console.log(err);
    res.send("Error on create waiting request");
  }
});

// Route for user remove waiting request
app.post("/remove-waiting", async (req, res) => {
  const user_id = req.body.user_id;
  const waiting_id = req.body.waiting_id;

  console.log(`Remove a request attempt with user id: ${user_id}, waiting_id: ${waiting_id}`);

  try {
    const user = await fetchUserByUserID(user_id);
    await db.query("DELETE FROM waitings WHERE user_id = $1 AND waiting_id = $2", [user_id, waiting_id]);
    
    console.log(`Removed from the waiting table`);

    await renderUserPage(user, res);
  } catch (err) {
    console.log(err);
    res.send("Error on remove waiting request");
  }
});

// Route for user confirm assignment
app.post("/confirm-assignment", async (req, res) => {
  const email = req.body.email;
  const assignment_id = req.body.assignment_id;

  console.log(`Confirm with email: ${email}, assignement ID: ${assignment_id}`);

  try {
    const user = await fetchUserByEmail(email);

    await db.query("UPDATE assignments SET status = 'Active' WHERE assignment_id = $1", [assignment_id]);
    console.log(`Updated Status at assinment table`);
    
    await renderUserPage(user, res);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error on confirm assignment");
  }
});

// Route for admin create assignment
app.post("/create-assignment", async (req, res) => {
  const { plot_location, admin_email, user_id } = req.body;

  console.log(`create-assignment with plot_location: ${plot_location}, admin_email: ${admin_email}, user_id: ${user_id}`);

  try {
    // Check if the user already has a pending assignment
    const existingAssignment = await db.query(
      "SELECT * FROM assignments WHERE user_id = $1 AND status = 'Pending'",
      [user_id]
    );
    console.log(existingAssignment);

    if (existingAssignment.rows.length > 0) {
      res.send("User already has a pending assignment.");
    } else {
      // Fetch the plot ID
      const plotResult = await db.query("SELECT plot_id FROM plots WHERE plot_location = $1", [plot_location]);
      console.log(plotResult);

      if (plotResult.rows.length === 0) {
        res.status(400).send("Invalid plot location.");
        return;
      }

      const plot_id = plotResult.rows[0].plot_id;

      // Create the assignment
      await db.query("INSERT INTO assignments (plot_id, user_id, status) VALUES ($1, $2, 'Pending')", [plot_id, user_id]);

      const user = await fetchUserByEmail(admin_email);
      await renderUserPage(user, res);
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error on create assignment" });
  }
});

// Route for admin completed assignment (No longer active i.e. preriod of assigment is completed)
app.post("/complete-assignment", async (req, res) => {
  const { assignment_id, admin_email } = req.body;
  console.log(`Complete assignment with email: ${admin_email}, assignment_id: ${assignment_id}`);

  try {
    await db.query("UPDATE assignments SET status = 'Completed' WHERE assignment_id = $1", [assignment_id]);
    console.log("update status to 'completed' from assignments table");

    const user = await fetchUserByEmail(admin_email);
    await renderUserPage(user, res);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error on remove assignment");
  }
});

// Route for admin remove assignment (after completed)
app.post("/remove-assignment", async (req, res) => {
  const { assignment_id, admin_email } = req.body;
  console.log(`Remove assignment with email: ${admin_email}, assignment_id: ${assignment_id}`);

  try {
    await db.query("DELETE FROM assignments WHERE assignment_id = $1", [assignment_id]);
    console.log("Removed assignment from assignments table");

    const user = await fetchUserByEmail(admin_email);
    await renderUserPage(user, res);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error on remove assignment");
  }
});

// oute for admin extend assignment (after completed )
app.post("/extend-assignment", async (req, res) => {
  const { assignment_id, admin_email } = req.body;
  console.log(`Extend assignment with email: ${admin_email}, assignment_id: ${assignment_id}`);

  try {
    await db.query("UPDATE assignments SET status = 'Active' WHERE assignment_id = $1", [assignment_id]);
    console.log("Update status to 'Active' at assignments table");

    const user = await fetchUserByEmail(admin_email);
    await renderUserPage(user, res);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error on extend assignment");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});