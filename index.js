const express = require("express");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");

const app = express();
const port = 3000;
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());

// Parse urlencoded bodies for POST form parameters
app.use(express.urlencoded({ extended: true }));


const webclientRoute = require("./routes/webclient.js");
const apiRoute = require("./routes/api.js");


app.use("/api", apiRoute);
app.use("/", webclientRoute);

app.listen(port, () => {
   console.log(`Server listening on port ${port}.`);
});
