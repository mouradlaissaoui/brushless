
const videoElement = document.getElementsByClassName('input_video')[0];

const canvasCamera = document.getElementById('camera_canvas');
const canvasPainting = document.getElementById('painting_canvas');
const btnPlay = document.getElementById('btnPlay');
const cursor = document.getElementById('cursor');

const ctxCam = canvasCamera.getContext('2d');
const ctxPainting = canvasPainting.getContext('2d');

let gFirstDetect = false;
let gEraseMode = false;
let gFingerDown = false;

// Moyenne glissante angle index
let gAngleValues = Array(10);
let gAngleIndex = 0;

// Lissage du dessin
let gLastPos = {'x': 0, 'y': 0, 'z': 0};
let gAvPos = {'x': 0, 'y': 0, 'z': 0};
let gMoyIndex = 0;
let gPosArray = Array(15);

let gJoints = [[5, 6, 0]];

function updateAveragePos(x, y, z)
{
  gPosArray[gMoyIndex] = {'x': x, 'y': y, 'z': z};
  gMoyIndex = gMoyIndex + 1;
  
  if(gMoyIndex >= gPosArray.length - 1)
    gMoyIndex = 0;
}

function getAveragePos()
{
  let sum_x = 0;
  let sum_y = 0;
  let sum_z = 0;

  for(let i = 0; i < gPosArray.length; i++)
  {
    sum_x += gPosArray[i].x;
    sum_y += gPosArray[i].y;
    sum_z += gPosArray[i].z;
  }

  let x = sum_x / gPosArray.length;
  let y = sum_y / gPosArray.length;
  let z = sum_z / gPosArray.length;

  return {'x': x, 'y': y, 'z': z};
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

function onResults(results) 
{
  ctxCam.save();
  ctxCam.clearRect(0, 0, canvasCamera.width, canvasCamera.height);
  //ctxCam.drawImage(
  //    results.image, 0, 0, canvasCamera.width, canvasCamera.height);
  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctxCam, landmarks, HAND_CONNECTIONS,
                     {color: '#00FF00', lineWidth: 5});
      drawLandmarks(ctxCam, landmarks, {color: '#FF0000', lineWidth: 2});
    }
  }
  ctxCam.restore(); 
  
  // Mémorise en continue chaque nouvelle position
  if(results.multiHandLandmarks[0]?.length === 21)
  {
    const index_finger_pos = results.multiHandLandmarks[0][8];

    let pos_x = (1.0 - index_finger_pos.x) * canvasPainting.width;
    let pos_y = index_finger_pos.y * canvasPainting.height;
    let pos_z = Math.abs(index_finger_pos.z) * canvasPainting.width * 0.2;
  
    if(gFirstDetect)
    {
      gAvPos = {'x': pos_x, 'y': pos_y, 'z': pos_z};
      gPosArray.fill(gAvPos);
      gFirstDetect = false;
    }
    
    updateAveragePos(pos_x, pos_y, pos_z);
    gAvPos = getAveragePos();

    if(gFingerDown)
      processDrawing(gAvPos.x, gAvPos.y, gAvPos.z);

    setCursor(pos_x - gAvPos.z, pos_y - gAvPos.z, gAvPos.z);
  }

  // Gestion du click en fonction de l'angle de l'index
  if(results.multiHandWorldLandmarks[0]?.length === 21)
  {
    let angle = angle_joints(gJoints, results.multiHandWorldLandmarks[0])[0];

    console.log(angle);

    gAngleValues[gAngleIndex] = angle;
    gAngleIndex = gAngleIndex < gAngleValues.length - 1 ? ++gAngleIndex : 0;

    let mean, sum = 0;
    gAngleValues.forEach((e) => sum += e);
    mean = sum / gAngleValues.length;

    console.log(mean);

    if(mean < 160) // Threshold est de 160 degré
    {
      // Premier dépassement du seuil
      if(!gFingerDown)
      {
        // Action click sur la page
        let div = document.elementFromPoint(gAvPos.x, gAvPos.y);
        div?.click();
        console.log('Click !');

        // Commence à dessiner à cette instant
        reset_finger_draw();
        
        gFingerDown = true;
      }
      
    }else
    {
      gFingerDown = false;
    }
  }
}

function processDrawing(pos_x, pos_y, pos_z)
{
    // Drawing
    if(gLastPos !== null)
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

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  //return `node_modules/@mediapipe/hands/${file}`;
}});

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

  ctxPainting.canvas.width = ctxCam.canvas.width = canvasWidth;
  ctxPainting.canvas.height = ctxCam.canvas.height = canvasHeight;
}

function reset_finger_draw()
{
  gLastPos = null;
  gPosArray.fill({'x': 0, 'y': 0, 'z': 0});
  gMoyIndex = 0;
  gFirstDetect = true;
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