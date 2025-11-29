const upload_box = document.querySelector(".upload-box");
const upload_box_text = upload_box.querySelector(".upload-text");
const input_element = document.querySelector("input[type='file']");
const bounding_box_container = document.querySelector("#bounding-box-container");

const canvas_wrapper = document.getElementById("canvas-container");
const canvas = document.getElementById("bb-preview");
const canvas_ctx = canvas.getContext("2d");

let timer = 0;

let class_colors = {
    "0": "#FFFF00",
    "1": "#FF0000",
    "2": "#FF0000",
    "3": "#FF0000",
    "4": "#A020F0"
}

upload_box.addEventListener("click", () =>{
    input_element.click();
});
input_element.addEventListener("change", handleImageSelect);

function removeAllChildren(parentElement) {
  while (parentElement.firstChild) {
    parentElement.removeChild(parentElement.firstChild);
  }
}

function handleImageSelect(e){
    e.preventDefault();
    const imageData = this.files[0];
    previewImage().then(({ img_preview, ratio }) => {
        removeAllChildren(bounding_box_container);
        call_model_API(imageData, img_preview, ratio);
    }).catch((error) => {
        console.log(`An error occured: ${error}`);
    });
}

function call_model_API(imageData, img_preview, ratio){
    const url = "https://straightforwardly-sparkless-darrel.ngrok-free.dev/upload/";
    const formData = new FormData();
    formData.append("file", imageData, imageData.name);

    const fetchOptions = {
        method: "POST",
        body: formData
    };
    fetch(url, fetchOptions)
    .then(res => res.json())
    .then(data => {
        console.log(data.result);
        canvas.classList.remove("blurred");
        upload_box_text.style.display = "none";
        clearInterval(timer);
        draw_bounding_boxes(data, img_preview, ratio);
    })
}

function draw_bounding_boxes(results, img_preview, ratio){
    // Draw the bounding boxes
    boxes = results.result.boxes;
    classes = results.result.classes;
    scores = results.result.scores;

    img_height = canvas.height / ratio;
    img_width = canvas.width / ratio;
    num_rows = Math.ceil(img_height / 256);
    num_cols = Math.ceil(img_width / 256);
    
    for(i = 0; i < boxes.length; i++){
        subset_boxes = boxes[i];
        subset_classes = classes[i];
        subset_scores = scores[i];
        
        for(j = 0; j < subset_boxes.length; j++){
            box = subset_boxes[j];
            cls = subset_classes[j];
            score = subset_scores[j];

            cur_row = Math.max(Math.floor(i / num_cols) * 256, 1);
            cur_col = Math.max(i % num_cols * 256, 1);

            if(box.length > 0){
                x = (box[0] + (cur_col)) * ratio;
                y = (box[1] + (cur_row)) * ratio;
                box_width = (box[2] - box[0]) * ratio;
                box_height = (box[3] - box[1]) * ratio;

                draw_circle([x, y, box_width, box_height], ratio, box, [x, y, box_width, box_height], img_preview, cur_row, cur_col, cls);
            }
        }
    }
}

function draw_circle(box, ratio, original_box, new_box, img_preview, row, col, cls){
    const image_size = 64 * (ratio) * 5;

    const center_x = box[0] + (box[2] / 2);
    const center_y = box[1] + (box[3] / 2);
    const radius = image_size / 3

    // ---------- Draw circular border ----------
    canvas_ctx.beginPath();
    canvas_ctx.arc(center_x, center_y, radius, 0, Math.PI * 2);
    canvas_ctx.lineWidth = 3;
    canvas_ctx.strokeStyle = class_colors[cls];  // border color
    canvas_ctx.stroke();

    create_circle_element(center_x, center_y, radius, original_box, new_box, img_preview, row, col, ratio, cls);
}

function create_circle_element(x, y, radius, original_box, new_box, img_preview, row, col, ratio){
    // create the hoverable element
    const bounding_box = document.createElement('div');
    bounding_box.classList.add("circle");

    // move it over the bounding box
    bounding_box.style.position = 'absolute';
    bounding_box.style.top = `${y - radius}px`;
    bounding_box.style.left = `${x - radius}px`;

    // set it to the correct size to match the circle
    bounding_box.style.width = `${radius * 2}px`;
    bounding_box.style.height = `${radius * 2}px`;
    bounding_box.style.borderRadius = '50%';

    bounding_box.addEventListener(
        "mouseover",
        () => zoom(original_box, new_box, img_preview, row, col, ratio, 128)
    );
    bounding_box.addEventListener(
        "mouseout",
        () => zoom(original_box, new_box, img_preview, row, col, ratio, 128 / ratio)
    );

    bounding_box_container.appendChild(bounding_box);
}

function zoom(original_box, new_box, img_preview, row, col, ratio, size) {
    const original_image_size = size;
    console.log(`size: ${size}`);
    const image_size = 64 * ratio * 5;

    // Crop parameters
    const sx = original_box[0] + (col) + (original_box[2] - original_box[0]) / 2 - (original_image_size / 2)
    const sy = original_box[1] + (row) + (original_box[3] - original_box[1]) / 2 - (original_image_size / 2)
    const sWidth = original_image_size;
    const sHeight = original_image_size;

    // Where to draw on canvas
    const dx = new_box[0] + (new_box[2] / 2) - (image_size / 2);
    const dy = new_box[1] + (new_box[3] / 2) - (image_size / 2);
    const dWidth = image_size;
    const dHeight = image_size;

    console.log(`ratio: ${ratio}`);
    // Circle parameters
    const cx = new_box[0] + (new_box[2] / 2);
    const cy = new_box[1] + (new_box[3] / 2);
    const radius = image_size / 3;

    // ---------- 1. Clip to circle ----------
    canvas_ctx.save();
    canvas_ctx.beginPath();
    canvas_ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    canvas_ctx.closePath();
    canvas_ctx.clip();

    // ---------- 2. Draw the cropped region ----------
    canvas_ctx.drawImage(
        img_preview,
        sx, sy, sWidth, sHeight,   // source crop
        dx, dy, dWidth, dHeight    // destination (circle area)
    );

    canvas_ctx.restore();
}

function map_image_to_canvas(img_preview){
    canvas.classList.add("blurred");
    
    const aspect = img_preview.height / img_preview.width;
    let ratio = canvas.width / img_preview.width;

    canvas.height = canvas.width * aspect;
    canvas_ctx.drawImage(img_preview, 0, 0, canvas.width, canvas.height);

    upload_box_text.textContent = "Finding Waldo";
    upload_box_text.style.display = "block";
    timer = setInterval(() => dotdotdot(upload_box_text.textContent), 500);

    return ratio;
}

function previewImage(){
    //e.preventDefault();
    return new Promise((resolve, reject) => {
        const file = input_element.files[0];
        const reader = new FileReader();
        ratio = 0;

        // This load handles the file being read into the reader,
        // not the image into the img_preview
        reader.addEventListener("load", () => {
            // Create the image and draw it on the Canvas
            const img_preview = document.createElement("img");
            img_preview.src = reader.result;

            // The reason that we need this is because when we
            // set the image source, we have to wait for the
            // image to finish load into the variable
            img_preview.addEventListener("load", () => {
                resizeCanvas();
                let ratio = map_image_to_canvas(img_preview);
                resolve({img_preview, ratio});
            });
        });

        if (file) {
            // Swap the text for a canvas and read the file
            canvas.style.display = 'block';
            upload_box_text.style.display = "none";
            reader.readAsDataURL(file);
        }else{
            reject("Invalid Image passed");
        }
    })
}

function resizeCanvas() {
    const canvas = document.getElementById("bb-preview");
    const container = document.getElementById("canvas-container");

    canvas.width  = container.clientWidth;   // internal pixels
    canvas.height = container.clientHeight;  // internal pixels
}

function dotdotdot(input){
    if(input.length == 16){
        upload_box_text.textContent = "Finding Waldo.";
    }else{
        upload_box_text.textContent += ".";
    }
}

