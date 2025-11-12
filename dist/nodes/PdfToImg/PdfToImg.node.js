"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfToImg = void 0;
const pdfPoppler = __importStar(require("pdf-poppler-myfixed"));
const path = __importStar(require("path"));
const fs_1 = require("fs");
const os_1 = require("os");
class PdfToImg {
    constructor() {
        this.description = {
            displayName: 'PDF to Image',
            name: 'pdfToImg',
            icon: { light: 'file:icon.light.svg', dark: 'file:icon.dark.svg' },
            group: ['transform'],
            version: 1,
            description: 'Convert PDF files to images',
            usableAsTool: true,
            defaults: {
                name: 'PDF to Image',
            },
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Binary Field',
                    name: 'binaryFieldName',
                    type: 'string',
                    default: 'data',
                    required: true,
                    description: 'The name of the binary field containing the PDF file',
                },
                {
                    displayName: 'Image Quality (DPI)',
                    name: 'density',
                    type: 'number',
                    typeOptions: {
                        minValue: 72,
                        maxValue: 600,
                    },
                    default: 200,
                    description: 'Output image quality/DPI (72-600)',
                },
                {
                    displayName: 'Scale',
                    name: 'scale',
                    type: 'number',
                    default: 1,
                    description: 'Image Scale',
                },
                {
                    displayName: 'Page Start',
                    name: 'page_start',
                    type: 'number',
                    default: null,
                    description: 'Specifies the first page to convert',
                },
                {
                    displayName: 'Page End',
                    name: 'page_end',
                    type: 'number',
                    default: null,
                    description: 'Specifies the last page to convert',
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const length = items.length;
        for (let itemIndex = 0; itemIndex < length; itemIndex++) {
            try {
                const binaryFieldName = this.getNodeParameter('binaryFieldName', itemIndex);
                const density = this.getNodeParameter('density', itemIndex, 150);
                const scale = this.getNodeParameter('scale', itemIndex);
                const pageStart = this.getNodeParameter('page_start', itemIndex, null);
                const pageEnd = this.getNodeParameter('page_end', itemIndex, null);
                const tempDir = path.join((0, os_1.tmpdir)(), `pdf-to-img-${Date.now()}`);
                await fs_1.promises.mkdir(tempDir, { recursive: true });
                const pdfPath = path.join(tempDir, 'input.pdf');
                const pdfBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryFieldName);
                await fs_1.promises.writeFile(pdfPath, pdfBuffer);
                try {
                    const scale_img = scale * 1024;
                    const options = {
                        format: 'png',
                        out_dir: tempDir,
                        out_prefix: 'page',
                        scale: scale_img,
                        density: density,
                        page_start: pageStart,
                        page_end: pageEnd
                    };
                    console.log('IMG Options : ', options);
                    let convertedFiles = [];
                    convertedFiles = await pdfPoppler.convert(pdfPath, options);
                    console.log('Converted Files : ', convertedFiles);
                    const fileIndir = await fs_1.promises.readdir(tempDir);
                    const imageFiles = fileIndir.filter((file) => path.extname(file).toLowerCase() === '.png');
                    imageFiles.sort((a, b) => {
                        const pageNumA = parseInt(a.replace('page-', '').replace('.png', ''));
                        const pageNumB = parseInt(b.replace('page-', '').replace('.png', ''));
                        return pageNumA - pageNumB;
                    });
                    const result = [];
                    for (const fileName of imageFiles) {
                        const imagePath = path.join(tempDir, fileName);
                        const pageNumber = parseInt(fileName.replace('page-', '').replace('.png', ''));
                        const imageBuffer = await fs_1.promises.readFile(imagePath);
                        result.push({
                            data: imageBuffer,
                            filename: fileName,
                            pageNumber: pageNumber,
                            totalPages: imageFiles.length,
                        });
                    }
                    let resultImg = { json: {} };
                    const binaryData = {};
                    for (const image of result) {
                        const dataKey = `page_${image.pageNumber}`;
                        const dataBase64 = image.data.toString('base64');
                        binaryData[dataKey] = {
                            data: dataBase64,
                            mimeType: 'image/png',
                            fileExtension: 'png',
                            fileName: image.filename,
                        };
                    }
                    resultImg = {
                        json: {
                            success: true,
                            totalPages: result[0].totalPages,
                            convertedPages: result.length,
                            images: result.map((img) => ({
                                pageNumber: img.pageNumber,
                                filename: img.filename,
                                size: img.data.length,
                            })),
                        },
                        binary: binaryData,
                    };
                    returnData.push(resultImg);
                }
                catch (error) {
                    if (error instanceof Error) {
                        throw error;
                    }
                }
                finally {
                    await fs_1.promises.rm(tempDir, { recursive: true, force: true });
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    throw error;
                }
            }
        }
        return [this.helpers.returnJsonArray(returnData)];
    }
}
exports.PdfToImg = PdfToImg;
//# sourceMappingURL=PdfToImg.node.js.map