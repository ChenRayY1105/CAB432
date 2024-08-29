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
           httpOnly: true,
           sameSite: "Strict",
       });
       res.redirect("/");
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
   console.log("Testing " + test + " user name = " + username + "User.username" + test.username) 
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

   // console.log("Logout by user", req.user.username);
   res.clearCookie("token");
   res.redirect("/login");
});

router.post("/upload",auth.authenticateCookie, (req, res) => {
   const userToken = req.cookies.token;
   const userID = jwt.decode(userToken, tokenSecret).user_id;
   console.log(userID)
   
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
   console.log(userID);
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
   const video_origin_name = req.body.videoId;
   const outputformate = req.body.format;
   const fileName = video_origin_name.split(".");
   const filepath = path.join(__dirname, "..", "uploads", `${video_origin_name}`);

   const videoId = uuidv4(); // Generate a unique ID for this transcoding job
   progressData[videoId] = 0; // Initialize progress

   //const expPaath = path.join(__dirname, "uploads")
   console.log("FIlePath = " + filepath)

   try {
      // Step 2: Fetch the video details from the database
      const outputFile = path.join(__dirname,"..", "transcoded", `transcode-${fileName[0]}.${outputformate}`);
      // Step 3: Perform transcoding
      ffmpeg(filepath)
         .output(outputFile)
         .videoCodec('libx264') // Specify a video codec (e.g., libx264 for H.264 encoding)

         // .size('3840x2160') // Set resolution to 4K

         // .fps(120) // Set frame rate to 120 fps

         .on('progress', (progress) => {
            console.log(`Transcoding progress - Current video time : ${progress.timemark} `);
            console.log(`Current frame: ${progress.frames}, Current FPS: ${progress.currentFps}`);
            progressData[videoId] = progress.percent; // Store progress percentage
         })
         .on('error', (err, stdout, stderr) => {
            console.error("Transcoding failed: ", err.message);
            delete progressData[videoId]; // Clean up on error
         })
         .on('end', () => {
            console.log('Transcoding completed successfully.');
            delete progressData[videoId]; // Clean up on completion
            res.download(outputFile, function(err){
               if (err){
                  console.error("Download error : " + err)
               }
               else{
                  console.log("Download complete : " + outputFile)
               }
            });
            // res.redirect("/videos");
         })
         .run();

         

   } catch (error) {
         console.error("Error during transcoding process: ", error);
   }
});


// Endpoint to get progress
router.get('/progress', auth.authenticateCookie, (req, res) => {
   const videoId = req.query.videoId;
   if (progressData[videoId] !== undefined) {
       res.json({ progress: progressData[videoId] });
   } else {
       res.json({ progress: 0 });
   }
});

router.get('/getVideos',auth.authenticateCookie, (req, res) => {
   const userToken = req.cookies.token;
   const userID = jwt.decode(userToken, tokenSecret).user_id;
   console.log(userID)

   const sql = `SELECT id, original_file_name FROM videos WHERE user_id = ${userID} `; // Adjust table and column names as necessary

   db.all(sql, [], (err, rows) => {
       if (err) {
           res.status(500).json({error: err.message});
           return;
       }
       res.json(rows);
   });
});

module.exports = router;
