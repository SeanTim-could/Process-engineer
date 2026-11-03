const assert=require('node:assert/strict'),fs=require('node:fs/promises');
// Decode the downloaded file in Chromium; checking a screenshot would conceal
// the difference between a transparent PNG and a white application surface.
async function assertTransparentPng(page,file,samples=[]){
 const bytes=await fs.readFile(file);assert.equal(bytes.subarray(1,4).toString(),'PNG');
 const result=await page.evaluate(async({encoded,samples})=>{
  const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),pixel=(x,y)=>[...data.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+4)];
  let transparent=0,visible=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;else visible++;}
  return {width:canvas.width,height:canvas.height,transparent,visible,corners:[[1,1],[canvas.width-2,1],[1,canvas.height-2],[canvas.width-2,canvas.height-2]].map(([x,y])=>pixel(x,y)[3]),samples:samples.map(([x,y])=>pixel(x,y))};
 },{encoded:bytes.toString('base64'),samples});
 assert(result.width>0&&result.height>0);assert.deepEqual(result.corners,[0,0,0,0],file+' must have transparent corners');assert(result.transparent>1000&&result.visible>100,file+' must retain both transparent space and plotted content');return result;
}
module.exports={assertTransparentPng};
