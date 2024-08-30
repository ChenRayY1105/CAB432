document.addEventListener('DOMContentLoaded', () => {
    fetch('/getVideos')
    .then(response => response.json())
    .then(videos => {
        if (Array.isArray(videos)) {
            const videoSelector = document.getElementById('videoSelector');
            let defaultOption = '<option value="" disabled selected>--Please choose a video--</option>';

            let videolist = videos.map(video => `<option value="${video.original_file_name}">${video.original_file_name}</option>`).join("");
            videoSelector.innerHTML = defaultOption + videolist; // Use innerHTML to insert the options
        } else {
            console.error('Unexpected response format:', videos);
        }
    })
    .catch(err => console.error('Error fetching videos:', err));
});


function selectVideo() {
    const videoSelector = document.getElementById('videoSelector');
    const selectedVideoId = videoSelector.value;

    var elem = document.getElementById("test");
    var ID = document.getElementById("videoSelector")

    elem.value = ID.value;

    return selectedVideoId
}

function startTranscoding(event) {
    event.preventDefault(); // Prevent form submission
    const videoId = selectVideo(); // Get selected video ID
    const videoForm = document.getElementById('videoForm');

    // Start polling progress
    pollProgress(videoId);

    // Submit the form after starting the progress polling
    videoForm.submit();
}

function pollProgress(videoId) {
    const intervalId = setInterval(() => {
        fetch(`/progress?videoId=${videoId}`)
            .then(response => response.json())
            .then(data => {
                const progressBar = document.getElementById('progress-bar');
                const progressText = document.getElementById('progress-text');
                
                // Update the progress bar and text
                progressBar.value = data.progress;
                progressText.textContent = `${data.progress.toFixed(2)}%`;

                // Stop polling if progress is 100%
                if (data.progress >= 100) {
                    clearInterval(intervalId);
                }
            })
            .catch(err => console.error('Error fetching progress:', err));
    }, 1000); // Poll every second
}

