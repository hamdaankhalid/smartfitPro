var height;

var fileReader = new FileReader();
var filterType = /^(?:image\/bmp|image\/cis\-cod|image\/gif|image\/ief|image\/jpeg|image\/jpeg|image\/jpeg|image\/pipeg|image\/png|image\/svg\+xml|image\/tiff|image\/x\-cmu\-raster|image\/x\-cmx|image\/x\-icon|image\/x\-portable\-anymap|image\/x\-portable\-bitmap|image\/x\-portable\-graymap|image\/x\-portable\-pixmap|image\/x\-rgb|image\/x\-xbitmap|image\/x\-xpixmap|image\/x\-xwindowdump)$/i;

fileReader.onload = function (event) {
  var image = new Image();
  image.onload=function(){
      var canvas=document.createElement("canvas");
      var context=canvas.getContext("2d");

      // if else to keep aspect ratio in 300X300
    if(image.width>image.height){
        canvas.width = 800;
        canvas.height = 800 / image.width * image.height;
    } else {
        canvas.width = 800 / image.height * image.width;
        canvas.height = 800;
    } 

    //   canvas.width=image.width/4;
    //   canvas.height=image.height/4;
      context.drawImage(image,
          0,
          0,
          image.width,
          image.height,
          0,
          0,
          canvas.width,
          canvas.height
      );
      
      document.getElementById("upload-Preview").src = canvas.toDataURL();
  }
  image.src=event.target.result;
};

var loadImageFile = function () {
    
  height = window.prompt("Enter Height: ")
  var uploadImage = document.getElementById("upload-Image");
  
  //check and retuns the length of uploded file.
  if (uploadImage.files.length === 0) { 
    return; 
  }
  
  //Is Used for validate a valid file.
  var uploadFile = document.getElementById("upload-Image").files[0];
  if (!filterType.test(uploadFile.type)) {
    alert("Please select a valid image."); 
    return;
  }
  
  fileReader.readAsDataURL(uploadFile);
  predict();

}

// After height, and upload has been performed take input image and run through Bodypix calculations

let advice = null; 

let net;

const canvas = document.getElementById('outputCanvas');
const img = document.getElementById('upload-Preview');

// MODEL CONFIG OPTIONS

// outputStride Can be one of 8, 16, 32. 
// It specifies the output stride of the BodyPix model. The smaller the value, 
// the larger the output resolution, and more accurate the model at the cost of speed. 
// Set this to a larger value to increase speed at the cost of accuracy.
const outputStride = 16;

// The model multiplier can be one of 1.01, 1.0, 0.75, or 0.50 
// (The value is used only by the MobileNetV1 architecture and not by the ResNet50 architecture). 
// It is the float multiplier for the depth (number of channels) for all convolution ops. 
// The larger the value, the larger the size of the layers, and more accurate the model at 
// the cost of speed. Set this to a smaller value to increase speed at the cost of accuracy.
const multiplier = 1 ; 

const quantBytes = 4;
const maxPoses = 1;

let personSegmentation;
let partSegmentation;

var head;
var foot;
var rightWrist;
var rightShoulder;
var leftLeg;
var leftAnkle;
var leftArmUp;
var rightArmUp;


async function predict() {
  drawImageOnCanvas();
  const architecture = 'ResNet50' ;
  await loadModelAndDrawOutput(architecture, 'segmentMultiPersonParts', 'drawColoredPartMap');

  
}

// estimatePartSegmentation
// segmentMultiPersonParts

function setStatus(text) {
  document.getElementById('status').innerText = text;
}

const SEGMENT_MULTI_PERSON_PARTS = 'segmentMultiPersonParts';


const segmentationThreshold = 0.5;

async function loadModelAndDrawOutput(architecture, segmentationMethod, drawingMethod) {

  drawImageOnCanvas();
  setStatus('loading the model...');

  if (net) {
    // dispose 
    net.dispose();
  }

  net = await bodyPix.load({
    architecture,
    multiplier,
    outputStride,
    quantBytes
  });
  
  await performSegmentationAndDrawOutput(segmentationMethod, drawingMethod);


  // draw proofs
  draw_proof(head, foot);
  draw_proof(rightShoulder, rightWrist);
  draw_proof(leftLeg, leftAnkle);
  draw_proof(leftArmUp, rightArmUp);
  setStatus('');
}




async function performSegmentationAndDrawOutput(segmentationMethod, drawingMethod) {
  drawImageOnCanvas();

  await performSegmentation(segmentationMethod);

  //drawOutput(drawingMethod);
}

async function performSegmentation(segmentationMethod) {
  setStatus('estimating segmentation...');

    partSegmentation = await net.segmentMultiPersonParts(img, {segmentationThreshold,
    maxDetections: maxPoses});
    //console.log(partSegmentation);
    
    var person_height_inches = 69 ; 
    var image_height = find_image_height(partSegmentation) ;
    scaled = scaling_factor(image_height, person_height_inches);
    image_matrix = listToArray(partSegmentation) ; 
    transposed_matrix = image_matrix[0].map((_, colIndex) => image_matrix.map(row => row[colIndex]));

    console.log("SHOULDER", shoulder_length(image_matrix, scaled));
    console.log("LEG LENGTH", leg_length(image_matrix, scaled));
    console.log("ARM LENGTH", arm_length(image_matrix, scaled));

    var results = [shoulder_length(image_matrix, scaled) , leg_length(image_matrix, scaled), arm_length(image_matrix, scaled)]
    
    results.forEach((i) =>{
    var para = document.createElement("P")    ;          // Create a <p> element
    para.innerText = i ;          // Insert text
    document.body.appendChild(para);   
    }); 

}

function indexOf2d(arr, val) {
  var index = [-1, -1];

  if (!Array.isArray(arr)) {
      return index;
  }

  arr.some(function (sub, posX) {
      if (!Array.isArray(sub)) {
          return false;
      }

      var posY = sub.indexOf(val);

      if (posY !== -1) {
          index[0] = posX;
          index[1] = posY;
          return true;
      }

      return false;
  });

  return index;
}


function listToArray(segment){
  var image_width = img.width ;
  return segment[0]["data"].reduce((rows, key, index) => (index % image_width == 0 ? rows.push([key]) 
  : rows[rows.length-1].push(key)) && rows, []);
}


function find_image_height(segmented){
  // find index of first head and last index of foot
  var matrix ; 
  var image_width = img.width  ;
  matrix = segmented[0]["data"];
  var top = Math.min( (matrix.indexOf(0))  , (matrix.indexOf(1)) ) +1;
  console.log("TOP "+ top);
  head = [ (top%image_width)  , (top - ((top%image_width))) / image_width ] ;
  

  var bottom =   Math.max( matrix.indexOf(21) , matrix.indexOf(23)  )  + 1;
  foot = [ (bottom%image_width) , (((bottom - (bottom%image_width))) / image_width) ] ;

  console.log("BOTTOM "+ bottom);
  dist = euclideanDist(head, foot);
  return dist ; 
}

// returns inches per pixel
function scaling_factor(imageHeight, person_height){
  var scale =  person_height / imageHeight;
  return scale; 
}

function shoulder_length(matrix , scaling_factor){
  var image_width = img.width;
  var flat_matrix = matrix.flat();
  var leftest_upperarm =  flat_matrix.indexOf(4) +1;
  var rightest_upperarm = flat_matrix.indexOf(2) +1;
  // draw figure out what the column us

  leftArmUp= [ (leftest_upperarm %image_width)  , (leftest_upperarm  - ((leftest_upperarm %image_width))) / image_width ] ;
  rightArmUp = [ (rightest_upperarm %image_width)  , (rightest_upperarm - ((rightest_upperarm %image_width))) / image_width ] ;


  var shoulder_dist = euclideanDist(leftArmUp, rightArmUp);
  shoulder_dist_inches = shoulder_dist * scaling_factor ;
  return shoulder_dist_inches;
}


function leg_length(matrix , scaling_factor){
  var image_width = img.width;
  var flat_matrix = matrix.flat()
  var start_leftthigh=  flat_matrix.indexOf(14)+1;
  var end_leftankle = flat_matrix.lastIndexOf(18)+1 ;
  
  leftLeg = [ (start_leftthigh%image_width)  , (start_leftthigh - ((start_leftthigh%image_width))) / image_width ] ;
  leftAnkle = [ (end_leftankle%image_width)  , (end_leftankle- ((end_leftankle%image_width))) / image_width ] ;

  dist = euclideanDist(leftLeg, leftAnkle) + 8;
  dist_inches = dist*scaling_factor;

  return dist_inches;
}

function arm_length(matrix, scaling_factor) {
  var image_width = img.width;
  var flat_matrix = matrix.flat()
  rightShoulder=  flat_matrix.indexOf(4)+1;
  rightWrist = flat_matrix.lastIndexOf(11)+1 ;
  
  rightShoulder = [ (rightShoulder%image_width)  , (rightShoulder - ((rightShoulder%image_width))) / image_width ] ;
  rightWrist = [ (rightWrist%image_width)  , (rightWrist - ((rightWrist%image_width))) / image_width ] ;

  dist = euclideanDist(rightShoulder, rightWrist);
  dist_inches = dist*scaling_factor;

  return dist_inches;
};

function euclideanDist(p1 , p2){
    x1 = p1[0];
    x2 = p2[0];
    y1 = p1[1];
    y2 = p2[1];
    var deltaX = diff(x1, x2);
    var deltaY = diff(y1, y2);
    var dist = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    return (dist);
};

function diff (num1, num2) {
  if (num1 > num2) {
    return (num1 - num2);
  } else {
    return (num2 - num1);
  }
};

function drawOutput(drawingMethod) {
  setStatus('drawing results...');

  const outputFunctions = {
     drawPartSegmentation,
     drawColoredPartMap
  };

  outputFunction = outputFunctions[drawingMethod];

  outputFunction();

  setStatus('');

}

function draw_proof(start, end){
  var ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.moveTo(start[0],start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
}

const flipHorizontal = false;



function drawColoredPartMap() {
  const coloredPartImage = bodyPix.toColoredPartMask(partSegmentation);
  const opacity = 0.7;
  const flipHorizontal = false;
  const maskBlurAmount = 0;
  // Draw the colored part image on top of the original image onto a canvas.
  // The colored part image will be drawn semi-transparent, with an opacity of
  // 0.7, allowing for the original image to be visible under.
  bodyPix.drawMask(
      canvas, img, coloredPartImage, opacity, maskBlurAmount,
      flipHorizontal);
}


function maskBodyPart(bodyPartIds, partColor) {
  const background = {r: 0, g: 0, b: 0, a: 0} 
  
  const mask = bodyPix.toMask(partSegmentation, partColor, background, true, bodyPartIds);
  
  // the opacity of the mask
  const opacity = 1;
  // how much to blur the mask edges by
  const maskBlurAmount = 0;
  // if the output should be flipped horizontally,
  
  bodyPix.drawMask(
    canvas, img, mask, opacity, maskBlurAmount,
    flipHorizontal);

}

function drawImageOnCanvas() {
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
}

const warm = [
  [110, 64, 170], [106, 72, 183], [100, 81, 196], [92, 91, 206],
  [84, 101, 214], [75, 113, 221], [66, 125, 224], [56, 138, 226],
  [48, 150, 224], [40, 163, 220], [33, 176, 214], [29, 188, 205],
  [26, 199, 194], [26, 210, 182], [28, 219, 169], [33, 227, 155],
  [41, 234, 141], [51, 240, 128], [64, 243, 116], [79, 246, 105],
  [96, 247, 97],  [115, 246, 91], [134, 245, 88], [155, 243, 88]
];

function drawPartSegmentation() {
  if (!partSegmentation)
    return;
  
  // the colored part image is an rgb image with a corresponding color from thee rainbow colors for each part at each pixel, and black pixels where there is no part.
  const coloredPartImage = bodyPix.toColoredPartMask(partSegmentation, warm);
  const opacity = 1;
  const flipHorizontal = false;
  const maskBlurAmount = 0;
  
  const canvas = getCanvas();
  
  // draw the colored part image on top of the original image onto a canvas.  The colored part image will be drawn semi-transparent, with an opacity of 0.7, allowing for the original image to be visible under.
  bodyPix.drawMask(
    canvas, img.canvas, coloredPartImage, opacity, maskBlurAmount,
    flipHorizontal);

}

const facePartIds = [0, 1];
const torsoPartIds = [12, 13];
const armPartIds = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

function blurBodyParts() {
  if (!partSegmentation) return;
  
}

function getCanvas() {
  return document.getElementsByTagName('canvas')[0];
}

// Body Part Ids
// 0	left_face	12	torso_front
// 1	right_face	13	torso_back
// 2	left_upper_arm_front	14	left_upper_leg_front
// 3	left_upper_arm_back	15	left_upper_leg_back
// 4	right_upper_arm_front	16	right_upper_leg_front
// 5	right_upper_arm_back	17	right_upper_leg_back
// 6	left_lower_arm_front	18	left_lower_leg_front
// 7	left_lower_arm_back	19	left_lower_leg_back
// 8	right_lower_arm_front	20	right_lower_leg_front
// 9	right_lower_arm_back	21	right_lower_leg_back
// 10	left_hand	22	left_foot
// 11	right_hand	23	right_foot
