require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')  /// amar kon time a kothai hit korsi seitar location dei

const port = process.env.PORT || 9000
const app = express()
// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eywn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {

    const db = client.db('plantNet')
    const userCollection = db.collection('users');
    const plantsCollection = db.collection('plants');
    const odersCollection = db.collection('oders');

    /// save or update the user collection in db ===================>>>>>>>>>>>>>

    app.post('/users/:email', async (req, res) => {
      const email = req.params.email
      const query = {email}
      const user = req.body
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send(existingUser)
      }
      const result = await userCollection.insertOne({...user, role: "customer", timestamp: new Date()})  /// spread operator. user object er mordhe timestamp property e date ta rakha holo..
      res.send(result)
    })

    // Generate jwt token
    app.post('/jwt', async (req, res) => {  // this request call is authProvider in fontend
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })

    /// sava a plants post data in db ==================>>>>>>>>>>

    app.post('/plants', verifyToken, async (req, res) => {
      const plant = req.body
      const result = await plantsCollection.insertOne(plant)
      res.send(result)
    })

    /// get the plants data form the database ============>>>>>>>

    app.get('/plants', async (req, res) => {
      // const email = req.params.email
      // console.log(email);
      // const query = { email }
      const plants = await plantsCollection.find().toArray()
      res.send(plants)
    })

    // get plants details data =============>>>>>>>>>>

    app.get('/plants/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await plantsCollection.findOne(query)
      res.send(result)
    })

    /// save the oder info in db =================>>>>>>>>>>

    app.post('/order', verifyToken, async (req, res) => {
      const order = req.body
      const result = await odersCollection.insertOne(order)
      res.send(result)
    })

    /// manage the plant quantity ==========>>>>>>

    app.patch('/plants/quantity/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const { quantityToUpdate, status } = req.body
      const filter = { _id: new ObjectId(id)}
      console.log(id, filter);
      
      let updateDoc = {
        $inc: {quantity: -quantityToUpdate} // request body er mordhe to just quantiy koita seita asbe. bad dibo bole quantityToUpdate er age (-)simble use korsi
      }
      if(status === 'increase'){
        updateDoc = {
          $inc: { quantity: Number(quantityToUpdate)},
      }}
      const result = await plantsCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    /// get the my oders data ===========>>>>>>>>>>>>

    app.get('/myoders/:email', async (req, res) => {
      const email = req.params.email
      const query = { "userInfo.email": email }
      const oders = await odersCollection.find(query).toArray()
      res.send(oders)
    })

    /// delete the orders data from the database ========>>>>>>>>>>

    app.delete('/myoders/:id', async (req, res)=>{
      const id = req.params.id
      const filter = { _id: new ObjectId(id) };
      const result = await odersCollection.deleteOne(filter)
      res.send(result)
    })

    // update the seller request in database ==========>>>>>>>>>>>>

    app.patch('/update-seller/:email', async (req,res)=>{
      const email = req.params.email
      const {status} = req.body
      const filter = { email }

      const user = await userCollection.findOne(filter);
      if(user?.role === 'Requested'){
        return res.status(409).send('You are already requesting. please wait for admin response 👊')
      }

      const updateDoc = { 
        $set: { role: status } 
      }
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    /// get the user role in database ========>>>>>>>>>>>>

    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email
      const query = { email }
      const result = await userCollection.findOne(query)
      res.send(result?.role)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from plantNet Server..')
})

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`)
})
