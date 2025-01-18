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
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
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
