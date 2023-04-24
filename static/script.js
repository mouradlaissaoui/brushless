const videoElement = document.getElementsByClassName('input_video')[0];

const canvasCamera = document.getElementById('camera_canvas');
const canvasPainting = document.getElementById('painting_canvas');
const btnPlay = document.getElementById('btnPlay');
const cursor = document.getElementById('cursor');

const ctxCam = canvasCamera.getContext('2d');
const ctxPainting = canvasPainting.getContext('2d');

let CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe'
let LOCAL_MEDIAPIPE_PATH = 'static/node_modules/@mediapipe'

// Contrôle dessin
let gTimeStart = 0;
let gIsDetect = false;
let gEraseMode = false;

// Filtrage
let gTrack3DPoints = [5, 6, 0, 8];
let gTrack2DPoints = [8];

let gFiltered3DHand = {};
let gFiltered2DHand = {};

// Angle index
let gLastAngle = 0;
let gAngleSpeed = 0;
let gJoints = [[5, 6, 0]];

////////// [ FILTRAGE ] ///////////
function getAveragePos(array)
{
  let sum_x = 0;
  let sum_y = 0;
  let sum_z = 0;

  for(let i = 0; i < array.length; i++)
  {
    sum_x += array[i].x;
    sum_y += array[i].y;
    sum_z += array[i].z;
  }

  let x = sum_x / array.length;
  let y = sum_y / array.length;
  let z = sum_z / array.length;

  return {'x': x, 'y': y, 'z': z};
}

function initFilteredHand(filteredHand, tracked_points, length, landmarks)
{
  for(points of tracked_points)
  {
    const pos = landmarks[points];

    filteredHand[points] = {'datas': null, 'index': 0,
              'x': pos.x, 'y': pos.y, 'z': pos.z};

    filteredHand[points].datas = Array.from({'length': length}, () => ({'x': pos.x, 'y': pos.y, 'z': pos.z}));
  }
}

function filterHand(landmarks, filtered, tracked_points)
{
  for(points of tracked_points)
  {
    let datas = filtered[points];
    const pos = landmarks[points];

    Object.assign(datas.datas[datas.index], pos); 

    datas.index = (datas.index + 1) % (datas.datas.length);
  
    const pt = getAveragePos(datas.datas);
    Object.assign(datas, pt);
  }
}

// https://www.geeksforgeeks.org/find-all-angles-of-a-triangle-in-3d/
function angle_triangle(x1,x2,x3,y1,y2,y3,z1,z2,z3)
{
    let num = (x2-x1)*(x3-x1)+(y2-y1)*(y3-y1)+(z2-z1)*(z3-z1) ;
   
    let den = Math.sqrt(
                (x2-x1)**2  +
                (y2-y1)**2  + 
                (z2-z1)**2) *
              Math.sqrt(
                (x3-x1)**2 +
                (y3-y1)**2 + 
                (z3-z1)**2
                );
   
    let angle = Math.acos(num / den)*(180.0/3.141592653589793238463) ;
   
    return angle ;
}

// Calcule l'angle entre trois points de la main
function angle_joints(joints_list, landmarks)
{
  let angles = [];

  if(landmarks)
  {
    for(let joints of joints_list)
    {
      angles.push(angle_triangle(
                    landmarks[joints[0]].x, landmarks[joints[1]].x, landmarks[joints[2]].x,
                    landmarks[joints[0]].y, landmarks[joints[1]].y, landmarks[joints[2]].y,
                    landmarks[joints[0]].z, landmarks[joints[1]].z, landmarks[joints[2]].z));
    }
  }

  return angles;
}

function processResults(results)
{
  // Acquisition des mesures
  if((results.multiHandLandmarks[0]?.length) === 21 && (results.multiHandWorldLandmarks[0]?.length === 21))
  {
   
    if(!gIsDetect)
    {
      initFilteredHand(gFiltered2DHand, gTrack2DPoints, 10, results.multiHandLandmarks[0]);
      initFilteredHand(gFiltered3DHand, gTrack3DPoints, 5, results.multiHandWorldLandmarks[0]);

      gAngleSpeed = 0;
      gTimeStart = performance.now();
      
      gLastPos = null;

      gIsDetect = true;
    }else
    {
      filterHand(results.multiHandWorldLandmarks[0], gFiltered3DHand, gTrack3DPoints);
      filterHand(results.multiHandLandmarks[0], gFiltered2DHand, gTrack2DPoints);
      
      // Stockage des angles dans le tableau
      let angle = angle_joints(gJoints, gFiltered3DHand)[0];
      console.log(angle);
      
      // Vitesse angulaire
      let elapsedTime = performance.now() - gTimeStart;
      gTimeStart = performance.now();
      gAngleSpeed = Math.abs(angle - gLastAngle) / elapsedTime * 1000;
      gLastAngle = angle;
    }

  }else
  {
    gIsDetect = false;
    cursor.style.display = 'none';
  }
}

function onResults(results) 
{
  ctxCam.save();
  ctxCam.clearRect(0, 0, canvasCamera.width, canvasCamera.height);

  // ctxCam.drawImage(results.image, 0, 0, canvasCamera.width, canvasCamera.height);
  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctxCam, landmarks, HAND_CONNECTIONS,
                     {color: '#00FF00', lineWidth: 5});
      drawLandmarks(ctxCam, landmarks, {color: '#FF0000', lineWidth: 2});
    }
  }
  ctxCam.restore(); 
  

  // Mesures des données de la main
  processResults(results);

  // Partie fonctionnelle
  if(gIsDetect)
  {
    const gAvPos = gFiltered2DHand[8];

    let rect = canvasPainting.getBoundingClientRect();
    
    gAvPos.x = (1 - gAvPos.x) * rect.width;
    gAvPos.y *= rect.height;
    gAvPos.z = Math.abs(gAvPos.z) * rect.width * 0.1;

    // Dessin
    if(gLastAngle > 164)
    {
      processDrawing(gAvPos.x, gAvPos.y, gAvPos.z);
    }else
    {
      gLastPos = null;
    }
    setCursor(gAvPos.x - gAvPos.z / 2, gAvPos.y - gAvPos.z / 2, gAvPos.z);

    // console.log('Angle vitesse:' + Math.round(gAngleSpeed) + ' Angle:' + gLastAngle);

    if(gAngleSpeed > 50 && gLastAngle < 165)
    {
      let div = document.elementFromPoint(gAvPos.x, gAvPos.y);
      div?.click();
      console.log('Click !');
    }
    cursor.style.display = 'block';
  }else
  {
  cursor.style.display = 'none';
  }  
}

function processDrawing(pos_x, pos_y, pos_z)
{
    // Drawing
    if(gLastPos !=  null)
    {
      const eraserScale = 1.5;
      
      if(gEraseMode)
      {
        const eraserwidth = pos_z * eraserScale;
        
        ctxPainting.save();
        ctxPainting.clearRect(pos_x, pos_y, eraserwidth, eraserwidth);
        ctxPainting.restore();
      }else
      {
        ctxPainting.lineWidth = pos_z;
        ctxPainting.lineCap = 'round';
        
        ctxPainting.beginPath();
        ctxPainting.moveTo(gLastPos.x, gLastPos.y);
        ctxPainting.lineTo(pos_x, pos_y);
        ctxPainting.stroke();
      }
    }
    gLastPos = {'x': pos_x, 'y': pos_y, 'z': pos_z};
}

function UrlExists(url)
{
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status!=404;
}

const hands = new Hands({locateFile: (file) => 
  {
    path = `${LOCAL_MEDIAPIPE_PATH}/hands/${file}`
    if(UrlExists(path) == false)
      path = `${CDN_URL}/hands/${file}`;
    return path;
  }
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 0,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  facingMode: 'user',
  width: 1280,
  height: 720
});

var isCameraActive = false;

// Play stop camera 
btnPlay.addEventListener('click', () => {
   
    if(isCameraActive)
    {
        camera.stop();
        btnPlay.textContent = 'PLAY';
    }else{
        camera.start();
        btnPlay.textContent = 'STOP';
    
        ctxPainting.clearRect(0, 0 , canvasPainting.width, canvasPainting.height);
    
        reset_finger_draw();
      }
    isCameraActive = !isCameraActive;

});

function resizeCanvas()
{
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  ctxCam.canvas.width = canvasWidth;
  ctxCam.canvas.height = canvasHeight;

  ctxPainting.canvas.width = canvasWidth;
  ctxPainting.canvas.height = canvasHeight;
}

function reset_finger_draw()
{
  gLastPos = null;
  gIsDetect = false;
}

function setCursor(x, y, w)
{
  cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  cursor.style.width = w + 'px';
  cursor.style.height = w + 'px';
}

window.addEventListener('resize', resizeCanvas);

window.addEventListener('mousedown', (event) => {
  reset_finger_draw();
});
window.addEventListener('mousemove', (event) => {
  if(event?.buttons === 1){
    processDrawing(event?.x, event?.y, 10);
    setCursor(event?.x - 10, event?.y - 10, 10);
  }
});

reset_finger_draw();
resizeCanvas();