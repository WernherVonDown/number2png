const CRC32 = require('buffer-crc32');
const ADLER32 = require('adler32');
const fs = require('fs');
const zlib0 = require('zlib')
const numbers = require('./numbers.json') // массив с изображениями 5х7 пикселей, где каждый байт - 1 пиксель

const NUMWIDTHCONST = 5; //ширина изображения
const NUMHEIGHT = 7; // высота изображения
let num = process.argv[2]; // Получаем число из аргумента.

//метод делает из многомерного массива одномерный.
Object.defineProperty(Array.prototype, 'flat', {
    value: function(depth = 1) {
      return this.reduce((flat, toFlatten) => {
        return flat.concat((Array.isArray(toFlatten) && (depth>1)) ? toFlatten.flat(depth-1) : toFlatten);
      }, []);
    }
});

if(typeof +num == "number") //проверка на число
  start(num, (result)=>{
    // запись результата в файл
    fs.writeFile("result.png", result,  "binary",function(err) {
      if(err)
        console.log(err);
      else
        console.log(`Изображение с числом '${num}' сохранено!`);
    });
  });
else
  console.log("Вы ввели данные не в том формате :(");

function start(num, callback){
  console.log('Вы ввели: '+num);
  let arr = [], newArr = [], after = false, col;
  let NUMWIDTH = NUMWIDTHCONST *num.length; //изменяем ширину изображения на кол-во цифр.

  //соединяем изображения различных цифр, чтобы соответсвующие строчки шли друг за другом
  for(let i = 0; i < num.length; i++){
    //если num[i] это '.', то рисуем ее на предыдущей цифре, переходим на следующую и уменьшаем конечную длину изображения т.к. '.' не рисуется отдельно
    num[i] == '.' && (newArr[i-1][NUMHEIGHT-2][NUMWIDTHCONST-1]='0', newArr[i-1][NUMHEIGHT-1][NUMWIDTHCONST-1]='0', i++, NUMWIDTH -= NUMWIDTHCONST, after = true)
    let tmpArr = numbers[num[i]].split(' ').map(el=>parseInt(el,16));
    col = after?50:0 // установка цвета, after указывает, находимся ли мы после точки. (из-за выбранных настроек доступны только оттенки серого)
    tmpArr = tmpArr.map(e=>e==0?col:e) //меняем цвет цифры
    let tmp2 = [];
    while(tmpArr.length)
      tmp2.push(tmpArr.splice(0,NUMWIDTHCONST))
    newArr.push(tmp2)
  }
  let tmp = newArr[0].map((col, i) => newArr.map(row => row[i]))
  tmp = tmp.map(e=>e.concat(['255']));
  let input = new Buffer(tmp.flat(Infinity));
  let compressed = zlib0.deflateSync(input); //сжимаем получившиеся пиксели

  let pixels = compressed;

  //Формируем ihdr chunk
  let header = new Buffer(['89', '50', '4E', '47', '0D', '0A', '1A', '0A'].map(el=>parseInt(el, 16)));
  let ihdrSize = new Buffer(['00', '00', '00', '0D'].map(el=>parseInt(el, 16)));
  let ihdrStart = new Buffer(['49', '48', '44', '52'].map(el=>parseInt(el, 16)));
  let width = new Buffer.alloc(4);
  width.writeInt8(NUMWIDTH, width.length-1);
  let height = new Buffer.alloc(4);
  height.writeInt8(NUMHEIGHT, height.length-1);
  let settings = new Buffer(['08', '00', '00', '00', '00'].map(el=>parseInt(el, 16))); // настройки: BitDepths:8, ColorType:0, compressionMethod:0, filterMethod:0,interlace:0
  let crcBuffer = Buffer.concat([ihdrStart,width,height,settings]);
  let checkSum = CRC32.unsigned(crcBuffer).toString(16);
  let checkSumBuf = new Buffer.alloc(4);
  checkSumBuf.write(checkSum,'hex');
  let ihdr = Buffer.concat([header, ihdrSize,crcBuffer,checkSumBuf]);

  //Формируем idat chunk
  let dataLen = pixels.length;
  let idatSize = new Buffer.alloc(4);
  idatSize.writeInt8(4+dataLen, idatSize.length-1);
  let idatStart = new Buffer(['49', '44', '41', '54'].map(el=>parseInt(el, 16)));
  let filter = new Buffer(['00'].map(el=>parseInt(el, 16)));
  let adler32 = new Buffer.alloc(4);
  let adlerBuf = Buffer.concat([filter,pixels]);
  adler32.write(ADLER32.sum(adlerBuf).toString(16), 'hex')
  let idatCrc = Buffer.concat([idatStart,pixels,adler32]);
  let idatCheckSum = CRC32.unsigned(idatCrc).toString(16)
  let idatCheckSumBuf = new Buffer.alloc(4);
  idatCheckSumBuf.write(idatCheckSum,'hex');
  let idat = Buffer.concat([idatSize, idatStart,pixels, adler32, idatCheckSumBuf]);

  //Формируем iend chunk
  let iEnd = new Buffer(['00', '00', '00', '00', '49', '45', '4E', '44','AE', '42', '60', '82'].map(el=>parseInt(el, 16)));

  //собираем все чанки вместе
  let buf = Buffer.concat([ihdr, idat, iEnd])
  //передаем буфер с данными в функцию обратного вызова
  callback(buf)
}
