declare const Console: any;
declare var __createBinding: any;
declare var __setModuleDefault: any;
declare var __importStar: any;
declare var __importDefault: any;
declare const pdfPoppler: any;
declare const path: any;
declare const fs: any;
declare class PdfToImg {
    constructor();
    convertPdftoImages(pdfBuffer: any): Promise<{
        data: any;
        filename: any;
        pageNumber: number;
        totalPages: any;
    }[]>;
    execute(): Promise<any>;
}
