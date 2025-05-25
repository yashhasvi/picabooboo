// DOM Elements
const video = document.getElementById('video');
const videoCanvas = document.getElementById('videoCanvas');
const frameCanvas = document.getElementById('frameCanvas');
const frameContainer = document.getElementById('frameContainer');
const countdownElement = document.getElementById('countdown');
const nextPictureElement = document.getElementById('nextPicture');
const timerSelect = document.getElementById('timerSelect');
const frameSelect = document.getElementById('frameSelect');
const filterSelect = document.getElementById('filterSelect');
const downloadNoteInput = document.getElementById('downloadNoteInput');
const fontSelect = document.getElementById('fontSelect');
const startCaptureBtn = document.getElementById('startCaptureBtn');
const editContainer = document.getElementById('editContainer');

const videoCtx = videoCanvas.getContext('2d');
const ctx = frameCanvas.getContext('2d');
const tempCanvas = document.createElement('canvas');
tempCanvas.width = 640;
tempCanvas.height = 480;
const tempCtx = tempCanvas.getContext('2d');

let photos = [];
let animationFrameId = null;

async function startWebcam() {
    console.log('Starting webcam...');
    if (!window.isSecureContext) {
        alert('Camera requires HTTPS or localhost. Please serve on a secure server.');
        console.error('Non-secure context:', window.isSecureContext);
        return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support camera access.');
        console.error('getUserMedia not supported');
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();
        video.onplay = () => applyFilterToVideo();
        window.addEventListener('beforeunload', () => {
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
                console.log('Camera stream stopped');
            }
        });
        console.log('Camera started successfully');
        return true;
    } catch (err) {
        alert(err.name === 'NotAllowedError' ? 'Camera access denied. Please allow camera access.' :
              err.name === 'NotFoundError' ? 'No camera found. Please connect a webcam.' :
              'Camera error: ' + err.message);
        console.error('Camera error:', err);
        return false;
    }
}

function applyFilter(imageData, filter) {
    const data = imageData.data;
    if (filter === 'grayscale') {
        for (let i = 0; i < data.length; i += 4) {
            const avg = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = avg;
        }
    } else if (filter === 'sepia') {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
    } else if (filter === 'blur') {
        const newData = new Uint8ClampedArray(data);
        for (let y = 8; y < 472; y += 8) {
            for (let x = 8; x < 632; x += 8) {
                const i = (y * 640 + x) * 4;
                let r = 0, g = 0, b = 0, count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (ny >= 0 && ny < 480 && nx >= 0 && nx < 640) {
                            const ni = (ny * 640 + nx) * 4;
                            r += data[ni];
                            g += data[ni + 1];
                            b += data[ni + 2];
                            count++;
                        }
                    }
                }
                newData[i] = r / count;
                newData[i + 1] = g / count;
                newData[i + 2] = b / count;
            }
        }
        return new ImageData(newData, 640, 480);
    }
    return imageData;
}

function applyFilterToVideo() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    const filter = filterSelect.value;
    videoCanvas.style.display = 'block';
    video.style.display = 'none';

    videoCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
    videoCtx.drawImage(video, 0, 0, 640, 480);

    if (filter !== 'none') {
        const imageData = videoCtx.getImageData(0, 0, 640, 480);
        videoCtx.putImageData(applyFilter(imageData, filter), 0, 0);
    }
    animationFrameId = requestAnimationFrame(applyFilterToVideo);
}

async function startCapture() {
    if (!video.srcObject) {
        alert('Camera not initialized. Please allow camera access.');
        return;
    }

    console.log('Starting capture process...');
    photos = [];
    editContainer.style.display = 'none';
    startCaptureBtn.disabled = true;

    const frameCount = parseInt(frameSelect.value);
    const canvasSizes = {
        1: { width: 360, height: 496 },
        2: { width: 360, height: 768 },
        3: { width: 360, height: 1040 },
        4: { width: 360, height: 1312 }
    };
    frameCanvas.width = canvasSizes[frameCount].width;
    frameCanvas.height = canvasSizes[frameCount].height;
    frameCanvas.style.display = 'block';

    const timer = parseInt(timerSelect.value);
    const filter = filterSelect.value;

    for (let i = 0; i < frameCount; i++) {
        console.log(`Capturing photo ${i + 1}/${frameCount}...`);
        try {
            await capturePhoto(timer, filter, i < frameCount - 1);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            alert(`Failed to capture photo ${i + 1}: ${err.message}`);
            console.error(`Capture error for photo ${i + 1}:`, err);
            startCaptureBtn.disabled = false;
            return;
        }
    }

    console.log('All photos captured, rendering frame...');
    downloadNoteInput.value = '';
    await createPolaroidFrame(frameCount);
    editContainer.style.display = 'flex';
    startCaptureBtn.disabled = false;
}

async function capturePhoto(timer, filter, showNext) {
    countdownElement.style.display = 'block';
    for (let i = timer; i >= 1; i--) {
        countdownElement.textContent = i;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    countdownElement.style.display = 'none';

    if (showNext) {
        nextPictureElement.style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 1000));
        nextPictureElement.style.display = 'none';
    }

    // Wait for the next frame to ensure stable capture
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 50)); // Additional buffer

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.save();
    tempCtx.scale(-1, 1); // Flip to correct orientation
    tempCtx.drawImage(video, -640, 0, 640, 480);
    tempCtx.restore();

    let imageData = tempCtx.getImageData(0, 0, 640, 480);
    if (filter !== 'none') {
        imageData = applyFilter(imageData, filter);
    }
    tempCtx.putImageData(imageData, 0, 0);
    photos.push(tempCanvas.toDataURL('image/png'));
    console.log('Photo captured successfully');
}

async function createPolaroidFrame(numPhotos) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);

    let yOffset = 16;
    for (let i = 0; i < numPhotos; i++) {
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.src = photos[i];
                img.onload = () => {
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(8, yOffset, 344, 240, 20);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(img, 8, yOffset, 344, 240);
                    ctx.restore();
                    console.log(`Photo ${i + 1} rendered at y=${yOffset}`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load photo ${i + 1}`);
                    reject(new Error(`Failed to load photo ${i + 1}`));
                };
            });
        } catch (err) {
            console.error('Rendering error:', err);
        }
        yOffset += 272;
    }

    updateFrameText();
}

function updateFrameText() {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, frameCanvas.height - 80, frameCanvas.width, 80);

    const noteText = downloadNoteInput.value.trim();
    if (noteText) {
        ctx.fillStyle = '#000';
        ctx.font = `18px ${fontSelect.value}`;
        ctx.textAlign = 'center';
        ctx.fillText(noteText, frameCanvas.width / 2, frameCanvas.height - 55);
    }

    ctx.fillStyle = '#1e88e5';
    ctx.font = '18px Bubblegum Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Picaboo', frameCanvas.width / 2, frameCanvas.height - 20);
}

function downloadFrame() {
    try {
        const link = document.createElement('a');
        link.download = `picaboo_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        link.href = frameCanvas.toDataURL('image/png');
        link.click();
        console.log('Frame downloaded');
    } catch (err) {
        alert('Download error: ' + err.message);
        console.error('Download error:', err);
    }
}

// Initialize
window.onload = async () => {
    console.log('Initializing app...');
    const success = await startWebcam();
    if (success) {
        startCaptureBtn.addEventListener('click', startCapture);
        filterSelect.addEventListener('change', applyFilterToVideo);
        downloadNoteInput.addEventListener('input', () => {
            if (photos.length > 0) {
                updateFrameText();
            }
        });
        fontSelect.addEventListener('change', () => {
            if (photos.length > 0) {
                updateFrameText();
            }
        });
    } else {
        console.error('Webcam failed to start');
    }
};