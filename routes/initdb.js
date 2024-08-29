const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Database file path
const dbPath = path.join(__dirname, 'videos.db');

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
       // Create videos table
       db.run(`
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE,
            original_file_name TEXT,
            transcoded_file_name TEXT,
            upload_path TEXT,
            transcoded_path TEXT,
            upload_date TEXT,
            status TEXT,
            user_id INTEGER,  
            FOREIGN KEY(user_id) REFERENCES users(user_id)  
        )
    `, (err) => {
        if (err) {
            console.error('Error creating videos table:', err.message);
        } else {
            // console.log('Videos table initialized.');
        }
    });

    // Create users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            // console.log('Users table initialized.');
        }
    });
    }
});


// Function to check if a user exists
function checkUserExists(username, callback) {
    // Query to check if user exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
       if (err) {
          console.error('Error checking user existence in database:', err.message);
          return callback(err, null);
       }
 
       // If user does not exist, row will be undefined
       if (!row) {
          console.log("User does not exist.");
          return callback(null, false);
       }
 
       // If user exists
       console.log("User exists:", row);
       return callback(null, true);
    });
}


// Export both the database and the checkUserExists function
module.exports = {
    db,
    checkUserExists
};