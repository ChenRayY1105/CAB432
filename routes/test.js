const router = require("./webclient");
const db = require("sqlite3");

router.get('/getVideos', (req, res) => {
    const sql = `SELECT id, original_file_name FROM videos`; // Adjust table and column names as necessary
 
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        res.json(rows);
    });
 });