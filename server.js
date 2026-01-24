require('dotenv').config();
const express = require('express');
const app = express();
const testRoutes = require('./routes/testRoutes');

app.use(express.json());

app.use('/test', testRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});