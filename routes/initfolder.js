const fs = require('fs');
const path = require('path');

// Define the folders you want to initialize
const foldersToInitialize = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../transcoded')
];

// Function to initialize folders
function initializeFolders() {
    foldersToInitialize.forEach(folderPath => {
        if (!fs.existsSync(folderPath)) {
            // Folder does not exist, create it
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`Folder created: ${folderPath}`);
        } 
    });
}

// Export the function
module.exports = initializeFolders;