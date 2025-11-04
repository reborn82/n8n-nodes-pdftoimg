/* eslint-disable @n8n/community-nodes/no-restricted-imports */
// @ts-expect-error: pdf-poppler has no type definitions
import * as pdfPoppler from 'pdf-poppler';
import * as path from 'path';
import * as fs from 'fs';
import { tmpdir } from 'os';

/* eslint-enable @n8n/community-nodes/no-restricted-imports */

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IBinaryData,
	// BINARY_ENCODING,
} from 'n8n-workflow';

export class PdfToImg implements INodeType {
	description: INodeTypeDescription = {
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const length = items.length;

		for (let itemIndex = 0; itemIndex < length; itemIndex++) {
			try {
				// const source = this.getNodeParameter('source', itemIndex) as string;
				const binaryFieldName = this.getNodeParameter('binaryFieldName', itemIndex) as string;
				// const quality = this.getNodeParameter('quality', itemIndex) as number;
				// const binaryData = this.helpers.assertBinaryData(itemIndex, binaryFieldName);

				const tempDir = path.join(tmpdir(), `pdf-to-img-${Date.now()}`);

				await fs.mkdirSync(tempDir, { recursive: true });
				const pdfPath = path.join(tempDir, 'input.pdf');
				const pdfBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryFieldName);
				await fs.writeFileSync(pdfPath, pdfBuffer);
				const options: pdfPoppler.Options = {
					format: 'png',
					out_dir: tempDir,
					out_prefix: 'page',
					page: null,
				};

				let convertedFiles: string[] = [];
				convertedFiles = await pdfPoppler.convert(pdfPath, options);
				console.log('Converted Files : ', convertedFiles);

				const fileIndir = await fs.readdirSync(tempDir);
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
					const imageBuffer = fs.readFileSync(imagePath);
					result.push({
						data: imageBuffer,
						filename: fileName,
						pageNumber: pageNumber,
						totalPages: imageFiles.length,
					});
				}

				let resultImg: INodeExecutionData = { json: {} };
				const binaryData: Record<string, IBinaryData> = {};
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
			} catch (error) {
				if (error instanceof Error) {
					throw error;
				}
			}
		}
		console.log('Return Data : ', returnData);

		return [this.helpers.returnJsonArray(returnData)];
	}
}
