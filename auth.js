const jwt = require("jsonwebtoken");
// const db = require("./routes/initdb")
const { db, checkUserExists } = require("./routes/initdb")
const bcrypt = require('bcrypt');
const res = require("express/lib/response");
const { match } = require("assert");


// Using a fixed authentication secret for demonstration purposes.
// Ideally this would be stored in a secrets manager and retrieved here.
// To create a new randomly chosen secret instead, you can use:
//
// tokenSecret = require("crypto").randomBytes(64).toString("hex");
//
const tokenSecret = require("crypto").randomBytes(64).toString("hex");

// Create a token with username embedded, setting the validity period.
const generateAccessToken = async (username, password) => {
   try {
       // Fetch user from the database
       const user = await new Promise((resolve, reject) => {
           db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
               if (err) return reject(err);
               if (!row) return reject(new Error("User not found"));
               resolve(row);
           });
       });

       // Compare passwords
       const isMatch = await bcrypt.compare(password, user.password);
       if (!isMatch) {
           console.log("Passwords do not match");
           return null; // or handle it as per your logic
       }

       // Password is correct, generate the token
       const userData = { 
         username: user.username,
         user_id : user.user_id
      };
       const token = jwt.sign(userData, tokenSecret, { expiresIn: "30m" });
       const decoded =jwt.decode(token, tokenSecret)
       
       console.log("decoded" + decoded.user_id)
       console.log("Successful login by user", username);
       
      //  console.log(token);
       return token;

   } catch (err) {
       console.error("Error in generateAccessToken:", err);
       return null; // or handle error accordingly
   }
};


const authenticateCookie = (req, res, next) => {
   // Check to see if the cookie has a token
   // console.log(req.cookies)
   token = req.cookies.token;
   if (!token) {
      console.log("Cookie auth token missing.");
      return res.redirect("/login");
   }

   // Check that the token is valid
   try {
      const user = jwt.verify(token, tokenSecret);

      // console.log(
      //    `Cookie token verified for user: ${user.username} at URL ${req.url}`
      // );

      // Add user info to the request for the next handler
      req.user = user;
      next();
   } catch (err) {
      console.log(
         `JWT verification failed at URL ${req.url}`,
         err.name,
         err.message
      );
      return res.redirect("/login");
   }
};

// Middleware to verify a token and respond with user information
const authenticateToken = (req, res, next) => {
   // Assume we are using Bearer auth.  The token is in the authorization header.
   const authHeader = req.headers["authorization"];
   const token = authHeader && authHeader.split(" ")[1];

   if (!token) {
      console.log("JSON web token missing.");
      return res.sendStatus(401);
   }

   // Check that the token is valid
   try {
      const user = jwt.verify(token, tokenSecret);

      console.log(
         `authToken verified for user: ${user.username} at URL ${req.url}`
      );

      // Add user info to the request for the next handler
      req.user = user;
      next();
   } catch (err) {
      console.log(
         `JWT verification failed at URL ${req.url}`,
         err.name,
         err.message
      );
      return res.sendStatus(401);
   }
};
module.exports = { generateAccessToken, authenticateCookie, authenticateToken };
