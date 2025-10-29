'use strict';
const { Console } = require('console');
var __createBinding = (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
            if (k2 === undefined)
                k2 = k;
            var desc = Object.getOwnPropertyDescriptor(m, k);
            if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                desc = {
                    enumerable: true,
                    get: function () {
                        return m[k];
                    },
                };
            }
            Object.defineProperty(o, k2, desc);
        }
        : function (o, m, k, k2) {
            if (k2 === undefined)
                k2 = k;
            o[k2] = m[k];
        });
var __setModuleDefault = (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
            Object.defineProperty(o, 'default', { enumerable: true, value: v });
        }
        : function (o, v) {
            o['default'] = v;
        });
var __importStar = (this && this.__importStar) ||
    (function () {
        var ownKeys = function (o) {
            ownKeys =
                Object.getOwnPropertyNames ||
                    function (o) {
                        var ar = [];
                        for (var k in o)
                            if (Object.prototype.hasOwnProperty.call(o, k))
                                ar[ar.length] = k;
                        return ar;
                    };
            return ownKeys(o);
        };
        return function (mod) {
            if (mod && mod.__esModule)
                return mod;
            var result = {};
            if (mod != null)
                for (var k = ownKeys(mod), i = 0; i < k.length; i++)
                    if (k[i] !== 'default')
                        __createBinding(result, mod, k[i]);
            __setModuleDefault(result, mod);
            return result;
        };
    })();
var __importDefault = (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.PdfToImg = void 0;
const pdfPoppler = __importDefault(require('pdf-poppler'));
const path = __importStar(require('path'));
const fs = __importStar(require('fs'));
class PdfToImg {
    constructor() {
        this.description = {
            displayName: 'PDF to Image',
            name: 'pdfToImg',
            icon: { light: 'file:icon.light.svg', dark: 'file:icon.dark.svg' },
            group: ['transform'],
            version: 1,
            description: 'Convert PDF files to images',
            defaults: {
                name: 'PDF to Image',
            },
            inputs: ['main'],
            outputs: ['main'],
            usableAsTool: true,
            properties: [
                {
                    displayName: 'Source',
                    name: 'source',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Binary',
                            value: 'binary',
                            description: 'Use binary data',
                        },
                    ],
                    default: 'binary',
                },
                {
                    displayName: 'Binary Field',
                    name: 'binaryFieldName',
                    type: 'string',
                    displayOptions: {
                        show: {
                            source: ['binary'],
                        },
                    },
                    default: 'data',
                    required: true,
                    description: 'The name of the binary field containing the PDF file',
                },
                {
                    displayName: 'PDF URL',
                    name: 'pdfUrl',
                    type: 'string',
                    displayOptions: {
                        show: {
                            source: ['url'],
                        },
                    },
                    default: '',
                    required: true,
                    description: 'URL of the PDF file to convert',
                },
                {
                    displayName: 'Image Quality (DPI)',
                    name: 'quality',
                    type: 'number',
                    typeOptions: {
                        minValue: 72,
                        maxValue: 600,
                    },
                    default: 200,
                    description: 'Output image quality/DPI (72-600)',
                },
            ],
        };
    }
    async convertPdftoImages(pdfBuffer) {
        console.log('PDF Buffer Length:', pdfBuffer.length);
        const results = [];
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
        const tempOutputDir = path.join(tempDir, `output_${Date.now()}`);
        if (!fs.existsSync(tempOutputDir)) {
            fs.mkdirSync(tempOutputDir, { recursive: true });
        }
        try {
            fs.writeFileSync(tempPdfPath, pdfBuffer);
            const options = {
                format: 'png',
                out_dir: tempOutputDir,
                out_prefix: 'page',
                page: null,
                dpi: 600,
            };
            const imagePaths = await pdfPoppler.default.convert(tempPdfPath, options);
            console.log('imagePaths DebugAM : ', imagePaths.length);
            const filesInDir = fs.readdirSync(tempOutputDir);
            const imageFiles = filesInDir.filter((file) => file.startsWith('page-') && file.endsWith('.png'));
            imageFiles.sort((a, b) => {
                const pageNumA = parseInt(a.replace('page-', '').replace('.png', ''));
                const pageNumB = parseInt(b.replace('page-', '').replace('.png', ''));
                return pageNumA - pageNumB;
            });
            for (const fileName of imageFiles) {
                const imagePath = path.join(tempOutputDir, fileName);
                const pageNumber = parseInt(fileName.replace('page-', '').replace('.png', ''));
                const imageBuffer = fs.readFileSync(imagePath);
                results.push({
                    data: imageBuffer,
                    filename: fileName,
                    pageNumber: pageNumber,
                    totalPages: imageFiles.length,
                });
            }
        }
        catch (error) {
            throw new Error(`PDF to Image conversion failed: ${error.message}`);
        }
        finally {
            try {
                if (fs.existsSync(tempPdfPath)) {
                    fs.unlinkSync(tempPdfPath);
                }
                if (fs.existsSync(tempOutputDir)) {
                    fs.rmSync(tempOutputDir, { recursive: true, force: true });
                }
            }
            catch (error) {
                console.error('Error cleaning up temp files:', error);
            }
        }
        return results;
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const length = items.length;
        const source = this.getNodeParameter('source', 0);
        const quality = this.getNodeParameter('quality', 0);
        for (let itemIndex = 0; itemIndex < length; itemIndex++) {
            let pdfBuffer;
            if (source === 'binary') {
                const binaryFieldName = this.getNodeParameter('binaryFieldName', itemIndex);
                if (!items[itemIndex].binary || !items[itemIndex].binary[binaryFieldName]) {
                    throw new Error(`No binary data found in field ${binaryFieldName}`);
                }
                const binaryData = items[itemIndex].binary[binaryFieldName];
                pdfBuffer = await Buffer.from(binaryData.data, 'base64');
            }
            if (!pdfBuffer || pdfBuffer.length === 0) {
                throw new Error('PDF data is empty');
            }
            const images = await PdfToImg.prototype.convertPdftoImages.call(this, pdfBuffer);
            if (images.length === 0) {
                throw new Error('No images were generated from the PDF.');
            }
            let result;
            const binaryData = {};
            for (const image of images) {
                const dataKey = `page_${image.pageNumber}`;
                const dataBase64 = image.data.toString('base64');
                binaryData[dataKey] = {
                    data: dataBase64,
                    mimeType: 'image/png',
                    fileExtension: 'png',
                    fileName: image.filename,
                };
            }
            result = {
                json: {
                    success: true,
                    totalPages: images[0].totalPages,
                    convertedPages: images.length,
                    exportMode: 'separate',
                    quality: quality,
                    images: images.map((img) => ({
                        pageNumber: img.pageNumber,
                        filename: img.filename,
                        size: img.data.length,
                    })),
                },
                binary: binaryData,
            };
            returnData.push(result);
        }
        return this.prepareOutputData(returnData);
    }
}
exports.PdfToImg = PdfToImg;
//# sourceMappingURL=PdfToImg.node.js.map