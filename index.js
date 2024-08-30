const express = require("express");
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");

const cors = require("cors");
const app = express();
const port = 5000;
app.use(cors({
   origin: 'http://localhost:3000', // Specify your frontend's origin
   credentials: true,               // Allow credentials (cookies)
 }));
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());

// Parse urlencoded bodies for POST form parameters
app.use(express.urlencoded({ extended: true }));

const initializeFolders = require("./routes/initfolder.js")
initializeFolders();

const webclientRoute = require("./routes/webclient.js");
const apiRoute = require("./routes/api.js");


app.use("/api", apiRoute);
app.use("/", webclientRoute);

app.listen(port, () => {
   console.log(`Server listening on port ${port}.`);
});
