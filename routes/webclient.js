const express = require("express");
const router = express.Router();
const auth = require("../auth.js");
const path = require("path");
const CP = require("node:child_process");
const { db, checkUserExists } = require("./initdb.js"); // Updated import to destructure db and checkUserExists
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

const tokenSecret = require("crypto").randomBytes(64).toString("hex");

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const fs = require("fs");
const bcrypt = require('bcrypt');
const { redirect } = require("express/lib/response.js");

let progressData = {}; // Store progress data in memory for now

// A plain GET will give the login page
router.get("/login", (req, res) => {
   res.sendFile(path.join(__dirname, "../public/login.html"));
});
// A plain GET will give the login page
router.get("/register", (req, res) => {
   res.sendFile(path.join(__dirname, "../public/register.html"));
});

// POST for getting the cookie
router.post("/login", async (req, res) => {
   const { username, password } = req.body;
   const token = await auth.generateAccessToken(username, password);

   if (token) {
       console.log("Successful login by user", username);
       res.cookie("token", token, {
            httpOnly: false,      // Secure, prevents JavaScript access to the cookie
            secure: process.env.NODE_ENV === 'production', // Send cookie only over HTTPS in production
            sameSite: 'Lax',     // Adjust 'SameSite' as needed ('Lax' for most use cases)
            maxAge: 30 * 60 * 1000, // Token expiry time (e.g., 30 minutes)
       });
       
      console.log('Cookie set with token:', token); // Log the token
      res.status(200).json({ message: 'Login successful', token: token });
    
   } else {
       res.status(401).send("Invalid username or password");
   }
});

// POST for getting the cookie
router.post("/register", (req, res) => {
   // Check the username and password
   const username = req.body.username
   const password = req.body.password

   
    // Verify body
   if ( !username || !password){
      res.status(400).json({
         error:true,
         message: "Request body incomplete, both email and paswword needed"
      });
      return;
   }
   const test = db.get(`SELECT * FROM users WHERE username = "${username}"`)
    // Check if the user already exists
    checkUserExists(username, (err, exists) => {
      if (err) {
         return res.status(500).json({ error: true, message: "Internal server error." });
      }

      if (exists) {
         // If user exists, send a conflict response
         return res.status(409).json({ error: true, message: "User already exists." });
      }
      //if not, insert into database
      const saltRounds = 10;
      const hash = bcrypt.hashSync(password, saltRounds);

      db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, 
         [username, hash], (err) => {
            if (err) {
               console.error('Error inserting video into database:', err.message);
               return res.status(500).send("Error storing video information.");
            }
            console.log('User information stored in the database.');
            res.redirect("/login"); // Redirect to videos page after upload
      });

   });
   
});


// Log out by deleting token cookie.  Redirect back to login.
router.get("/logout", auth.authenticateCookie, (req, res) => {
   res.clearCookie("token");
   // Send a response to the client
   res.status(200).json({ message: 'Logout successful' });
});

router.post("/upload",auth.authenticateCookie, (req, res) => {
   const userToken = req.cookies.token;
   const userID = jwt.decode(userToken, tokenSecret).user_id;
   // input name in index.html is "uploadFile"
   const file = req.files.uploadFile;
   const originalFileName = file.name;
   
   // Generate a unique file name or use UUID
   const uuid = require('uuid').v4();
   const uploadPath = path.join(__dirname, "../uploads",file.name);
   
   file.mv(uploadPath, (err) => {
      // Basic error handling
      if (err) {
         return res.status(500).send(err.message);
      }

      // Store video info in the database
      const uploadDate = new Date().toISOString();
      const status = "Uploaded";
      const userId = req.user.user_id;  // Get user ID from authenticated request

      db.run(`INSERT INTO videos (uuid, original_file_name, upload_path, upload_date, status, user_id) VALUES (?, ?, ?, ?, ?, ?)`, 
      [uuid, originalFileName, uploadPath, uploadDate, status, userID], (err) => {
            if (err) {
               console.error('Error inserting video into database:', err.message);
               return res.status(500).send("Error storing video information.");
            }
            console.log('Video information stored in the database.');
            res.redirect("/videos"); // Redirect to videos page after upload
      });
   });
});

// Serve up static files if they exist in public directory, protected by authentication middleware
router.use("/", auth.authenticateCookie, express.static(path.join(__dirname, "../public")));

// Serve uploaded files statically, protected by authentication middleware
router.get("/videos", auth.authenticateCookie, (req, res) =>
{
   const userToken = req.cookies.token;
   const userID = jwt.decode(userToken, tokenSecret).user_id;
   const videoshtmlpath = path.join(__dirname, "../public/videos.html")

      fs.readFile(videoshtmlpath, "utf-8", (err, htmlData) => {
          if (err) {
              console.error("Error reading videos.html file:", err);
              return res.status(500).send("Unable to load videos page.");
          }
         const sql = `SELECT original_file_name FROM videos WHERE user_id = ? `; // Adjust table and column names as necessary

         db.all(sql, [userID], (err, rows) => {
            if (err) {
               res.status(500).json({error: err.message});
               return;
            }
            
            // Correct property reference in .map function
            let fileList = rows.map(row => `<li><a href="/uploads/${row.original_file_name}">${row.original_file_name}</a></li>`).join("");

            // Insert fileList into the HTML content
            const updatedHtml = htmlData.replace("<!-- FILE_LIST -->", fileList);
            
            // Send the updated HTML to the client
            res.send(updatedHtml);
         });
          
         
      })
});

router.post("/transcode", auth.authenticateCookie, (req, res) => 
{
   try {
      const videoOriginName = req.body.videoId;
      const outputFormat = req.body.format;
      
      if (!videoOriginName || !outputFormat) {
        return res.status(400).json({ error: 'Invalid input data' });
      }
  
      const fileName = videoOriginName.split('.');
      const inputPath = path.join(__dirname, '..', 'uploads', videoOriginName);
      const outputFile = path.join(__dirname, '..', 'transcoded', `transcode-${fileName[0]}.${outputFormat}`);

      // Step 3: Perform transcoding
      ffmpeg(inputPath)
         .output(outputFile)
         .videoCodec('libx264') // Specify a video codec (e.g., libx264 for H.264 encoding)

         // .size('3840x2160') // Set resolution to 4K

         // .fps(120) // Set frame rate to 120 fps

         .on('progress', (progress) => {
            console.log(`Transcoding progress - Current video time : ${progress.timemark} `);
            console.log(`Current frame: ${progress.frames}, Current FPS: ${progress.currentFps}`);
         })
         .on('error', (err, stdout, stderr) => {
            console.error("Transcoding failed: ", err.message);
            delete progressData[videoId]; // Clean up on error
         })
         .on('end', () => {
            console.log('Transcoding completed successfully');
            
            res.download(outputFile, function(err){
               if (err){
                  console.error("Download error : " + err)
               }
               else{
                  console.log("Download complete : " + outputFile)
               }
            });
            // res.json({ message: 'Transcoding completed successfully' });
          })
          .run();

         

   } catch (error) {
      console.error('Error during transcoding process:', error);
      res.status(500).json({ error: 'Internal Server Error' });
   }
});


router.get('/progress', auth.authenticateCookie, (req, res) => {
   try {
     const videoId = req.query.videoId;
 
     if (!videoId) {
       console.error('No video ID provided');
       return res.status(400).json({ error: 'No video ID provided' });
     }
     console.log('Fetching progress for video ID:', videoId);
 
     if (progressData[videoId] !== undefined) {
       res.json({ progress: progressData[videoId] });
     } else {
       res.json({ progress: 0 });
     }
   } catch (error) {
     console.error('Error in /progress route:', error);
     res.status(500).json({ error: 'Internal Server Error' });
   }
 });
 
// webclient.js (Express server setup)
router.get('/getVideos', auth.authenticateCookie, (req, res) => {
   try {
       const userToken = req.cookies.token;
       const userID = jwt.decode(userToken, tokenSecret).user_id;

       const sql = `SELECT id, original_file_name FROM videos WHERE user_id = ?`; // Using prepared statement to prevent SQL injection

       db.all(sql, [userID], (err, rows) => {
           if (err) {
               console.error('Database error:', err.message); // Added logging
               res.status(500).json({ error: err.message });
               return;
           }

           res.json(rows); // Send the videos as JSON
       });
   } catch (error) {
       console.error('Error decoding token or fetching videos:', error); // Added logging
       res.status(500).json({ error: 'Internal Server Error' });
   }
});

// webclient.js or a similar server file
router.get('/check-server', (req, res) => {
   res.status(200).json({ status: 'ok' }); // Respond with a simple status check
 });
 

module.exports = router;
