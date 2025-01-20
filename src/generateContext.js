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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateContext = void 0;
// src/generateContext.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function generateContext(workspaceRoot, outputFile, selectedFiles, excludeFiles, excludePaths, excludeHidden) {
    let fileTree = 'File Tree:\n';
    let filesContent = '\nFiles:\n';
    // Build file tree string
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        fileTree += `├── ${relativePath}\n`;
    });
    // Collect file contents
    selectedFiles.forEach(file => {
        const relativePath = path.relative(workspaceRoot, file.uri.fsPath).replace(/\\/g, '/');
        const baseName = path.basename(file.uri.fsPath);
        if (baseName === '__init__.py') {
            filesContent += `\n--- Start of ${relativePath} ---\n`;
        }
        else {
            try {
                const content = fs.readFileSync(file.uri.fsPath, 'utf-8');
                filesContent += `\n--- Start of ${relativePath} ---\n${content}\n`;
            }
            catch (error) {
                filesContent += `\n--- Start of ${relativePath} ---\nError reading file: ${error}\n`;
            }
        }
    });
    // Write to output file
    const outputPath = path.join(workspaceRoot, outputFile);
    try {
        fs.writeFileSync(outputPath, `${fileTree}\n${filesContent}`);
        vscode.window.showInformationMessage(`Context successfully written to ${outputFile}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to write to output file '${outputFile}': ${error}`);
    }
}
exports.generateContext = generateContext;
//# sourceMappingURL=generateContext.js.map