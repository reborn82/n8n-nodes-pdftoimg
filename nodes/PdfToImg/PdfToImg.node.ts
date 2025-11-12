/* eslint-disable @n8n/community-nodes/no-restricted-imports */
/* eslint-disable import-x/no-unresolved */ // @ts-expect-error: pdf-poppler has no type definitions
import * as pdfPoppler from 'pdf-poppler-myfixed';
import * as path from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
// import { execSync } from 'child_process'
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const length = items.length;

		for (let itemIndex = 0; itemIndex < length; itemIndex++) {
			try {
				
				const binaryFieldName = this.getNodeParameter('binaryFieldName', itemIndex) as string;
				const density = this.getNodeParameter('density', itemIndex, 150) as number;
				const scale = this.getNodeParameter('scale', itemIndex) as number;
				const pageStart = this.getNodeParameter('page_start', itemIndex, null) as number | null;
				const pageEnd = this.getNodeParameter('page_end', itemIndex, null) as number | null;
				

				const tempDir = path.join(tmpdir(), `pdf-to-img-${Date.now()}`);

				await fs.mkdir(tempDir, { recursive: true });
				const pdfPath = path.join(tempDir, 'input.pdf');
				const pdfBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryFieldName);
				await fs.writeFile(pdfPath, pdfBuffer);

				try {
					const scale_img = scale * 1024;

					const options: pdfPoppler.Options = {
						format: 'png',
						out_dir: tempDir,
						out_prefix: 'page',
						scale: scale_img,
						density: density,
						page_start: pageStart,
						page_end: pageEnd
					};
					
					console.log('IMG Options : ', options);

					let convertedFiles: string[] = [];

					convertedFiles = await pdfPoppler.convert(pdfPath, options);
					console.log('Converted Files : ', convertedFiles);
					// console.log('TempDir : ', tempDir);
					const fileIndir = await fs.readdir(tempDir);
					// console.log('FileIndir  : ', fileIndir);
					const imageFiles = fileIndir.filter(
						(file) => path.extname(file).toLowerCase() === '.png',
					);

					imageFiles.sort((a, b) => {
						const pageNumA = parseInt(a.replace('page-', '').replace('.png', ''));
						const pageNumB = parseInt(b.replace('page-', '').replace('.png', ''));
						return pageNumA - pageNumB;
					});

					const result = [];
					for (const fileName of imageFiles) {
						const imagePath = path.join(tempDir, fileName);
						const pageNumber = parseInt(fileName.replace('page-', '').replace('.png', ''));
						const imageBuffer = await fs.readFile(imagePath);
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
				} finally {
					await fs.rm(tempDir, { recursive: true, force: true });
				}
			} catch (error) {
				if (error instanceof Error) {
					throw error;
				}
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
