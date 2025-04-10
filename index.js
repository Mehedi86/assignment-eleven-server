const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const port = process.env.PORT || 5000;

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://silly-cobbler-5517a0.netlify.app'
    ],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        req.user = decoded;
        next();
    })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kpht8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        // books related collection
        const booksCollection = client.db('edulab').collection('allBooks');
        const borrowCollection = client.db('edulab').collection('borrows');


        // auth related api (jwt)

        app.post('/jwtLogin', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "none"
            }).send({ success: true })
        })

        app.post('/jwtLogout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
            }).send({ success: true })
        })


        // For get All Books api
        app.get('/books', verifyToken, async (req, res) => {
            const cursor = booksCollection.find();
            const result = await cursor.toArray();
            res.send(result)
        })

        // add book api
        app.post('/books', verifyToken, async (req, res) => {
            const book = req.body;
            const result = await booksCollection.insertOne(book);
            res.send(result)
        })

        // find single book by its id api
        app.get('/books/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await booksCollection.findOne(query);
            res.send(result)
        })

        // update book api
        app.put('/updateBook/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedBook = req.body;
            const filter = { _id: new ObjectId(id) };
            const option = { upsert: true }
            const book = {

                // author, category, content, description, image, name, quantity, rating, subcategory
                $set: {
                    author: updatedBook.author,
                    category: updatedBook.category,
                    content: updatedBook.content,
                    description: updatedBook.description,
                    image: updatedBook.image,
                    name: updatedBook.name,
                    quantity: updatedBook.quantity,
                    rating: updatedBook.rating,
                    subcategory: updatedBook.subcategory
                }
            }
            const result = await booksCollection.updateOne(filter, book, option);
            res.send(result)
        })

        // add borrow information api
        app.post('/borrowBooks', verifyToken, async (req, res) => {
            const borrow = req.body;
            const bookId = borrow.bookId;

            // find the specific book for update quantity
            const bookQuery = { _id: new ObjectId(bookId) };
            const book = await booksCollection.findOne(bookQuery);


            if (!book || book.quantity <= 0) {
                return res.status(400).send({ message: 'Book is out of stock!' })
            }

            const result = await borrowCollection.insertOne(borrow);

            const updateQuery = { _id: new ObjectId(bookId) };
            const updateQuantity = {
                $inc: {
                    quantity: -1
                }
            }

            const updateResult = await booksCollection.updateOne(updateQuery, updateQuantity)
            res.send(updateResult)
        })

        app.get('/myBorrowedBooks', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }

            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "forbidden access" })
            }

            const result = await borrowCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/myBorrowedBook/:id', async (req, res) => {
            const id = req.params.id;

            // find the book which quantity need to update
            const borrowQuery = { _id: new ObjectId(id) };

            const borrowData = await borrowCollection.findOne(borrowQuery);


            // now update the quantity of the book
            const updateQuery = { _id: new ObjectId(borrowData.bookId) };
            const updateQuantity = {
                $inc: {
                    quantity: 1
                }
            }
            const updateResult = await booksCollection.updateOne(updateQuery, updateQuantity)

            // delete operation
            const query = { _id: new ObjectId(id) };
            const result = await borrowCollection.deleteOne(query);
            res.send(result)
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('server is running successfully')
})

app.listen(port, () => {
    console.log('server is running from the port', port)
})



