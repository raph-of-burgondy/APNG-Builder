# APNG-Builder




This script implements the APNGmaker class which takes an Array of HTMLCanvasElement and returns asynchronously an Animated PNG as a blob.
APNG format is supported on most desktop or mobile browsers (MS Edge, Chrome, Firefox, Safari, ...)
This script has been written as an alternative solution for animating HTMLCanvasElement as far as the excellent module [whammy.js](https://github.com/antimatter15/whammy) needs "image/Webp" format during process which is only supported by Chrome and MS Edge.

For more information on APNG format, see : 
* https://caniuse.com/#feat=apng
* https://developer.mozilla.org/en-US/docs/Mozilla/Tech/APNG


 ## Usage
 
 Documentation [here](https://raph-of-burgondy.github.io/APNG-Builder/)

```javascript
//create a APNG blob from images (array of canvas) FPS of 60 and with 1 play
var APNGblob = await new APNGmaker(images,60,1)
var url = URL.createObjectURL(APNGblob)
//create link for downloading as myAPNGfile.png
var a = document.querySelector("a")
a.setAttribute("download","myAPNGfile.png")
a.href = url
//display the APNG in browser
var img = document.querySelector("img")
img.src = url
await img.decode()
```


## MIT Licence

