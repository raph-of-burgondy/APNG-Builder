/**
 * @license MIT
 * @Copyright 2020 Raphaël LEFEVRE.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @file This script implements the APNGmaker class which takes an Array of HTMLCanvasElement
 * and returns asynchronously an Animated PNG as a blob.
 * <br>APNG format is supported on most desktop or mobile browsers (MS Edge, Chrome, Firefox, Safari, ...)
 * <br>This script has been written as an alternative solution for animating HTMLCanvasElement
 * as far as the excellent module whammy.js {@link https://github.com/antimatter15/whammy}
 * needs "image/Webp" format during process which is only supported by Chrome and MS Edge.
 * @see https://caniuse.com/#feat=apng
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/APNG
 * @author Raphael LEFEVRE <raffael.lefevre@gmail.com>
 */


/**
*
*APNGmaker
*
* @class
* @classdesc generate asynchronously a APNG blob from an array of canvas
* @async
* @param {Array<HTMLCanvasElement>} images - array of canvas as source for the Animated PNG
* @param {number} [FPS=30] - the expected FPS
* @param {number} [numplays=0] - set numbers of plays, 0 for infinite loop
* @returns {blob} the Animated PNG from sources, mime type is "image/png"
*
* @example
* //create a APNG blob from images (array of canvas) FPS of 60 and with 1 play
* var APNGblob = await new APNGmaker(images,60,1)
* var url = URL.createObjectURL(APNGblob)
* //create link for downloading as myAPNGfile.png
* var a = document.querySelector("a")
* a.setAttribute("download","myAPNGfile.png")
* a.href = url
* //display the APNG in browser
* var img = document.querySelector("img")
* img.src = url
* await img.decode()
*
*@fires document#imageEncoded
*
*@author Raphael LEFEVRE <raffael.lefevre@gmail.com>
*/
class APNGmaker {
  constructor (images,FPS, numplays) {
    this.width = images[0].width
    this.height= images[0].height
    this.FPS=FPS||30
    this.numplays=numplays||0

    this.signature = new ArrayBuffer(8)
    var sign8 = new Uint8Array(this.signature)
    sign8.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0)

    var IHDRdata = new ArrayBuffer(13)
    var dvIHDR = new DataView(IHDRdata)
    dvIHDR.setUint32(0,this.width)
    dvIHDR.setUint32(4,this.height)
    var options= new Uint8Array(IHDRdata,8,5)
    options.set([8,6,0,0,0],0)
    this.IHDR = this.buildChunk("IHDR", IHDRdata)

    this.iEND = new ArrayBuffer(12)
    var iEND8 = new Uint8Array(this.iEND)
    iEND8.set([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82], 0)

    this.frames = new Array() //constains chunks
    this.images = new Array() //contains datas(IDAT)

    return (async ()=>{
      var p = []
      for (let i=0; i<images.length; i++) {
        p.push(this.add(i,images[i]))
      }
      await Promise.all(p)

      return this.build()
    })()
  }



  /**
   * add - asynchronously parse a source canvas as PNG and add the IDAT blocks to the ith image
   *
   * @param  {number} i - index of the destination image
   * @param  {HTMLCanvasElement} can - the canvas as source
   * @return     set this.images[i]
   * @private
   */
  async add(i,can) {
    console.log("added")
    var blob = await new Promise (function(resolve) {can.toBlob(blob=>resolve(blob),"image/png")})
    var buffer = await blob.arrayBuffer()

    var IDATes = lookForIDAT(buffer)

    this.images[i]=IDATes
    /**
    *@event APNGmaker#imageEncoded
    *@desc  when fired, this event indicates an image has been parsed from canvas, for progress watching purpose
    * in browser, listen as document.addEventListener("imageEncoded")
    */
    document.dispatchEvent(new Event("imageEncoded"))
  }


  /**
   * build - builds APNG blob
   *
   * @return {Blob}  APNG blob type "image/png"
   * @private
   */
  build() {

    var seq = 0
    var acTLdata = new ArrayBuffer(8)
    var dv_acTL = new DataView(acTLdata)
    dv_acTL.setUint32(0,this.images.length)//num_frames
    dv_acTL.setUint32(4,this.numplays)//numplays, 0 = infinite
    var acTL= this.buildChunk("acTL",acTLdata)

    this.images.forEach((data,i)=>{

      var fcTL = new ArrayBuffer(26)

      var fcTL_dv = new DataView(fcTL)

      fcTL_dv.setUint32(0,seq++)//sequence_number
      fcTL_dv.setUint32(4,this.width)//width
      fcTL_dv.setUint32(8,this.height)//height

      fcTL_dv.setUint16(20,1)//delay_num
      fcTL_dv.setUint16(22,this.FPS)//delay_den

      fcTL_dv.setUint8(24,0) //dispose_op
      fcTL_dv.setUint8(25,0) //blend_op

      if (i==0) {

        var IDATchunks = new Array()
        for (let i=0;i<data.length;i++) {
          IDATchunks.push(this.buildChunk("IDAT", data[i]))
        }
        this.frames.push(joinBuffers(this.buildChunk("fcTL",fcTL), ...IDATchunks))

      }else {

        var fdATChunks = new Array()
        for (let i=0;i<data.length;i++) {
          var sequence_number = new ArrayBuffer(4)
          var sn_dv = new DataView(sequence_number)
          sn_dv.setUint32(0,seq++)
          var fdAT = joinBuffers(sequence_number,data[i])
          fdATChunks.push(this.buildChunk("fdAT", fdAT))
        }
        this.frames.push(joinBuffers(this.buildChunk("fcTL",fcTL), ...fdATChunks))
      }
    })
    return  new Blob([this.signature, this.IHDR, acTL, ...this.frames, this.iEND],{type:"image/apng"})
  }



  /**
   * buildChunk - build a well formatted chunk
   *
   * @param  {string} type - the type of the chunck (i.e. : IDAT, fcTL, acTL)
   * @param  {ArrayBuffer} data - datas of the chunk
   * @return {ArrayBuffer}  well formatted chunk
   * @private
   */
  buildChunk(type,data) {

    var length = new ArrayBuffer(4)
    var l_dv = new DataView(length)
    l_dv.setUint32(0,data.byteLength)

    var t = new ArrayBuffer(4)
    var t_dv = new DataView(t)
    t_dv.setUint8(0,type.charCodeAt(0))
    t_dv.setUint8(1,type.charCodeAt(1))
    t_dv.setUint8(2,type.charCodeAt(2))
    t_dv.setUint8(3,type.charCodeAt(3))

    var crc = new ArrayBuffer(4)
    var crcview = new DataView(crc)
    crcview.setUint32(0, crc32(joinBuffers(t,data)))

    return joinBuffers(length,t,data,crc)
  }

}



/**
 * joinBuffers - concatenate arrayBuffer's
 *
 * @param  {Array<ArrayBuffer>} buffers - to be concateneted
 * @return {ArrayBuffer}   the concateneted ArrayBuffer
 * @private
 */
function joinBuffers(...buffers) {

  var l = buffers.reduce((a,b) => a+b.byteLength, 0)

  var out=new ArrayBuffer(l)
  var out8 = new Uint8Array(out)
  var offset=0
  buffers.forEach(b=>{
    out8.set(new Uint8Array(b), offset)
    offset+=b.byteLength
  })
  return out
}



/**
 * lookForIDAT - parse an arraybuffer from a PNG image and retruns the IDAT chunks
 *
 * @param  {ArrayBuffer} ab - arraybuffer from a PNG image
 * @return {Array<ArrayBuffer>}     IDAT chunks
 * @private
 */
function lookForIDAT(ab) {

  var IDATs = new Array()

  var view = new DataView(ab)

  // signature 8 bytes + IHDR 25 bytes + length IDAT chunk 4 bytes
  var offset = 37

  var end = false
  while(!end) {
    var chunktype = new Uint8Array(ab,offset,4)
    chunktype = String.fromCharCode(...chunktype)
    switch (chunktype) {
      case "IDAT":
        var l = view.getUint32(offset-4)
        var idat_buf = new ArrayBuffer(l)
        var idat_view = new Uint8Array(idat_buf)
        idat_view.set(new Uint8Array(ab,offset+4,l))
        IDATs.push(idat_buf)
        offset += l+12//4+l+4+4
        break;
      case "IEND":
        end=true

        break;
      default:
        throw("oups... unexpected chunk type found : ", chunktype)

    }
  }

  return IDATs
}



/**
 * @function crc32
 * @description compute the crc-32 of an ArrayBuffer
 * @param  {ArrayBuffer} ab - the arraybuffer to be hashed
 * @return {number} the crc-32 hash
 */
var crc32 = (function() {
    var table = new Uint32Array(256);
    for(var i=256; i--;) {
        var tmp = i;
        for(var k=8; k--;) {
            tmp = tmp & 1 ? 3988292384 ^ tmp >>> 1 : tmp >>> 1;
        }
        table[i] = tmp;
    }
    return function( ab ) {
        var data = new Uint8Array(ab)
        var crc = -1;
        for(var i=0, l=data.length; i<l; i++) {
            crc = crc >>> 8 ^ table[ crc & 255 ^ data[i] ];
        }
        return (crc ^ -1) >>> 0;
    };
})();
