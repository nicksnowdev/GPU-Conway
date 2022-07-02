let font; // WebGL requires fonts to be loaded manually
let canvas;
let graphics1; // stage 1
let graphics2; // stage 2
let theShader;
let trailsShader;
let noiseShader;
let iterSlider;
let brushSlider;
let trails;
let showFrames;
let lastBrushX = 0; // for drawing smooth lines
let lastBrushY = 0;
let zoom = 1;
let panX = 0;
let panY = 0;
let halfWidth;
let halfHeight;
let pauseButton;
let paused = false;
const fps = [];


function preload() {
  font = loadFont("arial.ttf"); // web-safe font
  theShader = loadShader("shader.vert", "shader.frag"); // conway shader
  trailsShader = loadShader("shader.vert", "trails.frag");
  noiseShader = loadShader("shader.vert", "noise.frag"); // white -> noise
}


// displays the average framerate over a given history size
function draw_fps_avg(hist = 3, bg = true, margin = 2) {
  // update the rolling window of framerates
  if(fps.push(frameRate()) > hist) {
    fps.shift();
  } else { // if the array is smaller than it should be:
    for(let i = 0; i < hist; i++) {
      fps.push(frameRate()); // grow the array up to size
    }
  }

  // average the samples
  let fpsAvg = 0;
  for(let i = 0; i < hist; i++) {
    fpsAvg += fps[i];
  }
  let fpsText = (fpsAvg / hist).toFixed(0);

  // deal with WebGL's center origin
  let halfWidth = width * .5;
  let halfHeight = height * .5;
  // draw background if necessary
  push(); // begin a new drawing state
  textFont(font, 15); // set this here so we know the height of the font
  if(bg) {
    fill(0, 127);
    noStroke();
    rect(-halfWidth, halfHeight - textAscent() - margin * 2, textWidth(fpsText) + margin * 2, textAscent() + margin * 2);
  }
  // draw framerate text in the bottom left with no decimal places
  fill(0, 200, 255, 255);
  stroke(0, 255); // stroke doesn't work with WebGL apparently, but i'm leaving it in.
  strokeWeight(2);
  text(fpsText, -halfWidth + margin, halfHeight - margin);
  pop(); // restore drawing state
}

// called when pause button is clicked
function toggle_pause() {
  if(!paused) {
    pauseButton.html("resume")
    paused = true;
  } else {
    pauseButton.html("pause")
    paused = false;
  }
}

// THIS PREVENT CONTEXT MENU WHEN RIGHT-CLICKING ON THE CANVAS
document.oncontextmenu = function() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height)
    return false;
}

// called when iterSlider is changed
function iterSlider_input() {
  iterText.value(iterSlider.value());
}

// called when iterText is changed
function iterText_input() {
  iterSlider.value(iterText.value());
}

// called when brushSlider is changed
function brushSlider_input() {
  brushText.value(brushSlider.value());
}

// called when brushText is changed
function brushText_input() {
  brushSlider.value(brushText.value());
}

function randomize_cells() {
  graphics1.loadPixels();
  for(let y = 0; y < height; y++) {
    for(let x = 0; x < width; x++) {
      index = (x + y * width) * 4;
      val = random(1).toFixed(0) * 255;
      graphics1.pixels[index + 0] = val;
      graphics1.pixels[index + 1] = trails.checked() ? 0 : val;
      graphics1.pixels[index + 2] = trails.checked() ? 0 : val;
    }
  }
  graphics1.updatePixels();

  // also unpause
  pauseButton.html("pause")
  paused = false;
}

function clear_cells() {
  graphics1.background(0);

  // also unpause
  pauseButton.html("pause")
  paused = false;
}

// this function kind of got away from me, but it works. the whole zoomcheck thing is messy but whatever.
function zoomControl(event) {
  let zoomCheck = zoom;
  if(event.deltaY < 0) {
    zoom = min(16, zoom * 2);
    if(zoomCheck != zoom) { // only center the zoom if a zoom adjustment actually occurred
      panX -= (mouseX - halfWidth) / zoom;
      panY -= (mouseY - halfHeight) / zoom;
    }
  } else {
    zoom = max(1, zoom * .5);
    if(zoomCheck != zoom) { // only center the zoom if a zoom adjustment actually occurred
      panX += (mouseX - halfWidth) / zoom * .5;
      panY += (mouseY - halfHeight) / zoom * .5;
    }
  }
  if(zoomCheck != zoom) {
    panX = min(max(-halfWidth / zoom * (zoom - 1), panX), halfWidth / zoom * (zoom - 1)); // auto-adjust panning when zooming out
    panY = min(max(-halfHeight / zoom * (zoom - 1), panY), halfHeight / zoom * (zoom - 1));
  }
}

// this is a built-in function
function mouseDragged(event) {
  if(mouseButton == CENTER) {
    panX = min(max(-halfWidth / zoom * (zoom - 1), panX + event.movementX / zoom), halfWidth / zoom * (zoom - 1));
    panY = min(max(-halfHeight / zoom * (zoom - 1), panY + event.movementY / zoom), halfHeight / zoom * (zoom - 1));
  }
  return true;
}


function setup() {
  pixelDensity(1); // account for high-density displays
  canvas = createCanvas(707, 707, WEBGL); // 3D mode to allow shaders, also 707^2 is about 500,000 pixels
  background(0); // initialize
  canvas.position((windowWidth - width) / 2, 32); // center the window
  halfWidth = width * .5;
  halfHeight = height * .5;
  graphics1 = createGraphics(width, height); // create a 2D graphics buffer
  graphics1.background(0); // initialize
  graphics2 = createGraphics(width, height, WEBGL); // create a 3D graphics buffer
  graphics2.background(0); // initialize

  // set up controls for iterations
  iterSlider = createSlider(1, 100, 1);
  iterSlider.position(10, 100);
  iterSlider.style("width", "150px");
  iterSlider.input(iterSlider_input);
  iterText = createInput(str(iterSlider.value()), "number");
  iterText.position(10, 70);
  iterText.style("width", "40px")
  iterText.input(iterText_input);
  let iterTextLabel = createP("iterations per frame");
  iterTextLabel.position(65, 57);
  iterTextLabel.style("color", "#FFFFFF");
  iterTextLabel.style("font-family", "Arial");

  // set up controls for painting
  brushSlider = createSlider(1, 100, 20);
  brushSlider.position(10, 180);
  brushSlider.style("width", "150px");
  brushSlider.input(brushSlider_input);
  brushText = createInput(str(brushSlider.value()), "number");
  brushText.position(10, 150);
  brushText.style("width", "40px")
  brushText.input(brushText_input);
  let brushTextLabel = createP("brush size (Paint|Erase)");
  brushTextLabel.position(65, 137);
  brushTextLabel.style("color", "#FFFFFF");
  brushTextLabel.style("font-family", "Arial");

  // set up checkbox for trails
  trails = createCheckbox("enable trails", true);
  trails.position(10, 230);
  trails.style("color", "#FFFFFF");
  trails.style("font-family", "Arial");

  // show framerate
  showFrames = createCheckbox("show framerate", false);
  showFrames.position(10, 260);
  showFrames.style("color", "#FFFFFF");
  showFrames.style("font-family", "Arial");

  // set up a reset button
  resetButton = createButton("fill screen");
  resetButton.position(80, 10);
  resetButton.mousePressed(randomize_cells);

  // set up a clear button
  resetButton = createButton("clear");
  resetButton.position(170, 10);
  resetButton.mousePressed(clear_cells);

  // set up a pause button
  pauseButton = createButton("pause");
  pauseButton.position(10, 10);
  pauseButton.mousePressed(toggle_pause);

  // set up zoom controls
  canvas.mouseWheel(zoomControl);

  // start with binary noise
  //randomize_cells();
}

function draw() {
  if(!paused) {
    // multiple iterations per frame
    for(let i = 0; i < iterSlider.value(); i++) {
      // draw graphics1 to graphics2 through the shader
      graphics2.push();
      graphics2.fill(255);
      graphics2.noStroke();
      if(trails.checked()) {
        graphics2.shader(trailsShader); // set the shader
        trailsShader.setUniform("u_texture", graphics1); // pass in the buffer as a uniform sampler2D
        trailsShader.setUniform("u_texel", [1 / width, 1 / height]);
        trailsShader.setUniform("u_gMax", 1.0);
        trailsShader.setUniform("u_bMax", 0.5);
        trailsShader.setUniform("u_gGrow", 0.0025);
        trailsShader.setUniform("u_bGrow", 0.0025);
        trailsShader.setUniform("u_gDecay", 0.0);
        trailsShader.setUniform("u_bDecay", 0.0);
      } else {
        graphics2.shader(theShader); // set the shader
        theShader.setUniform("u_texture", graphics1); // pass in the buffer as a uniform sampler2D
        theShader.setUniform("u_texel", [1 / width, 1 / height]);
      }
      graphics2.rect(-halfWidth, -halfHeight, width, height); // a container (the size of graphics1) to draw through the shader
      graphics2.pop(); // this resets the shader, otherwise need to call resetShader()

      // paint!
      // this has to go on graphics1 because it's 2D. painting on the 3D one is a disaster.
      graphics1.clear();
      let paintX = (mouseX - halfWidth) / zoom + halfWidth - panX; // the half vars cancel out at zoom = 1
      let paintY = (mouseY - halfHeight) / zoom + halfHeight - panY;
      let breaker = 0;
      if(!breaker && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        breaker = 1; // prevent running this section 100 times a frame
        // paint the lines
        let painted = 0;
        if(mouseIsPressed && (mouseButton == LEFT || mouseButton == RIGHT)) {
          painted = 1;
          graphics1.push();
          graphics1.fill(255 * (mouseButton == LEFT)); // white on LMB, black on RMB
          graphics1.noStroke();
          graphics1.ellipse(paintX, paintY, brushSlider.value());
          graphics1.stroke(255 * (mouseButton == LEFT));
          graphics1.strokeWeight(brushSlider.value())
          graphics1.line(lastBrushX, lastBrushY, paintX, paintY);
          graphics1.pop();
        }
        lastBrushX = paintX;
        lastBrushY = paintY;
        // only run this extra shader pass if something was painted
        if(painted) {
          // draw the paint from graphics1 to graphics2 through the noise shader
          graphics2.push();
          graphics2.fill(255);
          graphics2.noStroke();
          graphics2.shader(noiseShader); // set the shader
          noiseShader.setUniform("u_texture", graphics1); // pass in the buffer as a uniform sampler2D
          noiseShader.setUniform("u_targetTexture", graphics2) // pass in graphics2 for blending
          noiseShader.setUniform("u_time", millis() * .001); // randomize the noise, lol
          noiseShader.setUniform("u_blend", trails.checked() ? [1, 0, 0] : [1, 1, 1]); // make alive pixels red if trails is on
          graphics2.rect(-halfWidth, -halfHeight, width, height); // a container (the size of graphics1) to draw through the shader
          graphics2.pop(); // this resets the shader, otherwise need to call resetShader()
        } else { // also hide the brush outline while painting
          // draw the brush shape
          push();
          noFill();
          stroke(255);
          strokeWeight(2);
          // i haven't wrapped my head around this calculation, all i know is i have to multiply zoom back in here for
          // the ellipse to draw in the right location.
          ellipse((paintX - halfWidth + panX) * zoom, (paintY - halfHeight + panY) * zoom, brushSlider.value() * zoom);
          pop();
        }
      }
      // draw final state of the automaton back to graphics1 as an image
      graphics1.image(graphics2, 0, 0);
    }
  }
  // draw graphics2 to the canvas with desired zoom
  // having this outside the pause check lets you zoom and pan while paused
  texture(graphics2);
  rect((-halfWidth + panX) * zoom, (-halfHeight + panY) * zoom, width * zoom, height * zoom);
  
  if(showFrames.checked()) {
    draw_fps_avg();
  }
}