const express = require('express');
const cors = require('cors');
const pool = require('./config/db')
require('dotenv').config();

pool.connect()
  .then(()=>console.log("Database Connected"))
  .catch(err=>console.error("DB connection error", err));

const app = express();

const trackingRoutes = require('./routes/tracking');
const analyticsRoutes = require('./routes/analytics');



app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', trackingRoutes);
app.use('/api', analyticsRoutes);

app.get('/', (req, res) => {
    res.send("Customer Journey Analytics Backend Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});