const express = require("express");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");

const port = process.env.PORT || 7000;
const jwt = require("jsonwebtoken");

// MIDLEWARE
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://study-paltform.firebaseapp.com",
    ],
  })
);

app.use(express.json());

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
  const bookedCollection = client
    .db("collaborativeStudyPaltform")
    .collection("booked");
  const materialsCollection = client
    .db("collaborativeStudyPaltform")
    .collection("material");
  const reviewCollection = client
    .db("collaborativeStudyPaltform")
    .collection("review");
  try {
    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });
    // verify admin

    // middleware
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ massage: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ massage: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
      // next()
    };

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
    app.get("/session", async (req, res) => {
      const page = parseInt(req.query.page) || 1; // Page number
      const limit = 6; // Items per page
      const skip = (page - 1) * limit;

      let query = {}; // Initialize an empty query object
      const email = req.query.email; // Extract 'email' from query parameters

      // Fix: Use 'email' to build the query correctly
      if (email) {
        query.tutorEmail = email; // Searching by 'tutorEmail' using the provided email
      }

      try {
        // Count total documents matching the query
        const totalSessions = await sessionCollection.countDocuments(query);

        // Fetch the paginated results
        const sessions = await sessionCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray();

        // Respond with the sessions, total pages, and current page
        res.send({
          sessions,
          totalPages: Math.ceil(totalSessions / limit),
          currentPage: page,
        });
      } catch (error) {
        // Handle errors
        res.status(500).send({ error: "Error fetching sessions" });
      }
    });

    // session find  One by Id
    app.get("/session/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await sessionCollection.findOne(query);
      res.send(result);
    });

    app.patch("/session/:id", async (req, res) => {
      const { id } = req.params;
      const {
        registrationFee,
        status,
        adminFeedback,
        sessionTitle,
        description,
      } = req.body;

      try {
        // Check if valid status
        if (
          !["pending", "approved", "rejected"].includes(status) &&
          !sessionTitle &&
          !description
        ) {
          return res.status(400).send("Invalid data");
        }

        // Build update object
        const updateFields = {};
        if (status) updateFields.status = status;
        if (status === "rejected" && adminFeedback)
          updateFields.adminFeedback = adminFeedback;
        if (status === "approved" && registrationFee !== undefined)
          updateFields.registrationFee = registrationFee;
        if (sessionTitle) updateFields.sessionTitle = sessionTitle;
        if (description) updateFields.description = description;

        const result = await sessionCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send("Error updating session");
      }
    });

    // ==========================================

    // Reject session (delete it)
    app.delete("/session/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await sessionCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).send("Session not found");
        }
        res.send({ message: "Session deleted successfully" });
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
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ massage: "unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.get("/users/tutor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ massage: "unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let tutor = false;
      if (user) {
        tutor = user?.role === "tutor";
      }
      res.send({ tutor });
    });

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

    app.get("/users", async (req, res) => {
      const { searchText } = req.query; // Extract search text from query params
      let query = {};

      if (searchText) {
        // Search by name or email,
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

    app.get("/tutor", async (req, res) => {
      const cursor = userCollection.find({ role: "tutor" });
      const result = await cursor.toArray();
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
    app.get("/users/:email", async (req, res) => {
      const userEmail = req.params.email;
  
      try {
          const user = await userCollection.findOne({ email: userEmail });
          if (user) {
              res.json(user);
          } else {
              res.status(404).json({ message: "User not found" });
          }
      } catch (error) {
          console.error("Error fetching user:", error);
          res.status(500).json({ message: "Server error" });
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

    // =====================
    // booked colldection
    // =====================

    // app.post("/booked", async (req, res) => {
    //   const bookedItem = req.body;

    //   const result = await bookedCollection.insertOne(bookedItem);
    //   res.send(result);
    // });
    app.post("/booked", async (req, res) => {
      const bookedItem = req.body;
      const { sessionId, bookedUserEmail } = bookedItem;

      // Check if the session is already booked by the user
      const existingBooking = await bookedCollection.findOne({
        sessionId: sessionId,
        bookedUserEmail: bookedUserEmail,
      });

      if (existingBooking) {
        return res.send({
          success: false,
          message: "You have already booked this session.",
        });
      }

      // If not booked, proceed with booking
      const result = await bookedCollection.insertOne(bookedItem);
      res.send({ success: true, result });
    });

    app.get("/booked", async (req, res) => {
      const email = req.query.email;

      const query = email ? { bookedUserEmail: email } : {};

      try {
        const result = await bookedCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching materials:", error);
        res.status(500).send({ message: "Failed to fetch materials" });
      }
    });
    app.get("/booked/check", async (req, res) => {
      const { sessionId, userEmail } = req.query;

      const isBooked = await bookedCollection.findOne({
        sessionId: sessionId,
        bookedUserEmail: userEmail,
      });

      res.send({ isBooked: !!isBooked });
    });
    // find one
    app.get("/booked/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedCollection.findOne(query);
      res.send(result);
    });

    // ===========
    // review
    // ===========
    app.get("/reviews", async (req, res) => {
      try {
        const reviews = await reviewCollection.find().toArray();
        res.send(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Failed to fetch reviews." });
      }
    });

    // review
    app.post("/review", async (req, res) => {
      const review = req.body;
      const { userEmail, sessionId } = review;

      try {
        const existingReview = await reviewCollection.findOne({
          userEmail,
          sessionId,
        });

        if (existingReview) {
          return res.status(400).send({
            message: "You have already added a review for this session.",
          });
        }

        const result = await reviewCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.error("Error inserting review:", error);
        res.status(500).send({ message: "Failed to add review." });
      }
    });

    app.get("/reviews", async (req, res) => {
      const { sessionId } = req.query;
      try {
        if (sessionId) {
          const reviews = await reviewCollection.find({ sessionId }).toArray();
          return res.send(reviews);
        }

        const allReviews = await reviewCollection.find().toArray();
        res.send(allReviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Failed to fetch reviews." });
      }
    });
    // avg rating
    app.get("/get-average-review/:id", async (req, res) => {
      try {
        const avRating = await reviewCollection
          .aggregate([
            {
              $match: { sessionId: req.params.id },
            },
            {
              $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
              },
            },
            {
              $project: {
                _id: 0,
                averageRating: 1,
              },
            },
          ])
          .next();
        // console.log(avRating);
        res.send(avRating);
      } catch (error) {
        res.status(500).send({
          massage: `internal server error- ${error.massage}`,
        });
      }
    });

    // =====================
    // material colldection
    // =====================
    app.post("/material", async (req, res) => {
      const material = req.body;

      const result = await materialsCollection.insertOne(material);
      res.send(result);
    });

    app.get("/material", async (req, res) => {
      const email = req.query.email;

      const query = email ? { tutorEmail: email } : {};

      try {
        const result = await materialsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching materials:", error);
        res.status(500).send({ message: "Failed to fetch materials" });
      }
    });
    app.get("/material/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await materialsCollection.findOne(query);
      res.send(result);
    });
    app.delete("/material/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await materialsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).send("material not found");
        }
        res.send({ message: "material deleted successfully" });
      } catch (error) {
        res.status(500).send("material deleting session");
      }
    });
    // delete materil for admin
    app.delete("/admin/material/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await materialsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).send("material not found");
        }
        res.send({ message: "material deleted successfully" });
      } catch (error) {
        res.status(500).send("material deleting session");
      }
    });
    app.patch("/material/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        const result = await materialsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        console.log("Patch result:", result);
        res.send(result);
      } catch (error) {
        console.error("Error updating material:", error);
        res.status(500).send({ message: "Failed to update material" });
      }
    });

    // app.get("/material",verifyToken, async (req, res) => {
    //   const email = req.query.email;

    //   const query = email ? { tutorEmail: email } : {};

    //   try {
    //     const result = await materialsCollection.find(query).toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching materials:", error);
    //     res.status(500).send({ message: "Failed to fetch materials" });
    //   }
    // });
    // view booked mateial student
    app.get("/get-student-material/:email", async (req, res) => {
      try {
        const bookedSessions = await bookedCollection
          .find({
            bookedUserEmail: req.params.email,
          })
          .toArray();
        const bookedSessionsIds = bookedSessions?.map(
          (session) => session.sessionId
        );
        const materials = await materialsCollection
          .find({
            sessionId: { $in: bookedSessionsIds },
          })
          .toArray();
        res.send(materials);
      } catch (error) {
        res.status(500).send({
          massage: `internal server error- ${error.massage}`,
        });
      }
    });

    // ============
    // payment
    // ============
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      // const amount = Math.round(price * 100);
      console.log(price);
      // const paymentIntent = await stripe.paymentIntents.create({
      //   amount: amount,
      //   currency: "usd",

      //   payment_method_types: ["card"],
      // });

      res.send({
        price,
      });
      // res.send({
      //   clientSecret: paymentIntent.client_secret,
      // });
    });
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
