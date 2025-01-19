const expres = require("express");
const app = expres();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;

// MIDLEWARE
app.use(cors());
app.use(expres.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.krhx2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  const sessionCollection = client
    .db("collaborativeStudyPaltform")
    .collection("session");
  const userCollection = client
    .db("collaborativeStudyPaltform")
    .collection("users");
  const notesCollection = client
    .db("collaborativeStudyPaltform")
    .collection("notes");
  try {
    // ================================
    // session api
    // ===============================

    app.get("/session", async (req, res) => {
      const tutorEmail = req.query.tutorEmail; // Query parameter for filtering
      let query = {};

      if (tutorEmail) {
        query = { tutorEmail: tutorEmail };
      }

      const result = await sessionCollection.find(query).toArray();
      res.send(result);
    });
    // session find  One by Id
    app.get("/session/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await sessionCollection.findOne(query);
      res.send(result);
    });
    // Update session status to approved or pending
    // Update session status to approved, pending, or rejected
    // Update session status to approved, pending, or rejected
    app.patch("/session/:id", async (req, res) => {
      const { id } = req.params;
      const { registrationFee, status, adminFeedback } = req.body; // Receive feedback for rejection

      try {
        // Check if valid status
        if (!["pending", "approved", "rejected"].includes(status)) {
          return res.status(400).send("Invalid status");
        }

        // Build update object
        const updateFields = { status };
        if (status === "rejected" && adminFeedback) {
          updateFields.adminFeedback = adminFeedback;
        }
        if (status === "approved" && registrationFee !== undefined) {
          updateFields.registrationFee = registrationFee;
        }

        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send("Error updating session status");
      }
    });

    // Reject session (delete it)
    app.delete("/session/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await sessionCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send("Error deleting session");
      }
    });

    app.post("/session", async (req, res) => {
      const session = req.body;

      const result = await sessionCollection.insertOne(session);
      res.send(result);
    });

    // ============================
    // users api
    // ============================
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user) {
        res.send(user);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });

    // user api
    // app.get("/users", async (req, res) => {
    //   const result = await userCollection.find().toArray();
    //   res.send(result);
    // });
    app.get("/users", async (req, res) => {
      const { searchText } = req.query; // Extract search text from query params
      let query = {};

      if (searchText) {
        // Search by name or email, ignoring case
        query = {
          $or: [
            { name: { $regex: searchText, $options: "i" } }, // Case-insensitive search by name
            { email: { $regex: searchText, $options: "i" } }, // Case-insensitive search by email
          ],
        };
      }

      try {
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Failed to fetch users." });
      }
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ massage: "user already eexist ", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // PATCH endpoint to update user role
    app.patch("/users/:id/role", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body; // New role to update

      if (!["admin", "student", "tutor"].includes(role)) {
        return res.status(400).send({ message: "Invalid role provided" });
      }

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        if (result.modifiedCount === 1) {
          res.status(200).send({ message: `Role updated to ${role}` });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error updating role:", error);
        res.status(500).send({ message: "Failed to update role" });
      }
    });

    // ============
    // notes api
    // ============
    app.post("/notes", async (req, res) => {
      const note = req.body;

      // Validate required fields
      if (!note.title || !note.description || !note.date || !note.email) {
        return res.status(400).send({ message: "All fields are required!" });
      }

      try {
        const result = await notesCollection.insertOne(note);
        res.send(result);
      } catch (error) {
        console.error("Error inserting note:", error);
        res.status(500).send({ message: "Failed to add the note." });
      }
    });
    // notes api
    app.get("/notes/:email", async (req, res) => {
      const userEmail = req.params.email;
      try {
        const query = { email: userEmail }; // Filter notes by the user's email
        const result = await notesCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching notes:", error);
        res.status(500).send({ message: "Failed to fetch the notes." });
      }
    });

    app.delete("/notes/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await notesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 1) {
          res.status(200).send({ message: "Note deleted successfully" });
        } else {
          res.status(404).send({ message: "Note not found" });
        }
      } catch (error) {
        console.error("Error deleting note:", error);
        res.status(500).send({ message: "Failed to delete the note" });
      }
    });
    app.put("/notes/:id", async (req, res) => {
      const id = req.params.id;
      const { title, description, date } = req.body;

      try {
        const result = await notesCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: { title, description, date },
          }
        );

        if (result.modifiedCount === 1) {
          res.status(200).send({ message: "Note updated successfully" });
        } else {
          res.status(404).send({ message: "Note not found" });
        }
      } catch (error) {
        console.error("Error updating note:", error);
        res.status(500).send({ message: "Failed to update the note" });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is runing");
});
app.listen(port, () => {
  console.log(`runing port is ${port}`);
});
